/** Only allow same-site relative redirects appropriate for the user's role. */
export function safeNext(next, role) {
  const fallback = role === "super_admin" ? "/super-admin" : "/dashboard";
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/api")) return fallback;
  if (role === "super_admin" && !next.startsWith("/super-admin")) return fallback;
  if (role !== "super_admin" && next.startsWith("/super-admin")) return fallback;
  return next;
}
