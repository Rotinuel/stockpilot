import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(plain), hash);
}

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(pw) {
  const s = String(pw || "");
  if (s.length < 8) return "Password must be at least 8 characters.";
  if (s.length > 128) return "Password is too long.";
  if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) return "Password must contain letters and numbers.";
  return null;
}
