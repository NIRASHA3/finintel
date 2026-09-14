import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getConfig } from "../../../../lib/config/index";
import {
  getBFFSessionByOpaqueID,
  executeAtomicSessionRefresh,
  revokeBFFSession,
} from "../../../../lib/auth/session";
import { hashToken, constantTimeCompare } from "../../../../lib/auth/crypto";
import { fetchOIDCDiscovery } from "../../../../lib/auth/oidc";

export async function POST(req: NextRequest) {
  const cfg = getConfig();

  // 1. Validate Origin - Missing Origin must fail closed
  const origin = req.headers.get("origin");
  if (!origin || origin !== cfg.APPLICATION_ORIGIN) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Origin header missing or invalid" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2. Validate Sec-Fetch-Site if present
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite && !["same-origin", "same-site"].includes(secFetchSite)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Invalid Sec-Fetch-Site header" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const sessionCookieName =
    process.env.NODE_ENV === "production"
      ? "__Host-finintel_session"
      : "finintel_session";

  const sessionCookie = req.cookies.get(sessionCookieName);
  if (!sessionCookie || !sessionCookie.value) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: "No active session cookie" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  let session;
  try {
    session = await getBFFSessionByOpaqueID(sessionCookie.value);
  } catch (err) {
    console.error("Database failure while reading session during refresh:", err);
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "Session database unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!session) {
    const res = NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Session expired or invalid" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
    res.cookies.delete(sessionCookieName);
    return res;
  }

  // 3. Validate CSRF - Missing CSRF header must fail closed
  const csrfHeader = req.headers.get("x-finintel-csrf") || req.headers.get("x-csrf-token");
  if (!csrfHeader) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Missing CSRF token header" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const submittedHash = hashToken(csrfHeader);
  if (!constantTimeCompare(submittedHash, session.csrfTokenHash)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "CSRF token validation failed" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!session.refreshToken) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: "No refresh token available for session" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 4. Fetch OIDC Discovery (fail closed, no fallback)
  let discovery;
  try {
    discovery = await fetchOIDCDiscovery(cfg.OIDC_ISSUER_URL);
  } catch (err) {
    console.error("OIDC Discovery failed during refresh:", err);
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "Authentication service unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 5. Execute serialized 3-phase refresh with token rotation and identity claim binding
  try {
    const refreshResult = await executeAtomicSessionRefresh({
      opaqueSessionID: sessionCookie.value,
      fetchNewTokens: async (currentRefreshToken: string, claim) => {
        const bodyParams = new URLSearchParams({
          grant_type: "refresh_token",
          client_id: cfg.OIDC_CLIENT_ID,
          client_secret: cfg.OIDC_CLIENT_SECRET,
          refresh_token: currentRefreshToken,
        });

        const tokenRes = await fetch(discovery.token_endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: bodyParams.toString(),
          signal: AbortSignal.timeout(10000),
        });

        if (!tokenRes.ok) {
          const errorBody = await tokenRes.json().catch(() => ({}));
          const oauthError = errorBody.error || "";

          // Explicit terminal errors: invalid_grant, invalid_token
          if (oauthError === "invalid_grant" || oauthError === "invalid_token") {
            const err = new Error(`TERMINAL_REVOCATION: ${oauthError}`);
            (err as any).status = 401;
            (err as any).oauthError = oauthError;
            throw err;
          }

          // Transient failures: 429, 5xx, timeouts -> DO NOT revoke session
          if (tokenRes.status === 429 || tokenRes.status >= 500) {
            const err = new Error("IDP_TRANSIENT: IdP temporary failure");
            (err as any).status = 503;
            throw err;
          }

          const err = new Error(`IDP_ERROR: Refresh request failed with status ${tokenRes.status}`);
          (err as any).status = tokenRes.status;
          throw err;
        }

        const tokens = await tokenRes.json();
        if (!tokens.access_token || typeof tokens.access_token !== "string" || tokens.access_token.trim() === "") {
          const err = new Error("IDP_ERROR: Empty access token returned by IdP");
          (err as any).status = 503;
          throw err;
        }

        // Validate refreshed ID token against persisted external identity binding
        if (tokens.id_token) {
          try {
            const JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri));
            const { payload } = await jwtVerify(tokens.id_token, JWKS, {
              issuer: cfg.OIDC_ISSUER_URL,
              audience: cfg.OIDC_CLIENT_ID,
              algorithms: ["RS256"],
            });

            if (!payload.sub || payload.sub !== claim.identitySubject) {
              const err = new Error("TERMINAL_REVOCATION: IDENTITY_MISMATCH - ID token sub does not match external subject");
              (err as any).status = 401;
              throw err;
            }

            if (payload.iss && payload.iss !== claim.identityIssuer) {
              const err = new Error("TERMINAL_REVOCATION: IDENTITY_MISMATCH - ID token iss does not match external issuer");
              (err as any).status = 401;
              throw err;
            }
          } catch (e: any) {
            console.error("Validation failed for refreshed ID token:", e?.message || e);
            const err = new Error("TERMINAL_REVOCATION: INVALID_ID_TOKEN - Refreshed ID token validation failed");
            (err as any).status = 401;
            throw err;
          }
        }

        return {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken: tokens.id_token,
          expiresIn: tokens.expires_in || 3600,
        };
      },
    });

    // Rotate opaque session cookie with newly generated session ID
    const response = NextResponse.json(
      { status: "OK", message: "Session refreshed successfully" },
      { headers: { "Cache-Control": "no-store" } }
    );

    response.cookies.set(sessionCookieName, refreshResult.newOpaqueSessionID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cfg.SESSION_ABSOLUTE_TIMEOUT_SECONDS,
    });

    return response;
  } catch (err: any) {
    const status = (err as any)?.status || 500;
    if (status === 401 || err?.message?.includes("TERMINAL_REVOCATION")) {
      const res = NextResponse.json(
        { error: "UNAUTHENTICATED", message: "Refresh token revoked or expired" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
      res.cookies.delete(sessionCookieName);
      return res;
    }

    if (status === 503 || err?.message?.includes("IDP_TRANSIENT")) {
      return NextResponse.json(
        { error: "SERVICE_UNAVAILABLE", message: "Identity Provider temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.error("Session refresh operation failed:", err?.message || err);
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "Session refresh failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
