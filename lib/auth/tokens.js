import crypto from "node:crypto";

/** Random URL-safe token for emails/invites. Only its SHA-256 hash is stored. */
export function createToken(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString("hex");
  return { token, hash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function randomReference(prefix = "SP") {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`.toUpperCase();
}
