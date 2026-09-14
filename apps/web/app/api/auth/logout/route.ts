import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "../../../../lib/config/index";
import { getBFFSessionByOpaqueID, revokeBFFSession } from "../../../../lib/auth/session";
import { hashToken, constantTimeCompare } from "../../../../lib/auth/crypto";

export async function POST(req: NextRequest) {
  const cfg = getConfig();

  // Validate Origin - Missing Origin must fail closed
  const origin = req.headers.get("origin");
  if (!origin || origin !== cfg.APPLICATION_ORIGIN) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Origin header missing or invalid" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Validate Sec-Fetch-Site if present
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
  if (sessionCookie && sessionCookie.value) {
    try {
      const session = await getBFFSessionByOpaqueID(sessionCookie.value);
      if (session) {
        // Validate CSRF - Missing CSRF header must fail closed
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

        await revokeBFFSession(sessionCookie.value);
      }
    } catch (err) {
      console.error("Database failure in logout handler:", err);
      return NextResponse.json(
        { error: "SERVICE_UNAVAILABLE", message: "Database service unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  const response = NextResponse.json(
    { status: "OK", message: "Logged out successfully" },
    { headers: { "Cache-Control": "no-store" } }
  );

  response.cookies.delete(sessionCookieName);
  return response;
}
