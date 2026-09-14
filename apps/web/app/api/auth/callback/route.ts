import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getConfig } from "../../../../lib/config/index";
import { createBFFSession } from "../../../../lib/auth/session";
import { decryptToken } from "../../../../lib/auth/crypto";
import { fetchOIDCDiscovery } from "../../../../lib/auth/oidc";

export async function GET(req: NextRequest) {
  const cfg = getConfig();
  const searchParams = req.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const oauthStateCookieName =
    process.env.NODE_ENV === "production"
      ? "__Host-finintel_oauth_state"
      : "finintel_oauth_state";

  const sessionCookieName =
    process.env.NODE_ENV === "production"
      ? "__Host-finintel_session"
      : "finintel_session";

  const stateCookie = req.cookies.get(oauthStateCookieName);

  const errorResponse = (errCode: string) => {
    const res = NextResponse.redirect(`${cfg.APPLICATION_ORIGIN}/auth-error?error=${errCode}`);
    res.cookies.delete(oauthStateCookieName);
    return res;
  };

  if (!code || !state || !stateCookie || !stateCookie.value) {
    return errorResponse("invalid_state");
  }

  let transientData: { state: string; nonce: string; code_verifier: string; returnTo: string };
  try {
    const unsealedJson = decryptToken(
      stateCookie.value,
      state,
      "transient",
      "oauth_state",
      1,
      cfg.SESSION_ENCRYPTION_KEY
    );
    transientData = JSON.parse(unsealedJson);
  } catch {
    return errorResponse("invalid_state_payload");
  }

  if (transientData.state !== state) {
    return errorResponse("state_mismatch");
  }

  let discovery;
  try {
    discovery = await fetchOIDCDiscovery(cfg.OIDC_ISSUER_URL);
  } catch (err) {
    console.error("OIDC Discovery failed in callback handler:", err);
    return errorResponse("discovery_failed");
  }

  const redirectUri = `${cfg.APPLICATION_ORIGIN}/api/auth/callback`;

  // Code exchange with IdP
  const bodyParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.OIDC_CLIENT_ID,
    client_secret: cfg.OIDC_CLIENT_SECRET,
    redirect_uri: redirectUri,
    code: code,
    code_verifier: transientData.code_verifier,
  });

  let tokenRes;
  try {
    tokenRes = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error("Failed to connect to IdP token endpoint");
    return errorResponse("idp_unavailable");
  }

  if (!tokenRes.ok) {
    console.error("IdP token exchange failed with status:", tokenRes.status);
    return errorResponse("token_exchange_failed");
  }

  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token;
  const idToken = tokens.id_token;
  const expiresIn = tokens.expires_in || 3600;

  if (!accessToken || typeof accessToken !== "string" || accessToken.trim() === "") {
    return errorResponse("missing_access_token");
  }

  if (!idToken || typeof idToken !== "string" || idToken.trim() === "") {
    return errorResponse("missing_id_token");
  }

  // Cryptographically validate ID token (iss, aud, sub, exp, signature, RS256, nonce)
  let idTokenPayload: any;
  try {
    const JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri));
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: cfg.OIDC_ISSUER_URL,
      audience: cfg.OIDC_CLIENT_ID,
      algorithms: ["RS256"],
    });

    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.trim() === "") {
      return errorResponse("id_token_missing_sub");
    }

    if (!payload.exp) {
      return errorResponse("id_token_missing_exp");
    }

    if (!payload.nonce || payload.nonce !== transientData.nonce) {
      return errorResponse("id_token_nonce_mismatch");
    }

    idTokenPayload = payload;
  } catch (e: any) {
    console.error("ID Token verification failed:", e?.message || e);
    if (e?.code === "ERR_JWT_EXPIRED") {
      return errorResponse("id_token_expired");
    }
    return errorResponse("invalid_id_token");
  }

  // Provision / Resolve user via Go Core API /api/v1/users/me
  let meRes;
  try {
    meRes = await fetch(`${cfg.CORE_API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error("Failed to reach Core API /api/v1/users/me");
    return errorResponse("core_api_unavailable");
  }

  if (!meRes.ok) {
    console.error("Core API /api/v1/users/me returned status:", meRes.status);
    return errorResponse("user_provision_failed");
  }

  const meUser = await meRes.json();

  // Create BFF Session with external OIDC identity binding
  let sessionResult;
  try {
    sessionResult = await createBFFSession({
      userID: meUser.id,
      identityIssuer: (idTokenPayload.iss as string) || cfg.OIDC_ISSUER_URL,
      identitySubject: idTokenPayload.sub as string,
      accessToken,
      refreshToken,
      idToken,
      expiresInSeconds: expiresIn,
    });
  } catch (err) {
    console.error("Failed to create BFF session");
    return errorResponse("session_creation_failed");
  }

  const returnTo = transientData.returnTo && transientData.returnTo.startsWith("/")
    ? transientData.returnTo
    : "/";

  const response = NextResponse.redirect(`${cfg.APPLICATION_ORIGIN}${returnTo}`);

  // Clear transient state cookie
  response.cookies.delete(oauthStateCookieName);

  // Set Opaque Session Cookie with maxAge
  response.cookies.set(sessionCookieName, sessionResult.opaqueSessionID, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cfg.SESSION_ABSOLUTE_TIMEOUT_SECONDS,
  });

  return response;
}
