import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { createServer, type Server } from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { POST as refreshPOST } from "../app/api/auth/refresh/route";
import {
  getBffPool,
  createBFFSession,
  getBFFSessionByOpaqueID,
  revokeBFFSession,
  revokeAllUserSessions,
  executeAtomicSessionRefresh,
  cleanupExpiredBFFSessions,
  claimSessionRefresh,
  releaseRefreshClaim,
  commitSessionRefresh,
} from "./auth/session";

describe("BFF PostgreSQL Integration Suite (ci_bff_login)", () => {
  const testUserId1 = "11111111-1111-1111-1111-111111111111";
  const testUserId2 = "22222222-2222-2222-2222-222222222222";
  const testUserId3 = "33333333-3333-3333-3333-333333333333";
  const testUserId4 = "44444444-4444-4444-4444-444444444444";
  const testUserId5 = "55555555-5555-5555-5555-555555555555";
  const testUserId6 = "66666666-6666-6666-6666-666666666666";
  const testUserId7 = "77777777-7777-7777-7777-777777777777";
  const testUserId8 = "88888888-8888-8888-8888-888888888888";
  const testUserId9 = "99999999-9999-9999-9999-999999999999";
  const testUserId10 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  let oidcServer: Server;
  let oidcIssuer: string;
  let signingKey: CryptoKey;
  let jwk: Record<string, unknown>;
  let tokenIdentity = { subject: "route-user", issuer: "", includeIDToken: true };

  async function signedIDToken(subject: string, issuer: string): Promise<string> {
    return new SignJWT({ sub: subject })
      .setProtectedHeader({ alg: "RS256", kid: "integration-key" })
      .setIssuer(issuer)
      .setAudience("finintel-web-bff")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(signingKey);
  }

  function refreshRequest(sessionID: string, csrfToken: string): NextRequest {
    return new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
        "x-finintel-csrf": csrfToken,
        cookie: `finintel_session=${sessionID}`,
      },
    });
  }

  beforeAll(async () => {
    // Ensure environment variables are configured
    process.env.SESSION_ENCRYPTION_KEY =
      process.env.SESSION_ENCRYPTION_KEY ||
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
    process.env.BFF_DATABASE_URL =
      process.env.BFF_DATABASE_URL ||
      "postgres://ci_bff_login:bff_pass@127.0.0.1:5433/finintel_dev?sslmode=disable";

    const keys = await generateKeyPair("RS256");
    signingKey = keys.privateKey;
    jwk = { ...(await exportJWK(keys.publicKey)), kid: "integration-key", use: "sig", alg: "RS256" };
    oidcServer = createServer(async (req, res) => {
      const base = oidcIssuer;
      res.setHeader("content-type", "application/json");
      if (req.url === "/.well-known/openid-configuration") {
        res.end(JSON.stringify({
          issuer: base,
          authorization_endpoint: `${base}/authorize`,
          token_endpoint: `${base}/token`,
          jwks_uri: `${base}/jwks`,
        }));
        return;
      }
      if (req.url === "/jwks") {
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      if (req.url === "/token" && req.method === "POST") {
        const tokenResponse: Record<string, unknown> = {
          access_token: "route-access-v2",
          refresh_token: "route-refresh-v2",
          expires_in: 3600,
        };
        if (tokenIdentity.includeIDToken) {
          tokenResponse.id_token = await signedIDToken(tokenIdentity.subject, tokenIdentity.issuer || base);
        }
        res.end(JSON.stringify(tokenResponse));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not_found" }));
    });
    await new Promise<void>((resolve) => oidcServer.listen(0, "127.0.0.1", resolve));
    const address = oidcServer.address();
    if (!address || typeof address === "string") throw new Error("OIDC test server did not bind");
    oidcIssuer = `http://127.0.0.1:${address.port}`;
    process.env.OIDC_ISSUER_URL = oidcIssuer;
    process.env.OIDC_CLIENT_ID = "finintel-web-bff";
    process.env.OIDC_CLIENT_SECRET = "integration-client-secret";
    process.env.APPLICATION_ORIGIN = "http://localhost:3000";

    const adminURL =
      process.env.TEST_ADMIN_DATABASE_URL ||
      process.env.ADMIN_DATABASE_URL ||
      "postgres://finintel_user:finintel_pass@127.0.0.1:5433/finintel_dev?sslmode=disable";

    // Seed test user accounts in public.users via admin connection
    const adminPool = new Pool({ connectionString: adminURL });
    try {
      await adminPool.query(`
        INSERT INTO public.users (id, identity_provider_issuer, external_subject_id, email, full_name)
        VALUES
          ('${testUserId1}', 'https://auth.finintel.internal', 'ext-sub-12345', 'u1@test.com', 'User 1'),
          ('${testUserId2}', 'https://auth.finintel.internal', 'ext-sub-rotation', 'u2@test.com', 'User 2'),
          ('${testUserId3}', 'https://auth.finintel.internal', 'ext-sub-concurrent', 'u3@test.com', 'User 3'),
          ('${testUserId4}', 'https://auth.finintel.internal', 'ext-sub-transient', 'u4@test.com', 'User 4'),
          ('${testUserId5}', 'https://auth.finintel.internal', 'ext-sub-terminal', 'u5@test.com', 'User 5'),
          ('${testUserId6}', 'https://auth.finintel.internal', 'user-expected-sub', 'u6@test.com', 'User 6'),
          ('${testUserId7}', 'https://auth.finintel.internal', 'user-multi-session', 'u7@test.com', 'User 7')
          ,('${testUserId8}', '${oidcIssuer}', 'route-user', 'u8@test.com', 'User 8')
          ,('${testUserId9}', '${oidcIssuer}', 'expected-route-sub', 'u9@test.com', 'User 9')
          ,('${testUserId10}', '${oidcIssuer}', 'issuer-route-sub', 'u10@test.com', 'User 10')
        ON CONFLICT (id) DO NOTHING;
      `);
    } catch (err: any) {
      console.warn("Notice: Admin user seeding skipped or failed:", err.message);
    } finally {
      await adminPool.end().catch(() => {});
    }

    // Verify connectivity immediately; DO NOT silently skip if DB is unreachable
    try {
      const pool = getBffPool();
      const res = await pool.query("SELECT 1 AS alive");
      expect(res.rows[0].alive).toBe(1);
    } catch (err: any) {
      expect.fail(
        `BFF PostgreSQL Integration setup failed: Database connection as ci_bff_login is required and cannot skip: ${err?.message || err}`
      );
    }
  });

  afterAll(async () => {
    const pool = getBffPool();
    await pool.end().catch(() => {});
    await new Promise<void>((resolve, reject) => oidcServer.close((err) => err ? reject(err) : resolve()));
  });

  it("1. Role Verification: Production code activates finintel_bff and enforces least privilege", async () => {
    const pool = getBffPool();
    const res = await pool.query(`
      SELECT current_user,
             session_user,
             (SELECT rolsuper FROM pg_roles WHERE rolname = session_user) AS rolsuper,
             (SELECT rolbypassrls FROM pg_roles WHERE rolname = session_user) AS rolbypassrls
    `);

    const row = res.rows[0];
    expect(row.current_user).toBe("finintel_bff");
    expect(row.session_user).toBe("ci_bff_login");
    expect(row.rolsuper).toBe(false);
    expect(row.rolbypassrls).toBe(false);

    // Verify denial from public tenant tables (e.g., organizations)
    await expect(pool.query("SELECT * FROM public.organizations LIMIT 1;")).rejects.toThrow();

    // Verify granted access to bff.sessions
    const sessionCount = await pool.query("SELECT count(*) FROM bff.sessions;");
    expect(sessionCount).toBeDefined();

    const historyPrivileges = await pool.query(`
      SELECT privilege_type
      FROM information_schema.role_table_grants
      WHERE grantee = 'finintel_bff'
        AND table_schema = 'bff'
        AND table_name = 'session_token_history'
      ORDER BY privilege_type
    `);
    expect(historyPrivileges.rows.map((row) => row.privilege_type)).toEqual([
      "DELETE", "INSERT", "SELECT",
    ]);
    await expect(
      pool.query("UPDATE bff.session_token_history SET expires_at = expires_at WHERE FALSE")
    ).rejects.toThrow();
  });

  it("2. Session CRUD: Create, read, and revoke session with external identity binding", async () => {
    const userID = testUserId1;
    const identityIssuer = "https://auth.finintel.internal";
    const identitySubject = "ext-sub-12345";

    const created = await createBFFSession({
      userID,
      identityIssuer,
      identitySubject,
      accessToken: "initial-access-token",
      refreshToken: "initial-refresh-token",
      idToken: "initial-id-token",
      expiresInSeconds: 3600,
    });

    expect(created.opaqueSessionID).toBeDefined();
    expect(created.opaqueSessionID.length).toBe(64); // 32 bytes hex
    expect(created.csrfToken).toBeDefined();

    // Read session back using opaque ID
    const session = await getBFFSessionByOpaqueID(created.opaqueSessionID);
    expect(session).not.toBeNull();
    expect(session!.userID).toBe(userID);
    expect(session!.identityIssuer).toBe(identityIssuer);
    expect(session!.identitySubject).toBe(identitySubject);
    expect(session!.accessToken).toBe("initial-access-token");
    expect(session!.refreshToken).toBe("initial-refresh-token");
    expect(session!.idToken).toBe("initial-id-token");
    expect(session!.refreshGeneration).toBe(1);

    // Revoke session
    await revokeBFFSession(created.opaqueSessionID);

    // Read revoked session returns null
    const revokedSession = await getBFFSessionByOpaqueID(created.opaqueSessionID);
    expect(revokedSession).toBeNull();
  });

  it("3. 3-Phase Refresh & Exactly-One-Success Rotation: Atomically rotates tokens and updates generation", async () => {
    const userID = testUserId2;
    const identityIssuer = "https://auth.finintel.internal";
    const identitySubject = "ext-sub-rotation";

    const created = await createBFFSession({
      userID,
      identityIssuer,
      identitySubject,
      accessToken: "access-token-v1",
      refreshToken: "refresh-token-v1",
      idToken: "id-token-v1",
    });

    const refreshResult = await executeAtomicSessionRefresh({
      opaqueSessionID: created.opaqueSessionID,
      fetchNewTokens: async (currRefreshToken, claim) => {
        expect(currRefreshToken).toBe("refresh-token-v1");
        expect(claim.identitySubject).toBe(identitySubject);
        expect(claim.identityIssuer).toBe(identityIssuer);
        expect(claim.refreshGeneration).toBe(1);

        return {
          accessToken: "access-token-v2",
          refreshToken: "refresh-token-v2",
          idToken: "id-token-v2",
          expiresIn: 3600,
        };
      },
    });

    expect(refreshResult.newOpaqueSessionID).toBeDefined();
    expect(refreshResult.newOpaqueSessionID).not.toBe(created.opaqueSessionID);

    // New opaque session ID returns updated session
    const newSession = await getBFFSessionByOpaqueID(refreshResult.newOpaqueSessionID);
    expect(newSession).not.toBeNull();
    expect(newSession!.accessToken).toBe("access-token-v2");
    expect(newSession!.refreshToken).toBe("refresh-token-v2");
    expect(newSession!.idToken).toBe("id-token-v2");
    expect(newSession!.refreshGeneration).toBe(2);

    // Old opaque session ID is invalidated and treated as a replay.
    const oldSession = await getBFFSessionByOpaqueID(created.opaqueSessionID);
    expect(oldSession).toBeNull();
  });

  it("4. Concurrent Refreshes: Enforces exactly-one-winner and rejects parallel claim without corruption", async () => {
    const userID = testUserId3;
    const identityIssuer = "https://auth.finintel.internal";
    const identitySubject = "ext-sub-concurrent";

    const created = await createBFFSession({
      userID,
      identityIssuer,
      identitySubject,
      accessToken: "concurrent-access-v1",
      refreshToken: "concurrent-refresh-v1",
    });

    // Launch two concurrent refresh attempts on the same opaque session ID
    const [res1, res2] = await Promise.allSettled([
      executeAtomicSessionRefresh({
        opaqueSessionID: created.opaqueSessionID,
        fetchNewTokens: async () => {
          // Simulate short network delay while holding Phase 2 claim
          await new Promise((r) => setTimeout(r, 100));
          return {
            accessToken: "concurrent-access-winner-1",
            refreshToken: "concurrent-refresh-winner-1",
            expiresIn: 3600,
          };
        },
      }),
      executeAtomicSessionRefresh({
        opaqueSessionID: created.opaqueSessionID,
        fetchNewTokens: async () => {
          return {
            accessToken: "concurrent-access-winner-2",
            refreshToken: "concurrent-refresh-winner-2",
            expiresIn: 3600,
          };
        },
      }),
    ]);

    // Exactly one must succeed and the other must fail with 409 Conflict
    const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejected = [res1, res2].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const winnerResult = (fulfilled[0] as PromiseFulfilledResult<any>).value;
    const loserError = (rejected[0] as PromiseRejectedResult).reason;

    expect(loserError.message).toMatch(/CONCURRENT_REFRESH|Session not found or already rotated/);

    // Verify winning session is consistent and usable
    const winnerSession = await getBFFSessionByOpaqueID(winnerResult.newOpaqueSessionID);
    expect(winnerSession).not.toBeNull();
    expect(winnerSession!.refreshGeneration).toBe(2);
  });

  it("5. Transient Failure Retention: Safely releases claim without revoking session on 503/network error", async () => {
    const userID = testUserId4;
    const identityIssuer = "https://auth.finintel.internal";
    const identitySubject = "ext-sub-transient";

    const created = await createBFFSession({
      userID,
      identityIssuer,
      identitySubject,
      accessToken: "transient-access-v1",
      refreshToken: "transient-refresh-v1",
    });

    // Refresh fails transiently
    const transientErr = new Error("IDP_TRANSIENT: 503 Service Unavailable");
    (transientErr as any).status = 503;

    await expect(
      executeAtomicSessionRefresh({
        opaqueSessionID: created.opaqueSessionID,
        fetchNewTokens: async () => {
          throw transientErr;
        },
      })
    ).rejects.toThrow("IDP_TRANSIENT");

    // Verify session was NOT revoked
    const session = await getBFFSessionByOpaqueID(created.opaqueSessionID);
    expect(session).not.toBeNull();
    expect(session!.refreshGeneration).toBe(1);

    // Verify claim was released so a subsequent refresh succeeds
    const retryResult = await executeAtomicSessionRefresh({
      opaqueSessionID: created.opaqueSessionID,
      fetchNewTokens: async () => ({
        accessToken: "transient-recovered-access",
        refreshToken: "transient-recovered-refresh",
      }),
    });
    expect(retryResult.newOpaqueSessionID).toBeDefined();
  });

  it("6. Terminal Failure: Revokes session without deadlock on invalid_grant", async () => {
    const userID = testUserId5;
    const identityIssuer = "https://auth.finintel.internal";
    const identitySubject = "ext-sub-terminal";

    const created = await createBFFSession({
      userID,
      identityIssuer,
      identitySubject,
      accessToken: "terminal-access-v1",
      refreshToken: "terminal-refresh-v1",
    });

    const terminalErr = new Error("TERMINAL_REVOCATION: invalid_grant");
    (terminalErr as any).status = 401;
    (terminalErr as any).oauthError = "invalid_grant";

    await expect(
      executeAtomicSessionRefresh({
        opaqueSessionID: created.opaqueSessionID,
        fetchNewTokens: async () => {
          throw terminalErr;
        },
      })
    ).rejects.toThrow("TERMINAL_REVOCATION");

    // Verify session is revoked
    const session = await getBFFSessionByOpaqueID(created.opaqueSessionID);
    expect(session).toBeNull();
  });

  it("7. Identity Mismatch Revocation: Revokes session when refreshed ID token subject mismatches", async () => {
    const userID = testUserId6;
    const identityIssuer = "https://auth.finintel.internal";
    const identitySubject = "user-expected-sub";

    const created = await createBFFSession({
      userID,
      identityIssuer,
      identitySubject,
      accessToken: "idtoken-access-v1",
      refreshToken: "idtoken-refresh-v1",
    });

    // Refreshed ID token returns mismatched sub
    await expect(
      executeAtomicSessionRefresh({
        opaqueSessionID: created.opaqueSessionID,
        fetchNewTokens: async (_rt, claim) => {
          const mismatchedSub = "attacker-sub-999";
          if (mismatchedSub !== claim.identitySubject) {
            const err = new Error("TERMINAL_REVOCATION: IDENTITY_MISMATCH - sub does not match");
            (err as any).status = 401;
            throw err;
          }
          return { accessToken: "should-not-reach" };
        },
      })
    ).rejects.toThrow("IDENTITY_MISMATCH");

    // Affected session must be revoked
    const session = await getBFFSessionByOpaqueID(created.opaqueSessionID);
    expect(session).toBeNull();
  });

  it("8. Replay Response Policy: Revoking an already revoked session triggers revokeAllUserSessions", async () => {
    const userID = testUserId7;
    const identityIssuer = "https://auth.finintel.internal";
    const identitySubject = "user-multi-session";

    // Create two active sessions for the same user
    const session1 = await createBFFSession({
      userID,
      identityIssuer,
      identitySubject,
      accessToken: "user-token-1",
      refreshToken: "user-refresh-1",
    });

    const session2 = await createBFFSession({
      userID,
      identityIssuer,
      identitySubject,
      accessToken: "user-token-2",
      refreshToken: "user-refresh-2",
    });

    // Revoke session 1
    await revokeBFFSession(session1.opaqueSessionID);

    // Session 2 is still active
    const s2Before = await getBFFSessionByOpaqueID(session2.opaqueSessionID);
    expect(s2Before).not.toBeNull();

    // Attempting refresh on revoked session 1 must trigger replay detection and revoke all user sessions
    await expect(
      executeAtomicSessionRefresh({
        opaqueSessionID: session1.opaqueSessionID,
        fetchNewTokens: async () => ({ accessToken: "never" }),
      })
    ).rejects.toThrow(/replay detected|already rotated/);

    // Session 2 must now ALSO be revoked due to replay response policy
    const s2After = await getBFFSessionByOpaqueID(session2.opaqueSessionID);
    expect(s2After).toBeNull();
  });

  it("9. Cleanup: Removes expired and revoked sessions", async () => {
    const pool = getBffPool();
    const pastDate = new Date(Date.now() - 100000);
    const expiredHistoryHash = `expired_history_${crypto.randomUUID()}`;

    // Insert an expired session row directly using an existing user ID
    await pool.query(
      `INSERT INTO bff.sessions (
        user_id, identity_issuer, identity_subject, session_id_hash,
        csrf_token_hash, encrypted_access_token, access_token_expires_at,
        idle_expires_at, absolute_expires_at, is_revoked, refresh_generation
      ) VALUES (
        $1, 'https://auth.finintel.internal', 'sub-cleanup',
        $3, 'csrf_hash', 'enc_access', $2, $2, $2, TRUE, 1
      )`,
      [testUserId1, pastDate, `cleanup_hash_${crypto.randomUUID()}`]
    );
    await pool.query(
      `INSERT INTO bff.session_token_history
         (session_id_hash, session_id, user_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [expiredHistoryHash, crypto.randomUUID(), testUserId1, pastDate]
    );

    const deletedCount = await cleanupExpiredBFFSessions(100);
    expect(deletedCount).toBeGreaterThanOrEqual(2);
    const remaining = await pool.query(
      "SELECT count(*)::int AS count FROM bff.session_token_history WHERE session_id_hash = $1",
      [expiredHistoryHash]
    );
    expect(remaining.rows[0].count).toBe(0);
  });

  it("10. Claim ownership: stale claimant cannot release or commit a reclaimed lease", async () => {
    const created = await createBFFSession({
      userID: testUserId8,
      identityIssuer: oidcIssuer,
      identitySubject: "route-user",
      accessToken: "lease-access",
      refreshToken: "lease-refresh",
    });
    const staleClaim = await claimSessionRefresh(created.opaqueSessionID);
    expect(staleClaim.refreshClaimID).toMatch(/^[0-9a-f-]{36}$/i);

    await getBffPool().query(
      "UPDATE bff.sessions SET refresh_claimed_at = NOW() - INTERVAL '16 seconds' WHERE id = $1",
      [staleClaim.sessionUUID]
    );
    const currentClaim = await claimSessionRefresh(created.opaqueSessionID);
    expect(currentClaim.refreshClaimID).not.toBe(staleClaim.refreshClaimID);

    await expect(releaseRefreshClaim(
      staleClaim.sessionUUID,
      staleClaim.refreshGeneration,
      staleClaim.refreshClaimID
    )).rejects.toThrow(/ownership was lost/);
    await expect(commitSessionRefresh({
      sessionUUID: staleClaim.sessionUUID,
      refreshGeneration: staleClaim.refreshGeneration,
      refreshClaimID: staleClaim.refreshClaimID,
      newTokens: { accessToken: "stale-commit" },
    })).rejects.toThrow(/ownership was lost/);

    const committed = await commitSessionRefresh({
      sessionUUID: currentClaim.sessionUUID,
      refreshGeneration: currentClaim.refreshGeneration,
      refreshClaimID: currentClaim.refreshClaimID,
      newTokens: { accessToken: "current-commit", refreshToken: "current-refresh" },
    });
    expect((await getBFFSessionByOpaqueID(committed.newOpaqueSessionID))?.accessToken).toBe("current-commit");
  });

  it("11. HTTP refresh replay: rotated cookie revokes the user's other session", async () => {
    tokenIdentity = { subject: "route-user", issuer: oidcIssuer, includeIDToken: true };
    const first = await createBFFSession({
      userID: testUserId8, identityIssuer: oidcIssuer, identitySubject: "route-user",
      accessToken: "route-access-v1", refreshToken: "route-refresh-v1",
    });
    const second = await createBFFSession({
      userID: testUserId8, identityIssuer: oidcIssuer, identitySubject: "route-user",
      accessToken: "second-access", refreshToken: "second-refresh",
    });

    const rotated = await refreshPOST(refreshRequest(first.opaqueSessionID, first.csrfToken));
    expect(rotated.status).toBe(200);
    const replay = await refreshPOST(refreshRequest(first.opaqueSessionID, first.csrfToken));
    expect(replay.status).toBe(401);
    expect(await replay.json()).toEqual({ error: "UNAUTHENTICATED", message: "Session expired or invalid" });
    expect(await getBFFSessionByOpaqueID(second.opaqueSessionID)).toBeNull();
  });

  it.each([
    ["subject", testUserId9, "expected-route-sub", "attacker-sub", false],
    ["issuer", testUserId10, "issuer-route-sub", "issuer-route-sub", true],
  ])("12. HTTP refresh signed ID-token %s mismatch revokes the session", async (_kind, userID, expectedSub, signedSub, wrongIssuer) => {
    tokenIdentity = {
      subject: signedSub,
      issuer: wrongIssuer ? `${oidcIssuer}/wrong` : oidcIssuer,
      includeIDToken: true,
    };
    const created = await createBFFSession({
      userID, identityIssuer: oidcIssuer, identitySubject: expectedSub,
      accessToken: "mismatch-access", refreshToken: "mismatch-refresh",
    });
    const response = await refreshPOST(refreshRequest(created.opaqueSessionID, created.csrfToken));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "UNAUTHENTICATED", message: "Refresh token revoked or expired",
    });
    expect(await getBFFSessionByOpaqueID(created.opaqueSessionID)).toBeNull();
  });

  it("13. HTTP refresh without a new ID token fails closed and revokes the session", async () => {
    tokenIdentity = { subject: "route-user", issuer: oidcIssuer, includeIDToken: false };
    const created = await createBFFSession({
      userID: testUserId8,
      identityIssuer: oidcIssuer,
      identitySubject: "route-user",
      accessToken: "missing-id-access",
      refreshToken: "missing-id-refresh",
    });

    const response = await refreshPOST(refreshRequest(created.opaqueSessionID, created.csrfToken));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "UNAUTHENTICATED",
      message: "Refresh token revoked or expired",
    });
    expect(await getBFFSessionByOpaqueID(created.opaqueSessionID)).toBeNull();
  });
});
