import crypto from "node:crypto";
import { getConfig } from "../config/index";

export function generateOpaqueToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");

  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function validateAndParseEncryptionKey(keyHex: string): Buffer {
  if (typeof keyHex !== "string" || keyHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("SESSION_ENCRYPTION_KEY must be exactly 64 hexadecimal characters");
  }
  return Buffer.from(keyHex, "hex");
}

export function getKeyByVersion(keyVersion: number): string {
  const cfg = getConfig();
  if (keyVersion === 1) {
    return cfg.SESSION_ENCRYPTION_KEY;
  }
  const envKey = process.env[`SESSION_ENCRYPTION_KEY_V${keyVersion}`];
  if (envKey) {
    validateAndParseEncryptionKey(envKey);
    return envKey;
  }
  // If version matches current active key, use active key
  if (keyVersion === 1) {
    return cfg.SESSION_ENCRYPTION_KEY;
  }
  throw new Error(`Encryption key version ${keyVersion} not found in keyring`);
}

export function encryptToken(
  plaintext: string,
  sessionID: string,
  userID: string,
  tokenType: string,
  keyVersion: number,
  keyHex: string
): string {
  const key = validateAndParseEncryptionKey(keyHex);
  const nonce = crypto.randomBytes(12);

  const aad = Buffer.from(`${sessionID}:${userID}:${tokenType}:${keyVersion}`, "utf-8");

  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${nonce.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(
  encryptedStr: string,
  sessionID: string,
  userID: string,
  tokenType: string,
  keyVersion: number,
  keyHex: string
): string {
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token payload format");
  }

  const [nonceHex, authTagHex, ciphertextHex] = parts;
  const nonce = Buffer.from(nonceHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const key = validateAndParseEncryptionKey(keyHex);
  const aad = Buffer.from(`${sessionID}:${userID}:${tokenType}:${keyVersion}`, "utf-8");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf-8");
}
