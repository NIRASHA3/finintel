import { Pool, PoolClient } from "pg";
import { getConfig } from "../config/index";
import {
  generateOpaqueToken,
  hashToken,
  encryptToken,
  decryptToken,
  getKeyByVersion,
  validateAndParseEncryptionKey,
} from "./crypto";

let poolInstance: Pool | null = null;
const CLIENT_ROLE_ACTIVATED = Symbol("CLIENT_ROLE_ACTIVATED");

async function activateAndVerifyBffRoleOnClient(client: PoolClient): Promise<void> {
  if ((client as any)[CLIENT_ROLE_ACTIVATED]) {
    return;
  }

  // 1. Genuinely activate finintel_bff role for NOINHERIT login accounts
  await client.query("SET ROLE finintel_bff;");

  // 2. Verify role boundaries per newly established connection
  const res = await client.query(`
    SELECT current_user,
           session_user,
           (SELECT rolsuper FROM pg_roles WHERE rolname = session_user) AS rolsuper,
           (SELECT rolbypassrls FROM pg_roles WHERE rolname = session_user) AS rolbypassrls
  `);

  if (res.rows.length === 0) {
    throw new Error("BFF database verification query returned no rows");
  }

  const row = res.rows[0];
  if (row.current_user !== "finintel_bff") {
    throw new Error(`BFF connection failed to activate finintel_bff: current_user is '${row.current_user}'`);
  }
  if (row.rolsuper === true) {
    throw new Error("BFF database connection must NOT be superuser");
  }
  if (row.rolbypassrls === true) {
    throw new Error("BFF database connection must NOT be BYPASSRLS");
  }

  (client as any)[CLIENT_ROLE_ACTIVATED] = true;
}

export function getBffPool(): Pool {
  if (!poolInstance) {
    const cfg = getConfig();
    validateAndParseEncryptionKey(cfg.SESSION_ENCRYPTION_KEY);

    const basePool = new Pool({
      connectionString: cfg.BFF_DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    const originalConnect = basePool.connect.bind(basePool);

    basePool.connect = (async () => {
      const client = await originalConnect();
      try {
        await activateAndVerifyBffRoleOnClient(client);
        return client;
      } catch (err) {
        client.release(true);
        throw err;
      }
    }) as any;

    const originalQuery = basePool.query.bind(basePool);
    basePool.query = (async (queryTextOrConfig: any, values?: any) => {
      const client = await basePool.connect();
      try {
        return await client.query(queryTextOrConfig, values);
      } finally {
        client.release();
      }
    }) as any;

    poolInstance = basePool;
  }
  return poolInstance;
}

export interface BFFSessionData {
  sessionUUID: string;
  userID: string;
  identityIssuer: string;
  identitySubject: string;
  refreshGeneration: number;
  csrfToken: string;
  csrfTokenHash: string;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  accessTokenExpiresAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export async function createBFFSession(params: {
  userID: string;
  identityIssuer: string;
  identitySubject: string;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresInSeconds?: number;
}): Promise<{ opaqueSessionID: string; csrfToken: string; sessionUUID: string }> {
  const cfg = getConfig();
  const pool = getBffPool();

  const opaqueSessionID = generateOpaqueToken(32);
  const sessionIDHash = hashToken(opaqueSessionID);

  const csrfToken = generateOpaqueToken(32);
  const csrfTokenHash = hashToken(csrfToken);

  const now = new Date();
  const accessTokenExpiresAt = new Date(
    now.getTime() + (params.expiresInSeconds || 3600) * 1000
  );
  const absoluteExpiresAt = new Date(
    now.getTime() + cfg.SESSION_ABSOLUTE_TIMEOUT_SECONDS * 1000
  );

  let idleExpiresAt = new Date(
    now.getTime() + cfg.SESSION_IDLE_TIMEOUT_SECONDS * 1000
  );
  if (idleExpiresAt > absoluteExpiresAt) {
    idleExpiresAt = absoluteExpiresAt;
  }

  const keyVersion = 1;
  const keyHex = getKeyByVersion(keyVersion);

  const sessionUUID = crypto.randomUUID();

  const encCsrf = encryptToken(
    csrfToken,
    sessionUUID,
    params.userID,
    "csrf_token",
    keyVersion,
    keyHex
  );

  const encAccess = encryptToken(
    params.accessToken,
    sessionUUID,
    params.userID,
    "access_token",
    keyVersion,
    keyHex
  );

  const encRefresh = params.refreshToken
    ? encryptToken(
        params.refreshToken,
        sessionUUID,
        params.userID,
        "refresh_token",
        keyVersion,
        keyHex
      )
    : null;

  const encId = params.idToken
    ? encryptToken(
        params.idToken,
        sessionUUID,
        params.userID,
        "id_token",
        keyVersion,
        keyHex
      )
    : null;

  await pool.query(
    `INSERT INTO bff.sessions (
      id, session_id_hash, user_id, identity_issuer, identity_subject, refresh_generation,
      csrf_token_hash, encrypted_csrf_token,
      encrypted_access_token, encrypted_refresh_token, encrypted_id_token,
      access_token_expires_at, idle_expires_at, absolute_expires_at,
      key_version, is_revoked, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10, $11, $12, $13, $14, FALSE, NOW(), NOW())`,
    [
      sessionUUID,
      sessionIDHash,
      params.userID,
      params.identityIssuer,
      params.identitySubject,
      csrfTokenHash,
      encCsrf,
      encAccess,
      encRefresh,
      encId,
      accessTokenExpiresAt,
      idleExpiresAt,
      absoluteExpiresAt,
      keyVersion,
    ]
  );

  return { opaqueSessionID, csrfToken, sessionUUID };
}

export async function getBFFSessionByOpaqueID(
  opaqueSessionID: string
): Promise<BFFSessionData | null> {
  if (!opaqueSessionID) return null;

  const pool = getBffPool();
  const sessionIDHash = hashToken(opaqueSessionID);

  const res = await pool.query(
    `SELECT id, user_id, identity_issuer, identity_subject, refresh_generation,
            csrf_token_hash, encrypted_csrf_token, encrypted_access_token,
            encrypted_refresh_token, encrypted_id_token,
            access_token_expires_at, idle_expires_at, absolute_expires_at,
            key_version, is_revoked, revoked_at
     FROM bff.sessions
     WHERE session_id_hash = $1 AND is_revoked = FALSE AND revoked_at IS NULL`,
    [sessionIDHash]
  );

  if (res.rows.length === 0) {
    await revokeSessionsForKnownTokenHash(sessionIDHash);
    return null;
  }

  const row = res.rows[0];
  const now = new Date();
  const absoluteExpiresAt = new Date(row.absolute_expires_at);
  const idleExpiresAt = new Date(row.idle_expires_at);

  // Enforce Absolute and Idle expiration
  if (now >= absoluteExpiresAt || now >= idleExpiresAt) {
    return null;
  }

  const sessionUUID = row.id;
  const userID = row.user_id;
  const keyVersion = row.key_version;
  let keyHex: string;
  try {
    keyHex = getKeyByVersion(keyVersion);
  } catch (err) {
    console.error("Keyring lookup failed for key version:", keyVersion, err);
    return null;
  }

  let csrfToken = "";
  let accessToken = "";
  let refreshToken: string | undefined;
  let idToken: string | undefined;

  try {
    if (row.encrypted_csrf_token) {
      csrfToken = decryptToken(
        row.encrypted_csrf_token,
        sessionUUID,
        userID,
        "csrf_token",
        keyVersion,
        keyHex
      );
    }

    accessToken = decryptToken(
      row.encrypted_access_token,
      sessionUUID,
      userID,
      "access_token",
      keyVersion,
      keyHex
    );

    if (row.encrypted_refresh_token) {
      refreshToken = decryptToken(
        row.encrypted_refresh_token,
        sessionUUID,
        userID,
        "refresh_token",
        keyVersion,
        keyHex
      );
    }

    if (row.encrypted_id_token) {
      idToken = decryptToken(
        row.encrypted_id_token,
        sessionUUID,
        userID,
        "id_token",
        keyVersion,
        keyHex
      );
    }
  } catch (err) {
    console.error("Failed to decrypt session tokens:", err);
    return null;
  }

  // Atomically and awaited extension of idle_expires_at clamped to absolute_expires_at
  const cfg = getConfig();
  let nextIdle = new Date(now.getTime() + cfg.SESSION_IDLE_TIMEOUT_SECONDS * 1000);
  if (nextIdle > absoluteExpiresAt) {
    nextIdle = absoluteExpiresAt;
  }

  if (nextIdle.getTime() - idleExpiresAt.getTime() > 60000) {
    await pool.query(
      `UPDATE bff.sessions
       SET idle_expires_at = $1, updated_at = NOW()
       WHERE id = $2 AND is_revoked = FALSE`,
      [nextIdle, sessionUUID]
    );
  }

  return {
    sessionUUID,
    userID,
    identityIssuer: row.identity_issuer,
    identitySubject: row.identity_subject,
    refreshGeneration: row.refresh_generation,
    csrfToken,
    csrfTokenHash: row.csrf_token_hash,
    accessToken,
    refreshToken,
    idToken,
    accessTokenExpiresAt: new Date(row.access_token_expires_at),
    idleExpiresAt: nextIdle,
    absoluteExpiresAt,
  };
}

async function revokeSessionsForKnownTokenHash(sessionIDHash: string): Promise<boolean> {
  const pool = getBffPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    const owner = await client.query(
      `SELECT user_id FROM bff.sessions WHERE session_id_hash = $1 AND is_revoked = TRUE
       UNION ALL
       SELECT user_id FROM bff.session_token_history
       WHERE session_id_hash = $1 AND expires_at > NOW()
       LIMIT 1`,
      [sessionIDHash]
    );
    if (owner.rows.length === 0) {
      await client.query("COMMIT;");
      return false;
    }
    await client.query(
      `WITH target AS MATERIALIZED (
         SELECT id, session_id_hash, user_id, absolute_expires_at
         FROM bff.sessions WHERE user_id = $1
       ), history AS (
         INSERT INTO bff.session_token_history (session_id_hash, session_id, user_id, expires_at)
         SELECT session_id_hash, id, user_id, absolute_expires_at FROM target
         ON CONFLICT (session_id_hash) DO NOTHING
       )
       UPDATE bff.sessions AS sessions
       SET is_revoked = TRUE, revoked_at = COALESCE(revoked_at, NOW()),
           refresh_claim_id = NULL, refresh_claimed_at = NULL, updated_at = NOW()
       FROM target WHERE sessions.id = target.id`,
      [owner.rows[0].user_id]
    );
    await client.query("COMMIT;");
    return true;
  } catch (err) {
    await client.query("ROLLBACK;").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function revokeBFFSession(opaqueSessionID: string): Promise<void> {
  if (!opaqueSessionID) return;
  const pool = getBffPool();
  const sessionIDHash = hashToken(opaqueSessionID);
  await pool.query(
    `WITH target AS MATERIALIZED (
       SELECT id, session_id_hash, user_id, absolute_expires_at
       FROM bff.sessions WHERE session_id_hash = $1
     ), history AS (
       INSERT INTO bff.session_token_history (session_id_hash, session_id, user_id, expires_at)
       SELECT session_id_hash, id, user_id, absolute_expires_at FROM target
       ON CONFLICT (session_id_hash) DO NOTHING
     )
     UPDATE bff.sessions AS sessions
     SET is_revoked = TRUE, revoked_at = NOW(), refresh_claim_id = NULL,
         refresh_claimed_at = NULL, updated_at = NOW()
     FROM target WHERE sessions.id = target.id`,
    [sessionIDHash]
  );
}

export async function revokeBFFSessionByID(sessionUUID: string): Promise<void> {
  if (!sessionUUID) return;
  const pool = getBffPool();
  await pool.query(
    `WITH target AS MATERIALIZED (
       SELECT id, session_id_hash, user_id, absolute_expires_at
       FROM bff.sessions WHERE id = $1
     ), history AS (
       INSERT INTO bff.session_token_history (session_id_hash, session_id, user_id, expires_at)
       SELECT session_id_hash, id, user_id, absolute_expires_at FROM target
       ON CONFLICT (session_id_hash) DO NOTHING
     )
     UPDATE bff.sessions AS sessions
     SET is_revoked = TRUE, revoked_at = NOW(), refresh_claim_id = NULL,
         refresh_claimed_at = NULL, updated_at = NOW()
     FROM target WHERE sessions.id = target.id`,
    [sessionUUID]
  );
}

async function revokeClaimedBFFSession(claim: SessionRefreshClaim): Promise<void> {
  const pool = getBffPool();
  const result = await pool.query(
    `WITH target AS MATERIALIZED (
       SELECT id, session_id_hash, user_id, absolute_expires_at
       FROM bff.sessions
       WHERE id = $1 AND refresh_generation = $2 AND refresh_claim_id = $3
     ), history AS (
       INSERT INTO bff.session_token_history (session_id_hash, session_id, user_id, expires_at)
       SELECT session_id_hash, id, user_id, absolute_expires_at FROM target
       ON CONFLICT (session_id_hash) DO NOTHING
     )
     UPDATE bff.sessions AS sessions
     SET is_revoked = TRUE, revoked_at = NOW(), refresh_claim_id = NULL,
         refresh_claimed_at = NULL, updated_at = NOW()
     FROM target WHERE sessions.id = target.id`,
    [claim.sessionUUID, claim.refreshGeneration, claim.refreshClaimID]
  );
  if (result.rowCount !== 1) {
    const err = new Error("CONCURRENT_REFRESH: Refresh claim ownership was lost before revocation");
    (err as any).status = 409;
    throw err;
  }
}

export async function revokeAllUserSessions(userID: string): Promise<void> {
  if (!userID) return;
  const pool = getBffPool();
  await pool.query(
    `WITH target AS MATERIALIZED (
       SELECT id, session_id_hash, user_id, absolute_expires_at
       FROM bff.sessions WHERE user_id = $1
     ), history AS (
       INSERT INTO bff.session_token_history (session_id_hash, session_id, user_id, expires_at)
       SELECT session_id_hash, id, user_id, absolute_expires_at FROM target
       ON CONFLICT (session_id_hash) DO NOTHING
     )
     UPDATE bff.sessions AS sessions
     SET is_revoked = TRUE, revoked_at = NOW(), refresh_claim_id = NULL,
         refresh_claimed_at = NULL, updated_at = NOW()
     FROM target WHERE sessions.id = target.id`,
    [userID]
  );
}

export interface SessionRefreshClaim {
  sessionUUID: string;
  userID: string;
  identityIssuer: string;
  identitySubject: string;
  refreshGeneration: number;
  refreshClaimID: string;
  keyVersion: number;
  absoluteExpiresAt: Date;
  currentRefreshToken: string;
}

export async function claimSessionRefresh(opaqueSessionID: string): Promise<SessionRefreshClaim> {
  if (!opaqueSessionID) {
    throw new Error("UNAUTHENTICATED: No session ID provided");
  }
  const pool = getBffPool();
  const client = await pool.connect();
  const sessionIDHash = hashToken(opaqueSessionID);

  try {
    await client.query("BEGIN;");

    const selectRes = await client.query(
      `SELECT id, user_id, identity_issuer, identity_subject,
              session_id_hash, encrypted_refresh_token,
              access_token_expires_at, idle_expires_at, absolute_expires_at,
              key_version, is_revoked, refresh_generation, refresh_claim_id, refresh_claimed_at
       FROM bff.sessions
       WHERE session_id_hash = $1
       FOR UPDATE`,
      [sessionIDHash]
    );

    if (selectRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      await revokeSessionsForKnownTokenHash(sessionIDHash);
      const err = new Error("UNAUTHENTICATED: Session not found or already rotated");
      (err as any).status = 401;
      throw err;
    }

    const row = selectRes.rows[0];

    // Replay detection: If an already-revoked session attempts refresh, revoke ALL sessions for this user!
    if (row.is_revoked) {
      await client.query("ROLLBACK;");
      await revokeAllUserSessions(row.user_id).catch(() => {});
      const err = new Error("UNAUTHENTICATED: Session revoked; replay detected");
      (err as any).status = 401;
      throw err;
    }

    const now = new Date();
    const absoluteExpiresAt = new Date(row.absolute_expires_at);
    const idleExpiresAt = new Date(row.idle_expires_at);

    if (now >= absoluteExpiresAt || now >= idleExpiresAt) {
      await client.query("ROLLBACK;");
      throw new Error("UNAUTHENTICATED: Session expired");
    }

    if (!row.encrypted_refresh_token) {
      await client.query("ROLLBACK;");
      throw new Error("UNAUTHENTICATED: No refresh token associated with session");
    }

    // Check if refresh is currently claimed by another concurrent request within lease (15 seconds)
    const REFRESH_CLAIM_LEASE_MS = 15000;
    if (row.refresh_claimed_at) {
      const claimAge = now.getTime() - new Date(row.refresh_claimed_at).getTime();
      if (claimAge < REFRESH_CLAIM_LEASE_MS) {
        await client.query("ROLLBACK;");
        const err = new Error("CONCURRENT_REFRESH: Another refresh request is currently in progress");
        (err as any).status = 409;
        throw err;
      }
    }

    const keyVersion = row.key_version;
    const keyHex = getKeyByVersion(keyVersion);
    const sessionUUID = row.id;
    const userID = row.user_id;

    const currentRefreshToken = decryptToken(
      row.encrypted_refresh_token,
      sessionUUID,
      userID,
      "refresh_token",
      keyVersion,
      keyHex
    );

    const refreshClaimID = crypto.randomUUID();
    const claimResult = await client.query(
      `UPDATE bff.sessions
       SET refresh_claim_id = $1, refresh_claimed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND refresh_generation = $3`,
      [refreshClaimID, sessionUUID, row.refresh_generation]
    );
    if (claimResult.rowCount !== 1) {
      throw new Error("CONCURRENT_REFRESH: Refresh claim ownership was lost");
    }

    await client.query("COMMIT;");

    return {
      sessionUUID,
      userID,
      identityIssuer: row.identity_issuer,
      identitySubject: row.identity_subject,
      refreshGeneration: row.refresh_generation,
      refreshClaimID,
      keyVersion,
      absoluteExpiresAt,
      currentRefreshToken,
    };
  } catch (err) {
    await client.query("ROLLBACK;").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function releaseRefreshClaim(
  sessionUUID: string,
  refreshGeneration: number,
  refreshClaimID: string
): Promise<void> {
  const pool = getBffPool();
  const result = await pool.query(
    `UPDATE bff.sessions
     SET refresh_claim_id = NULL, refresh_claimed_at = NULL, updated_at = NOW()
     WHERE id = $1 AND refresh_generation = $2 AND refresh_claim_id = $3`,
    [sessionUUID, refreshGeneration, refreshClaimID]
  );
  if (result.rowCount !== 1) {
    const err = new Error("CONCURRENT_REFRESH: Refresh claim ownership was lost before release");
    (err as any).status = 409;
    throw err;
  }
}

export async function commitSessionRefresh(params: {
  sessionUUID: string;
  refreshGeneration: number;
  refreshClaimID: string;
  newTokens: {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresIn?: number;
  };
}): Promise<{
  newOpaqueSessionID: string;
  sessionUUID: string;
  userID: string;
  accessToken: string;
}> {
  const pool = getBffPool();
  const client = await pool.connect();
  const cfg = getConfig();

  try {
    await client.query("BEGIN;");

    const selectRes = await client.query(
      `SELECT id, user_id, identity_issuer, identity_subject, refresh_generation,
              session_id_hash, key_version, absolute_expires_at, is_revoked,
              refresh_claim_id, encrypted_refresh_token
       FROM bff.sessions
       WHERE id = $1
       FOR UPDATE`,
      [params.sessionUUID]
    );

    if (selectRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      throw new Error("UNAUTHENTICATED: Session not found during rotation commit");
    }

    const row = selectRes.rows[0];
    if (row.is_revoked) {
      await client.query("ROLLBACK;");
      throw new Error("UNAUTHENTICATED: Session was revoked during refresh");
    }

    if (row.refresh_generation !== params.refreshGeneration) {
      await client.query("ROLLBACK;");
      const err = new Error("CONCURRENT_REFRESH: Generation mismatch; refresh already committed by concurrent request");
      (err as any).status = 409;
      throw err;
    }
    if (row.refresh_claim_id !== params.refreshClaimID) {
      await client.query("ROLLBACK;");
      const err = new Error("CONCURRENT_REFRESH: Refresh claim ownership was lost before commit");
      (err as any).status = 409;
      throw err;
    }

    const now = new Date();
    const absoluteExpiresAt = new Date(row.absolute_expires_at);
    let nextIdle = new Date(now.getTime() + cfg.SESSION_IDLE_TIMEOUT_SECONDS * 1000);
    if (nextIdle > absoluteExpiresAt) {
      nextIdle = absoluteExpiresAt;
    }

    const newAccessTokenExpiresAt = new Date(
      now.getTime() + (params.newTokens.expiresIn || 3600) * 1000
    );

    const newOpaqueSessionID = generateOpaqueToken(32);
    const newSessionIDHash = hashToken(newOpaqueSessionID);

    const keyVersion = row.key_version;
    const keyHex = getKeyByVersion(keyVersion);
    const sessionUUID = row.id;
    const userID = row.user_id;

    const encAccess = encryptToken(
      params.newTokens.accessToken,
      sessionUUID,
      userID,
      "access_token",
      keyVersion,
      keyHex
    );

    let nextRefreshToken = params.newTokens.refreshToken;
    if (!nextRefreshToken) {
      nextRefreshToken = decryptToken(
        row.encrypted_refresh_token,
        sessionUUID,
        userID,
        "refresh_token",
        keyVersion,
        keyHex
      );
    }

    const encRefresh = encryptToken(
      nextRefreshToken,
      sessionUUID,
      userID,
      "refresh_token",
      keyVersion,
      keyHex
    );

    const encId = params.newTokens.idToken
      ? encryptToken(
          params.newTokens.idToken,
          sessionUUID,
          userID,
          "id_token",
          keyVersion,
          keyHex
        )
      : null;

    await client.query(
      `INSERT INTO bff.session_token_history
         (session_id_hash, session_id, user_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [row.session_id_hash, sessionUUID, userID, absoluteExpiresAt]
    );

    const updateResult = await client.query(
      `UPDATE bff.sessions
       SET session_id_hash = $1,
           refresh_generation = refresh_generation + 1,
           refresh_claim_id = NULL,
           refresh_claimed_at = NULL,
           encrypted_access_token = $2,
           encrypted_refresh_token = $3,
           encrypted_id_token = COALESCE($4, encrypted_id_token),
           access_token_expires_at = $5,
           idle_expires_at = $6,
           updated_at = NOW()
       WHERE id = $7 AND refresh_generation = $8 AND refresh_claim_id = $9`,
      [
        newSessionIDHash,
        encAccess,
        encRefresh,
        encId,
        newAccessTokenExpiresAt,
        nextIdle,
        sessionUUID,
        params.refreshGeneration,
        params.refreshClaimID,
      ]
    );
    if (updateResult.rowCount !== 1) {
      const err = new Error("CONCURRENT_REFRESH: Refresh claim ownership was lost during commit");
      (err as any).status = 409;
      throw err;
    }

    await client.query("COMMIT;");

    return {
      newOpaqueSessionID,
      sessionUUID,
      userID,
      accessToken: params.newTokens.accessToken,
    };
  } catch (err) {
    await client.query("ROLLBACK;").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function executeAtomicSessionRefresh(params: {
  opaqueSessionID: string;
  fetchNewTokens: (currentRefreshToken: string, claim: SessionRefreshClaim) => Promise<{
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresIn?: number;
  }>;
}): Promise<{
  newOpaqueSessionID: string;
  sessionUUID: string;
  userID: string;
  accessToken: string;
}> {
  // Phase 1: Atomically claim refresh ownership via short transaction
  const claim = await claimSessionRefresh(params.opaqueSessionID);

  let tokenResult;
  try {
    // Phase 2: Call IdP outside of any DB transaction
    tokenResult = await params.fetchNewTokens(claim.currentRefreshToken, claim);

    if (!tokenResult.accessToken || tokenResult.accessToken.trim() === "") {
      const err = new Error("IDP_ERROR: Empty access token returned by IdP");
      (err as any).status = 503;
      throw err;
    }
  } catch (err: any) {
    const status = err?.status || 500;
    const isTerminal =
      status === 401 ||
      err?.message?.includes("TERMINAL_REVOCATION") ||
      err?.message?.includes("IDENTITY_MISMATCH") ||
      err?.message?.includes("INVALID_ID_TOKEN");

    if (isTerminal) {
      // Terminal failure: Revoke session without deadlock
      await revokeClaimedBFFSession(claim);
      if (err?.message?.includes("invalid_grant") || err?.oauthError === "invalid_grant") {
        await revokeAllUserSessions(claim.userID).catch(() => {});
      }
    } else {
      // Transient failure: Safely release refresh claim without revoking session
      await releaseRefreshClaim(
        claim.sessionUUID,
        claim.refreshGeneration,
        claim.refreshClaimID
      );
    }
    throw err;
  }

  // Phase 3: Atomically commit token rotation and session ID rotation via short transaction
  return await commitSessionRefresh({
    sessionUUID: claim.sessionUUID,
    refreshGeneration: claim.refreshGeneration,
    refreshClaimID: claim.refreshClaimID,
    newTokens: tokenResult,
  });
}

export async function cleanupExpiredBFFSessions(limit = 1000): Promise<number> {
  const pool = getBffPool();
  const history = await pool.query(
    `DELETE FROM bff.session_token_history
     WHERE session_id_hash IN (
       SELECT session_id_hash FROM bff.session_token_history
       WHERE expires_at <= NOW()
       LIMIT $1
     )`,
    [limit]
  );
  const sessions = await pool.query(
    `DELETE FROM bff.sessions
     WHERE id IN (
       SELECT id FROM bff.sessions
       WHERE absolute_expires_at <= NOW() OR idle_expires_at <= NOW() OR is_revoked = TRUE
       LIMIT $1
     )`,
    [limit]
  );
  return (history.rowCount || 0) + (sessions.rowCount || 0);
}
