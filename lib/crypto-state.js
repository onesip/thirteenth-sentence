import crypto from "node:crypto";
function base64url(buffer) { return Buffer.from(buffer).toString("base64url"); }
function fromBase64url(value) { return Buffer.from(value, "base64url"); }
function secretKey() {
  const source = process.env.SESSION_SECRET || process.env.DEEPSEEK_API_KEY || "";
  if (!source || source.length < 20) return null;
  return crypto.createHash("sha256").update(source).digest();
}
export function canEncryptState() { return Boolean(secretKey()); }
export function encryptState(payload) {
  const key = secretKey(); if (!key) throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]); const tag = cipher.getAuthTag();
  return ["v1", base64url(iv), base64url(tag), base64url(encrypted)].join(".");
}
export function decryptState(token) {
  const key = secretKey(); if (!key) throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  const [version, ivPart, tagPart, dataPart] = String(token || "").split(".");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) throw new Error("INVALID_STATE_TOKEN");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, fromBase64url(ivPart));
  decipher.setAuthTag(fromBase64url(tagPart));
  const decrypted = Buffer.concat([decipher.update(fromBase64url(dataPart)), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
export function randomCode(length = 8) { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = crypto.randomBytes(length); return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join(""); }
export function randomId() { return crypto.randomUUID(); }
export function hashValue(value) { return crypto.createHash("sha256").update(String(value || "")).digest("hex"); }
