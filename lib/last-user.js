// Remembers who last used StockPilot on this device (browser only) so the
// sign-in page can greet them and fill in their email.
const LAST_USER_KEY = "sp:last-user";

export function rememberUser({ email, name }) {
  try {
    if (email) localStorage.setItem(LAST_USER_KEY, JSON.stringify({ email, name: name || "" }));
  } catch {}
}

export function lastUser() {
  try {
    return JSON.parse(localStorage.getItem(LAST_USER_KEY) || "null");
  } catch {
    return null;
  }
}
