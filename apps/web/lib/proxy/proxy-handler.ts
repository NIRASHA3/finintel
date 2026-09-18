import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "../config/index";
import { getBFFSessionByOpaqueID } from "../auth/session";
import { hashToken, constantTimeCompare } from "../auth/crypto";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export class PayloadTooLargeError extends Error {
  constructor() {
    super("Request body exceeds maximum allowed size");
    this.name = "PayloadTooLargeError";
  }
}

export async function readRequestBodyWithLimit(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes = MAX_PAYLOAD_BYTES
): Promise<ArrayBuffer | undefined> {
  if (!stream) return undefined;

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("payload limit exceeded").catch(() => {});
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export function validateAndCleanPath(rawPathSegments: string[]): { path: string; error?: string } {
  const cleanedSegments: string[] = [];

  for (const rawSeg of rawPathSegments) {
    if (
      rawSeg.includes("%25") ||
      rawSeg.toLowerCase().includes("%2f") ||
      rawSeg.toLowerCase().includes("%5c")
    ) {
      return { path: "", error: "Double encoding or encoded slash detected" };
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(rawSeg);
    } catch {
      return { path: "", error: "Malformed URL path segment encoding" };
    }

    if (/[\x00-\x1F\x7F]/.test(decoded)) {
      return { path: "", error: "Path segment contains illegal control characters" };
    }
    if (decoded === "." || decoded === "..") {
      return { path: "", error: "Path traversal dot segment detected" };
    }
    if (decoded.includes("/") || decoded.includes("\\")) {
      return { path: "", error: "Separator in path segment detected" };
    }

    cleanedSegments.push(decoded);
  }

  let fullPath = cleanedSegments.join("/");
  // Strip duplicate api/v1 or v1 prefix if present in path segments
  fullPath = fullPath.replace(/^(api\/v1|v1)\//, "");
  fullPath = fullPath.replace(/^\//, "");

  return { path: fullPath };
}

export interface RouteAllowlistRule {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  pathPattern: RegExp;
  allowedQueryParams?: string[];
}

export const ROUTE_ALLOWLIST: RouteAllowlistRule[] = [
  // User Profile
  { method: "GET", pathPattern: /^users\/me$/ },

  // Organizations
  { method: "GET", pathPattern: /^organizations$/ },
  { method: "POST", pathPattern: /^organizations$/ },
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}$`) },

  // Organization Members
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/members$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/members$`) },
  { method: "PUT", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/members\/${UUID_PATTERN}\/role$`) },
  { method: "DELETE", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/members\/${UUID_PATTERN}$`) },

  // Chart of Accounts
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/accounts$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/accounts$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/accounts\/seed$`) },

  // Journal Entries
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/journal-entries$`), allowedQueryParams: ["cursor", "limit"] },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/journal-entries$`) },
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/journal-entries\/${UUID_PATTERN}$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/journal-entries\/${UUID_PATTERN}\/reverse$`) },

  // Staged Transactions
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/staged-transactions$`), allowedQueryParams: ["status"] },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/staged-transactions\/upload$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/staged-transactions\/${UUID_PATTERN}\/approve$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/staged-transactions\/${UUID_PATTERN}\/reject$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/staged-transactions\/batch-post$`) },

  // Fiscal Periods
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/fiscal-periods$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/fiscal-periods\/generate$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/fiscal-periods\/${UUID_PATTERN}\/close$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/fiscal-periods\/${UUID_PATTERN}\/lock$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/fiscal-periods\/${UUID_PATTERN}\/unlock$`) },

  // Financial Reports
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/reports\/income-statement$`), allowedQueryParams: ["startDate", "endDate"] },
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/reports\/balance-sheet$`), allowedQueryParams: ["asOfDate"] },
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/reports\/trial-balance$`), allowedQueryParams: ["asOfDate"] },

  // Audit Logs
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/audit-logs$`), allowedQueryParams: ["cursor", "limit"] },

  // Dashboard & Anomalies
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/dashboard\/metrics$`) },
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/anomalies$`) },

  // Data Export
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/export\/ledger$`) },
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/export\/audit$`) },

  // Intentionally Disabled Track 3 / 4 / 5 Routes (Routed to Go Core API to return documented 501)
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/reconciliations\/match$`) },
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/webhooks\/subscriptions$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/webhooks\/subscriptions$`) },
  { method: "DELETE", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/webhooks\/subscriptions\/${UUID_PATTERN}$`) },
  { method: "GET", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/fx-rates$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/fx-rates$`) },
  { method: "POST", pathPattern: new RegExp(`^organizations\/${UUID_PATTERN}\/fx-rates\/revalue$`) },
];

export function validateRouteAllowlist(
  method: string,
  subpath: string,
  searchParams: URLSearchParams
): { allowed: boolean; error?: string } {
  const upperMethod = method.toUpperCase();
  const rule = ROUTE_ALLOWLIST.find(
    (r) => r.method === upperMethod && r.pathPattern.test(subpath)
  );

  if (!rule) {
    return { allowed: false, error: `Route ${upperMethod} /api/v1/${subpath} is not in proxy allowlist` };
  }

  const allowedParams = rule.allowedQueryParams || [];
  for (const [key] of searchParams.entries()) {
    if (!allowedParams.includes(key)) {
      return { allowed: false, error: `Query parameter '${key}' is not allowed for this route` };
    }
  }

  return { allowed: true };
}

export async function handleProxyRequest(
  req: NextRequest,
  params: { path: string[] }
): Promise<NextResponse> {
  const cfg = getConfig();
  const method = req.method.toUpperCase();

  // 1. Validate Path Segments
  const cleaned = validateAndCleanPath(params.path || []);
  if (cleaned.error) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: `Invalid request path: ${cleaned.error}` },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const subpath = cleaned.path;
  const allowlistCheck = validateRouteAllowlist(method, subpath, req.nextUrl.searchParams);
  if (!allowlistCheck.allowed) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: allowlistCheck.error || "Disallowed route or query parameter" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2. Payload Limit Enforcement (10MB) - Checked early for DoS protection
  const contentLength = req.headers.get("content-length");
  const parsedContentLength = contentLength === null ? null : Number(contentLength);
  if (parsedContentLength !== null && (!Number.isSafeInteger(parsedContentLength) || parsedContentLength < 0)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Invalid Content-Length header" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (parsedContentLength !== null && parsedContentLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: "PAYLOAD_TOO_LARGE", message: "Request body exceeds maximum allowed size of 10MB" },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 3. Session Authentication
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
    console.error("Database failure while reading session in proxy handler:", err);
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "Session database unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!session) {
    const res = NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Session invalid or expired" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
    res.cookies.delete(sessionCookieName);
    return res;
  }

  // 4. State-changing operations require Origin, CSRF, and Sec-Fetch-Site validation
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const origin = req.headers.get("origin");
    if (!origin || origin !== cfg.APPLICATION_ORIGIN) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Origin header missing or invalid" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const secFetchSite = req.headers.get("sec-fetch-site");
    if (secFetchSite && !["same-origin", "same-site"].includes(secFetchSite)) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Invalid Sec-Fetch-Site header" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

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
  }

  // 5. Correlation ID handling
  let correlationID = req.headers.get("x-correlation-id");
  if (!correlationID || !UUID_REGEX.test(correlationID)) {
    correlationID = crypto.randomUUID();
  }

  // 6. Construct Upstream Headers (Strict Allowlist; Strip tenant spoofing headers)
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  headers.set("X-Correlation-ID", correlationID);
  headers.set("Accept", "application/json");

  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  // 7. Forward Body if applicable with size check
  let body: ArrayBuffer | undefined = undefined;
  if (["POST", "PUT", "PATCH"].includes(method)) {
    try {
      body = await readRequestBodyWithLimit(req.body);
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        return NextResponse.json(
          { error: "PAYLOAD_TOO_LARGE", message: "Request body exceeds maximum allowed size of 10MB" },
          { status: 413, headers: { "Cache-Control": "no-store" } }
        );
      }
      console.error("Failed to read proxied request body:", err);
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Unable to read request body" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  const upstreamPath = `/api/v1/${subpath}`;
  const targetUrl = `${cfg.CORE_API_URL}${upstreamPath}${req.nextUrl.search}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json(
        { error: "GATEWAY_TIMEOUT", message: "Upstream Core API request timed out after 15 seconds" },
        { status: 504, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Upstream proxy request failed:", err?.message || err);
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "Core API connection failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const resBody = await upstreamRes.arrayBuffer();

  const responseHeaders = new Headers();
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Correlation-ID", correlationID);

  const upstreamContentType = upstreamRes.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("Content-Type", upstreamContentType);
  }

  const contentDisposition = upstreamRes.headers.get("content-disposition");
  if (contentDisposition) {
    responseHeaders.set("Content-Disposition", contentDisposition);
  }

  // Explicitly ensure Set-Cookie from upstream is NEVER passed down
  responseHeaders.delete("Set-Cookie");

  return new NextResponse(resBody, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}
