import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "../../../../lib/config/index";
import { getBFFSessionByOpaqueID } from "../../../../lib/auth/session";

export async function GET(req: NextRequest) {
  const cfg = getConfig();

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
    console.error("Database failure in session handler:", err);
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "Database service unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!session) {
    const response = NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Invalid or expired session" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.delete(sessionCookieName);
    return response;
  }

  // Fetch current user details from Core API
  try {
    const meRes = await fetch(`${cfg.CORE_API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!meRes.ok) {
      if (meRes.status === 401 && session.refreshToken) {
        return NextResponse.json(
          { error: "TOKEN_EXPIRED", message: "Access token expired" },
          { status: 401, headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { error: "SERVICE_UNAVAILABLE", message: "Core API unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const user = await meRes.json();

    return NextResponse.json(
      {
        user,
        csrfToken: session.csrfToken, // Returns actual decrypted CSRF token
        expiresAt: session.absoluteExpiresAt.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Failed to query Core API from session handler:", err);
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "Core API connection failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
