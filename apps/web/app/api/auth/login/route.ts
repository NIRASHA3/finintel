import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getConfig } from "../../../../lib/config/index";
import { encryptToken } from "../../../../lib/auth/crypto";
import { fetchOIDCDiscovery, OIDCDiscoveryMetadata } from "../../../../lib/auth/oidc";

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function GET(req: NextRequest) {
  const cfg = getConfig();
  const searchParams = req.nextUrl.searchParams;

  let returnTo = searchParams.get("returnTo") || "/";
  if (!returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.includes("\\")) {
    returnTo = "/";
  }

  let discovery: OIDCDiscoveryMetadata;
  try {
    discovery = await fetchOIDCDiscovery(cfg.OIDC_ISSUER_URL);
  } catch (err) {
    console.error("OIDC Discovery failed in login handler:", err);
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "Authentication service temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const verifierBytes = crypto.randomBytes(32);
  const codeVerifier = base64UrlEncode(verifierBytes);

  const challengeHash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = base64UrlEncode(challengeHash);

  const state = base64UrlEncode(crypto.randomBytes(32));
  const nonce = base64UrlEncode(crypto.randomBytes(32));

  const redirectUri = `${cfg.APPLICATION_ORIGIN}/api/auth/callback`;

  const authorizeUrl = new URL(discovery.authorization_endpoint);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", cfg.OIDC_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const transientPayload = JSON.stringify({
    state,
    nonce,
    code_verifier: codeVerifier,
    returnTo,
  });

  const sealedState = encryptToken(
    transientPayload,
    state,
    "transient",
    "oauth_state",
    1,
    cfg.SESSION_ENCRYPTION_KEY
  );

  const response = NextResponse.redirect(authorizeUrl.toString());

  const cookieName = process.env.NODE_ENV === "production" ? "__Host-finintel_oauth_state" : "finintel_oauth_state";
  response.cookies.set(cookieName, sealedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  return response;
}
