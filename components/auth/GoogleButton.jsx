// Full-page navigation to our OAuth start route (no client JS needed).
export function GoogleIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function GoogleButton({ mode = "login", next, label }) {
  const params = new URLSearchParams({ mode });
  if (next) params.set("next", next);
  return (
    <>
      <a
        href={`/api/auth/google?${params}`}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50"
      >
        <GoogleIcon />
        {label || (mode === "signup" ? "Sign up with Google" : "Continue with Google")}
      </a>
      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or with email
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </>
  );
}

const MESSAGES = {
  google_not_configured: "Google sign-in isn't set up on this server yet. Use your email and password.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "Your Google sign-in session expired or was invalid. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_exchange_failed: "Google sign-in failed. Please try again.",
  google_token_invalid: "We couldn't verify your Google account. Please try again.",
  google_nonce: "We couldn't verify your Google account. Please try again.",
  google_unreachable: "Couldn't reach Google. Check your connection and try again.",
  google_mismatch: "This email is already linked to a different Google account.",
  use_password: "Platform administrators must sign in with email and password.",
  account_disabled: "Your account has been deactivated. Contact your business owner.",
  bad_request: "Your Google account email isn't verified.",
  registrations_closed: "New registrations are temporarily paused.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
};

export function AuthErrorNotice({ code }) {
  if (!code) return null;
  return (
    <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
      {MESSAGES[code] || "Sign-in failed. Please try again."}
    </div>
  );
}
