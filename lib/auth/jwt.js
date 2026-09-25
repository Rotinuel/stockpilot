// JWT session tokens (HS256) via `jose` — works in route handlers, server
// components and proxy.js. The secret never leaves the server.
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "stockpilot";
const AUDIENCE = "stockpilot-app";

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function sessionMaxAgeSeconds() {
  const days = Number(process.env.SESSION_DAYS || 7);
  return Math.max(1, days) * 24 * 60 * 60;
}

/** @param {{sub:string, tid?:string|null, role:string, tv:number}} payload */
export async function signSessionToken(payload) {
  return new SignJWT({ tid: payload.tid || null, role: payload.role, tv: payload.tv || 0 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(payload.sub))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeSeconds()}s`)
    .sign(secretKey());
}

/** Returns the payload or null if the token is missing/invalid/expired. */
export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}
