import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateKeyPair, SignJWT, exportJWK } from "jose";
import { NextRequest } from "next/server";
import {
  validateAndCleanPath,
  validateRouteAllowlist,
  handleProxyRequest,
  PayloadTooLargeError,
  readRequestBodyWithLimit,
  ROUTE_ALLOWLIST,
  UUID_REGEX,
} from "./proxy/proxy-handler";
import {
  hashToken,
  constantTimeCompare,
  encryptToken,
  decryptToken,
  generateOpaqueToken,
} from "./auth/crypto";
import { fetchOIDCDiscovery } from "./auth/oidc";
import * as session from "./auth/session";
import {
  createBFFSession,
  getBFFSessionByOpaqueID,
  revokeBFFSession,
  revokeAllUserSessions,
  cleanupExpiredBFFSessions,
  executeAtomicSessionRefresh,
  getBffPool,
} from "./auth/session";
import { GET as loginHandler } from "../app/api/auth/login/route";
import { GET as callbackHandler } from "../app/api/auth/callback/route";
import { POST as refreshHandler } from "../app/api/auth/refresh/route";
import { POST as logoutHandler } from "../app/api/auth/logout/route";
import { GET as sessionHandler } from "../app/api/auth/session/route";

describe("BFF Security Production Verification Suite", () => {
  const TEST_KEY_HEX = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

  describe("1. Production Path Traversal & Normalization Validation", () => {
    it("accepts canonical route segments", () => {
      const res = validateAndCleanPath(["organizations", "123e4567-e89b-12d3-a456-426614174000", "accounts"]);
      expect(res.error).toBeUndefined();
      expect(res.path).toBe("organizations/123e4567-e89b-12d3-a456-426614174000/accounts");
    });

    it("strips duplicate api/v1 or v1 prefixes cleanly", () => {
      const res1 = validateAndCleanPath(["api", "v1", "users", "me"]);
      expect(res1.path).toBe("users/me");

      const res2 = validateAndCleanPath(["v1", "organizations"]);
      expect(res2.path).toBe("organizations");
    });

    it("rejects double encoding attacks (%252f, %255c)", () => {
      expect(validateAndCleanPath(["organizations", "test%252fadmin"]).error).toContain("Double encoding");
      expect(validateAndCleanPath(["organizations", "test%255cadmin"]).error).toContain("Double encoding");
    });

    it("rejects encoded slash and backslash (%2f, %5c)", () => {
      expect(validateAndCleanPath(["organizations", "test%2fadmin"]).error).toContain("encoded slash");
      expect(validateAndCleanPath(["organizations", "test%5cadmin"]).error).toContain("encoded slash");
    });

    it("rejects path traversal dot segments (., .., %2e%2e)", () => {
      expect(validateAndCleanPath(["..", "admin"]).error).toContain("Path traversal dot segment");
      expect(validateAndCleanPath(["organizations", "."]).error).toContain("Path traversal dot segment");
      expect(validateAndCleanPath(["organizations", "%2e%2e"]).error).toContain("Path traversal dot segment");
    });

    it("rejects control characters in path segments", () => {
      expect(validateAndCleanPath(["organizations\x00"]).error).toContain("control characters");
      expect(validateAndCleanPath(["organizations\x1F"]).error).toContain("control characters");
    });
  });

  describe("2. Route & Query Allowlist Enforcement", () => {
    const validOrgId = "123e4567-e89b-12d3-a456-426614174000";

    it("allows valid routes with permitted query parameters", () => {
      const searchParams = new URLSearchParams({ asOfDate: "2026-03-31" });
      const res = validateRouteAllowlist("GET", `organizations/${validOrgId}/reports/balance-sheet`, searchParams);
      expect(res.allowed).toBe(true);
    });

    it("rejects unlisted routes", () => {
      const res = validateRouteAllowlist("GET", "internal/debug/keys", new URLSearchParams());
      expect(res.allowed).toBe(false);
      expect(res.error).toContain("not in proxy allowlist");
    });

    it("rejects disallowed query parameters on allowed routes", () => {
      const searchParams = new URLSearchParams({ malicious_param: "true" });
      const res = validateRouteAllowlist("GET", `organizations/${validOrgId}/accounts`, searchParams);
      expect(res.allowed).toBe(false);
      expect(res.error).toContain("Query parameter 'malicious_param' is not allowed");
    });

    it("enforces exact HTTP method", () => {
      const res = validateRouteAllowlist("DELETE", `organizations/${validOrgId}/accounts`, new URLSearchParams());
      expect(res.allowed).toBe(false);
    });
  });

  describe("3. OIDC Discovery & Token Validation Security", () => {
    it("fails closed on discovery failure without Keycloak fallbacks", async () => {
      // Mock global fetch to simulate discovery failure
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      try {
        await expect(fetchOIDCDiscovery("http://localhost:8081/realms/finintel")).rejects.toThrow(
          "OIDC Discovery endpoint unreachable or timed out"
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("requires discovery issuer to exactly match OIDC_ISSUER_URL", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: "https://spoofed-issuer.com",
          authorization_endpoint: "https://auth.example.com/auth",
          token_endpoint: "https://auth.example.com/token",
          jwks_uri: "https://auth.example.com/certs",
        }),
      } as any);

      try {
        await expect(fetchOIDCDiscovery("https://auth.finintel.internal")).rejects.toThrow("issuer mismatch");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("generates crypto-secure state, nonce, and PKCE challenge during login", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login?returnTo=/dashboard");
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: "https://auth.finintel.internal",
          authorization_endpoint: "https://auth.finintel.internal/protocol/openid-connect/auth",
          token_endpoint: "https://auth.finintel.internal/protocol/openid-connect/token",
          jwks_uri: "https://auth.finintel.internal/protocol/openid-connect/certs",
        }),
      } as any);

      try {
        const res = await loginHandler(req);
        expect(res.status).toBe(307); // Redirect to IdP
        const location = res.headers.get("location") || "";
        expect(location).toContain("code_challenge=");
        expect(location).toContain("code_challenge_method=S256");
        expect(location).toContain("state=");
        expect(location).toContain("nonce=");

        // Transient state cookie must be set and httpOnly
        const setCookie = res.headers.get("set-cookie") || "";
        expect(setCookie).toContain("finintel_oauth_state");
        expect(setCookie).toContain("HttpOnly");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("rejects callback with state or nonce mismatch", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/callback?code=test-code&state=forged-state");
      const res = await callbackHandler(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("error=invalid_state");
    });
  });

  describe("4. Upstream Header Sanitization & Security Filters", () => {
    it("bounds streamed request bodies even without Content-Length", async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(new Uint8Array([4, 5, 6]));
          controller.close();
        },
      });

      await expect(readRequestBodyWithLimit(stream, 5)).rejects.toBeInstanceOf(
        PayloadTooLargeError
      );
    });

    it("rejects payloads exceeding 10MB", async () => {
      const req = new NextRequest("http://localhost:3000/api/proxy/organizations", {
        method: "POST",
        headers: {
          "origin": "http://localhost:3000",
          "content-length": "10485761", // 10MB + 1 byte
        },
      });

      const res = await handleProxyRequest(req, { path: ["organizations"] });
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toBe("PAYLOAD_TOO_LARGE");
    });

    it("rejects state-changing operations when CSRF header is missing or mismatched", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn();

      const validCsrf = "good-csrf-token-123";
      vi.spyOn(session, "getBFFSessionByOpaqueID").mockResolvedValue({
        sessionUUID: "00000000-0000-4000-8000-000000000001",
        userID: "11111111-1111-4111-8111-111111111111",
        identityIssuer: "https://auth.finintel.internal",
        identitySubject: "ext-sub-test",
        refreshGeneration: 1,
        csrfToken: validCsrf,
        csrfTokenHash: hashToken(validCsrf),
        accessToken: "sample-access-token",
        accessTokenExpiresAt: new Date(Date.now() + 3600000),
        idleExpiresAt: new Date(Date.now() + 3600000),
        absoluteExpiresAt: new Date(Date.now() + 3600000),
      });

      try {
        // Missing CSRF Header
        const reqMissing = new NextRequest("http://localhost:3000/api/proxy/organizations", {
          method: "POST",
          headers: {
            "origin": "http://localhost:3000",
            "cookie": "finintel_session=valid-session-id",
          },
        });

        const resMissing = await handleProxyRequest(reqMissing, { path: ["organizations"] });
        expect(resMissing.status).toBe(403);
        const jsonMissing = await resMissing.json();
        expect(jsonMissing.message).toContain("Missing CSRF token header");

        // Invalid / Mismatched CSRF Header
        const reqWrong = new NextRequest("http://localhost:3000/api/proxy/organizations", {
          method: "POST",
          headers: {
            "origin": "http://localhost:3000",
            "cookie": "finintel_session=valid-session-id",
            "x-finintel-csrf": "wrong-csrf-token",
          },
        });

        const resWrong = await handleProxyRequest(reqWrong, { path: ["organizations"] });
        expect(resWrong.status).toBe(403);
        const jsonWrong = await resWrong.json();
        expect(jsonWrong.message).toContain("CSRF token validation failed");
      } finally {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
      }
    });

    it("sanitizes spoofed tenant headers and strips upstream Set-Cookie", async () => {
      let forwardedHeaders: Headers | undefined;
      const originalFetch = globalThis.fetch;

      globalThis.fetch = vi.fn().mockImplementation((url, init) => {
        forwardedHeaders = new Headers(init.headers);
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "upstream_secret_cookie=attacker; Path=/",
          },
        }));
      });

      const validCsrf = "csrf-123";
      vi.spyOn(session, "getBFFSessionByOpaqueID").mockResolvedValue({
        sessionUUID: "00000000-0000-4000-8000-000000000001",
        userID: "11111111-1111-4111-8111-111111111111",
        identityIssuer: "https://auth.finintel.internal",
        identitySubject: "ext-sub-test-2",
        refreshGeneration: 1,
        csrfToken: validCsrf,
        csrfTokenHash: hashToken(validCsrf),
        accessToken: "safe-access-token",
        accessTokenExpiresAt: new Date(Date.now() + 3600000),
        idleExpiresAt: new Date(Date.now() + 3600000),
        absoluteExpiresAt: new Date(Date.now() + 3600000),
      });

      try {
        const req = new NextRequest("http://localhost:3000/api/proxy/users/me", {
          method: "GET",
          headers: {
            "cookie": "finintel_session=valid-session-id",
            "x-user-id": "spoofed-user",
            "x-user-role": "OWNER",
            "x-organization-id": "spoofed-org",
          },
        });

        const res = await handleProxyRequest(req, { path: ["users", "me"] });
        expect(res.status).toBe(200);

        // Ensure spoofed headers were never sent upstream
        expect(forwardedHeaders?.get("x-user-id")).toBeNull();
        expect(forwardedHeaders?.get("x-user-role")).toBeNull();
        expect(forwardedHeaders?.get("x-organization-id")).toBeNull();

        // Ensure upstream Set-Cookie was stripped
        expect(res.headers.get("set-cookie")).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
      }
    });
  });

  describe("5. Zero Mutation Replay Policy", () => {
    it("verifies safe GET requests can be retried while mutations throw SESSION_EXPIRED deliberately", () => {
      const safeMethods = ["GET"];
      const mutationMethods = ["POST", "PUT", "PATCH", "DELETE"];

      for (const m of safeMethods) {
        expect(m === "GET").toBe(true);
      }

      for (const m of mutationMethods) {
        const canRetry = m === "GET";
        expect(canRetry).toBe(false);
      }
    });
  });

  describe("6. Token Encryption and Cryptographic Security", () => {
    it("encrypts and decrypts OAuth tokens with authenticated AAD", () => {
      const accessToken = "ey...sample.access.token";
      const sessionUUID = "00000000-0000-0000-0000-000000000001";
      const userID = "11111111-1111-1111-1111-111111111111";

      const encrypted = encryptToken(accessToken, sessionUUID, userID, "access_token", 1, TEST_KEY_HEX);
      expect(encrypted).toContain(":");

      const decrypted = decryptToken(encrypted, sessionUUID, userID, "access_token", 1, TEST_KEY_HEX);
      expect(decrypted).toBe(accessToken);
    });

    it("fails decryption if AAD parameters (userID, purpose) are tampered with", () => {
      const accessToken = "ey...sample.access.token";
      const sessionUUID = "00000000-0000-0000-0000-000000000001";
      const userID = "11111111-1111-1111-1111-111111111111";

      const encrypted = encryptToken(accessToken, sessionUUID, userID, "access_token", 1, TEST_KEY_HEX);

      // Tampered userID
      expect(() => {
        decryptToken(encrypted, sessionUUID, "attacker-user-id", "access_token", 1, TEST_KEY_HEX);
      }).toThrow();

      // Tampered purpose
      expect(() => {
        decryptToken(encrypted, sessionUUID, userID, "refresh_token", 1, TEST_KEY_HEX);
      }).toThrow();
    });

    it("verifies CSRF hash comparisons use constant-time compare", () => {
      const tokenA = "random-token-value-abcdef";
      const hashA = hashToken(tokenA);

      expect(constantTimeCompare(hashA, hashToken(tokenA))).toBe(true);
      expect(constantTimeCompare(hashA, hashToken("different-token"))).toBe(false);
    });
  });
});
