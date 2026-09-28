// Google OAuth 2.0 / OpenID Connect (Authorization Code + PKCE), no extra SDK.
// Secrets (GOOGLE_CLIENT_SECRET) are only used server-side.
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { appUrl } from "../request.js";
import { ApiError } from "../errors.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const OAUTH_STATE_COOKIE = "sp_oauth";
export const GOOGLE_SIGNUP_COOKIE = "sp_google_signup";

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || appUrl("/api/auth/google/callback");
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

export function createPkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function randomString(bytes = 16) {
  return b64url(crypto.randomBytes(bytes));
}

export function buildGoogleAuthUrl({ state, codeChallenge, nonce, loginHint }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${AUTH_URL}?${params}`;
}

/** Exchange the authorization code and return the VERIFIED Google identity. */
export async function exchangeCodeForIdentity({ code, codeVerifier, nonce }) {
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(502, "Couldn't reach Google. Please try again.", "GOOGLE_UNREACHABLE");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id_token) {
    console.error("[google] token exchange failed", res.status, json.error, json.error_description);
    throw new ApiError(400, "Google sign-in failed. Please try again.", "GOOGLE_EXCHANGE_FAILED");
  }
  const { payload } = await jwtVerify(json.id_token, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID,
  }).catch((err) => {
    console.error("[google] id_token verification failed", err?.message);
    throw new ApiError(400, "Google sign-in could not be verified.", "GOOGLE_TOKEN_INVALID");
  });
  if (payload.nonce !== nonce) throw new ApiError(400, "Google sign-in could not be verified.", "GOOGLE_NONCE");
  return {
    sub: String(payload.sub),
    email: String(payload.email || "").toLowerCase(),
    email_verified: payload.email_verified === true || payload.email_verified === "true",
    name: payload.name || "",
    picture: payload.picture || "",
  };
}

export function oauthCookieOptions(maxAge) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge };
}
