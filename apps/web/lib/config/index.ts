export interface BFFConfig {
  BFF_DATABASE_URL: string;
  CORE_API_URL: string;
  OIDC_ISSUER_URL: string;
  OIDC_ID_TOKEN_ALG: string;
  OIDC_CLIENT_ID: string;
  OIDC_CLIENT_SECRET: string;
  SESSION_ENCRYPTION_KEY: string;
  APPLICATION_ORIGIN: string;
  SESSION_IDLE_TIMEOUT_SECONDS: number;
  SESSION_ABSOLUTE_TIMEOUT_SECONDS: number;
}

export const getConfig = (): BFFConfig => {
  const config: BFFConfig = {
    BFF_DATABASE_URL: process.env.BFF_DATABASE_URL || "postgres://dev_bff_login:bff_dev_pass@localhost:5432/finintel_dev?sslmode=disable",
    CORE_API_URL: process.env.CORE_API_URL || "http://localhost:8080",
    OIDC_ISSUER_URL: process.env.OIDC_ISSUER_URL || "https://auth.finintel.internal",
    OIDC_ID_TOKEN_ALG: process.env.OIDC_ID_TOKEN_ALG || "RS256",
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID || "finintel-web-bff",
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET || "dev-bff-secret-32-chars-minimum-length-key",
    SESSION_ENCRYPTION_KEY: process.env.SESSION_ENCRYPTION_KEY || "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    APPLICATION_ORIGIN: process.env.APPLICATION_ORIGIN || "http://localhost:3000",
    SESSION_IDLE_TIMEOUT_SECONDS: process.env.SESSION_IDLE_TIMEOUT_SECONDS ? parseInt(process.env.SESSION_IDLE_TIMEOUT_SECONDS, 10) : 900,
    SESSION_ABSOLUTE_TIMEOUT_SECONDS: process.env.SESSION_ABSOLUTE_TIMEOUT_SECONDS ? parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_SECONDS, 10) : 28800,
  };

  if (typeof config.SESSION_ENCRYPTION_KEY !== "string" || config.SESSION_ENCRYPTION_KEY.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(config.SESSION_ENCRYPTION_KEY)) {
    throw new Error("SESSION_ENCRYPTION_KEY must be exactly 64 hexadecimal characters");
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.BFF_DATABASE_URL || config.BFF_DATABASE_URL.includes("localhost") || config.BFF_DATABASE_URL.includes("bff_dev_pass")) {
      throw new Error("BFF_DATABASE_URL must be explicitly configured in production");
    }
    if (!process.env.OIDC_CLIENT_SECRET || config.OIDC_CLIENT_SECRET.includes("dev-bff-secret") || config.OIDC_CLIENT_SECRET.includes("placeholder")) {
      throw new Error("OIDC_CLIENT_SECRET must be explicitly configured in production");
    }
    if (!process.env.SESSION_ENCRYPTION_KEY || config.SESSION_ENCRYPTION_KEY === "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f") {
      throw new Error("SESSION_ENCRYPTION_KEY must be explicitly configured with a secure 64-hex string in production");
    }
    if (!config.APPLICATION_ORIGIN.startsWith("https://")) {
      throw new Error("APPLICATION_ORIGIN must use HTTPS in production");
    }
    if (!config.OIDC_ISSUER_URL.startsWith("https://")) {
      throw new Error("OIDC_ISSUER_URL must use HTTPS in production");
    }
  }

  return config;
};
