export interface OIDCDiscoveryMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

function stringsTrimSuffix(str: string, suffix: string): string {
  if (str.endsWith(suffix)) {
    return str.slice(0, -suffix.length);
  }
  return str;
}

export async function fetchOIDCDiscovery(issuerUrl: string): Promise<OIDCDiscoveryMetadata> {
  const isProd = process.env.NODE_ENV === "production";
  const normalizedIssuer = stringsTrimSuffix(issuerUrl, "/");

  if (isProd && !normalizedIssuer.startsWith("https://")) {
    throw new Error("OIDC_ISSUER_URL must use HTTPS in production");
  }

  const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;
  let res: Response;
  try {
    res = await fetch(discoveryUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new Error("OIDC Discovery endpoint unreachable or timed out");
  }

  if (!res.ok) {
    throw new Error(`OIDC Discovery failed with HTTP ${res.status}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error("OIDC Discovery returned invalid JSON");
  }

  if (!data.authorization_endpoint || !data.token_endpoint || !data.jwks_uri) {
    throw new Error("OIDC Discovery metadata missing required endpoints");
  }

  // Exact Issuer verification
  if (!data.issuer || stringsTrimSuffix(data.issuer, "/") !== normalizedIssuer) {
    throw new Error(`OIDC Discovery issuer mismatch: expected '${normalizedIssuer}', got '${data.issuer}'`);
  }

  // Require HTTPS endpoints in production
  if (isProd) {
    if (
      !data.authorization_endpoint.startsWith("https://") ||
      !data.token_endpoint.startsWith("https://") ||
      !data.jwks_uri.startsWith("https://")
    ) {
      throw new Error("OIDC Discovery endpoints must use HTTPS in production");
    }
  }

  return {
    issuer: data.issuer,
    authorization_endpoint: data.authorization_endpoint,
    token_endpoint: data.token_endpoint,
    jwks_uri: data.jwks_uri,
  };
}
