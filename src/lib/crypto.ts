import crypto from "crypto";
import { env } from "./env";

/**
 * Symmetric encryption for secrets stored at rest (currently the company's
 * GitHub OAuth token). AES-256-GCM with a key derived from AUTH_SECRET.
 *
 * Encrypted values are tagged with a version prefix so we can tell them apart
 * from any legacy plaintext already in the database and rotate later.
 */

const PREFIX = "enc:v1:";
const key = crypto.createHash("sha256").update(env.AUTH_SECRET).digest(); // 32 bytes

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/**
 * Decrypt a value produced by {@link encryptSecret}. Values without the prefix
 * are treated as legacy plaintext and returned as-is (backwards compatible).
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key / corrupt data
  }
}
