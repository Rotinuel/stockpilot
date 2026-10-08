// Transactional email (verification, password reset, invitations, notifications).
//
// Providers, picked automatically (or forced with EMAIL_PROVIDER=smtp|resend|console):
//   • smtp    — BUILT IN. StockPilot talks SMTP itself (lib/smtp.js) to any mailbox you own:
//               Gmail / Google Workspace, Zoho, your domain's email (cPanel, Namecheap…),
//               Amazon SES, Brevo… No extra account or package needed. Used when SMTP_HOST is set.
//   • resend  — the Resend HTTP API (optional). Used when RESEND_API_KEY is set and SMTP isn't.
//   • console — nothing configured: emails are printed to the server log so verification,
//               reset and invite flows still work in development.
// Server-only: passwords and API keys come from the environment and never reach the browser.
import { appUrl } from "./request.js";
import { smtpConfigFromEnv, sendSmtp, verifySmtp, parseAddress } from "./smtp.js";

const DEFAULT_FROM = "StockPilot <no-reply@stockpilot.ng>";

/** Which provider sends email right now. */
export function emailProvider(env = process.env) {
  const forced = String(env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (forced === "smtp" || forced === "resend" || forced === "console") return forced;
  if ((env.SMTP_HOST || "").trim()) return "smtp";
  if ((env.RESEND_API_KEY || "").trim()) return "resend";
  return "console";
}

/** The sender address. With SMTP and no EMAIL_FROM, the mailbox you log in with is used. */
export function emailFrom(env = process.env) {
  if ((env.EMAIL_FROM || "").trim()) return env.EMAIL_FROM.trim();
  const user = (env.SMTP_USER || "").trim();
  if (emailProvider(env) === "smtp" && user.includes("@")) return `StockPilot <${user}>`;
  return DEFAULT_FROM;
}

/**
 * Describes the email setup without exposing secrets.
 * @returns {{ provider: 'smtp'|'resend'|'console', configured: boolean, from: string, server: string|null, problem: string|null }}
 */
export function emailStatus(env = process.env) {
  const provider = emailProvider(env);
  const from = emailFrom(env);
  const base = { provider, configured: false, from, server: null, problem: null };
  try {
    parseAddress(from);
  } catch {
    return { ...base, problem: `EMAIL_FROM "${from}" isn't a valid sender. Use the form: StockPilot <no-reply@yourdomain.com>` };
  }
  if (provider === "smtp") {
    const cfg = smtpConfigFromEnv(env);
    if (!cfg) return { ...base, problem: "EMAIL_PROVIDER is smtp but SMTP_HOST is not set." };
    const server = `${cfg.host}:${cfg.port}${cfg.secure ? " (TLS)" : " (STARTTLS)"}`;
    if (cfg.user && !cfg.pass) return { ...base, server, problem: "SMTP_USER is set but SMTP_PASS is empty." };
    return { ...base, configured: true, server };
  }
  if (provider === "resend") {
    if (!(env.RESEND_API_KEY || "").trim()) return { ...base, problem: "EMAIL_PROVIDER is resend but RESEND_API_KEY is not set." };
    return { ...base, configured: true, server: "Resend API" };
  }
  return { ...base, problem: "No email provider is set up — emails are printed to the server log." };
}

export function isEmailConfigured() {
  return emailStatus().configured;
}

async function sendWithResend({ from, to, subject, html, text }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
}

/**
 * Sends one email. Never throws: returns { delivered, provider, error? } so a mail problem
 * never breaks sign-up, password reset or a sale.
 */
export async function sendEmail({ to, subject, html, text, replyTo }) {
  const status = emailStatus();
  if (!status.configured) {
    if (status.provider !== "console") console.error(`[email] not sent — ${status.problem}`);
    console.info(`\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${text || ""}\n`);
    return { delivered: false, dev: true, provider: status.provider, error: status.provider === "console" ? null : status.problem };
  }
  const from = status.from;
  try {
    let messageId;
    if (status.provider === "smtp") messageId = (await sendSmtp(smtpConfigFromEnv(), { from, to, replyTo, subject, html, text })).messageId;
    else await sendWithResend({ from, to, subject, html, text });
    console.info(`[email:${status.provider}] sent "${subject}" to ${to}`);
    return { delivered: true, provider: status.provider, messageId };
  } catch (err) {
    console.error(`[email:${status.provider}] NOT sent "${subject}" to ${to}: ${err?.message}`);
    // In development, print the message (with its link) so you can carry on while fixing email.
    if (process.env.NODE_ENV !== "production") console.info(`[email:dev] ${text || ""}\n`);
    return { delivered: false, provider: status.provider, error: err?.message || "Email could not be sent." };
  }
}

/** Super Admin "Send test email": checks the login first so the error is specific. */
export async function sendTestEmail(to) {
  const status = emailStatus();
  if (!status.configured) return { delivered: false, ...status, error: status.problem };
  if (status.provider === "smtp") {
    try {
      await verifySmtp(smtpConfigFromEnv());
    } catch (err) {
      return { delivered: false, ...status, error: err?.message };
    }
  }
  const result = await sendEmail({
    to,
    subject: "StockPilot test email",
    text: `This is a test email from StockPilot. Email is working (sent via ${status.server}).`,
    html: layout("Email is working 🎉", `<p>This is a test email from StockPilot.</p><p>Sent via <strong>${esc(status.server)}</strong> from <strong>${esc(status.from)}</strong>.</p><p>Verification, password-reset, invitation and alert emails will be delivered the same way.</p>`),
  });
  return { ...status, ...result };
}

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px">
  <tr><td style="font-size:20px;font-weight:bold;color:#4338ca;padding-bottom:16px">StockPilot</td></tr>
  <tr><td style="font-size:18px;font-weight:bold;padding-bottom:12px">${esc(title)}</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#334155">${bodyHtml}</td></tr>
  <tr><td style="font-size:12px;color:#94a3b8;padding-top:24px">You received this email because of activity on your StockPilot account.</td></tr>
  </table></td></tr></table></body></html>`;
}

function button(href, label) {
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${esc(label)}</a></p><p style="font-size:12px;color:#64748b">Or copy this link: ${esc(href)}</p>`;
}

export async function sendVerificationEmail(user, token) {
  const link = appUrl(`/verify-email?token=${token}`);
  return sendEmail({
    to: user.email,
    subject: "Verify your StockPilot email",
    text: `Hi ${user.name}, verify your email: ${link}`,
    html: layout("Confirm your email address", `<p>Hi ${esc(user.name)},</p><p>Welcome to StockPilot! Please confirm your email address.</p>${button(link, "Verify email")}<p>This link expires in 48 hours.</p>`),
  });
}

export async function sendPasswordResetEmail(user, token) {
  const link = appUrl(`/reset-password?token=${token}`);
  return sendEmail({
    to: user.email,
    subject: "Reset your StockPilot password",
    text: `Reset your password: ${link} (expires in 1 hour)`,
    html: layout("Reset your password", `<p>Hi ${esc(user.name)},</p><p>We received a request to reset your password.</p>${button(link, "Choose a new password")}<p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`),
  });
}

export async function sendInvitationEmail({ email, businessName, inviterName, role, token }) {
  const link = appUrl(`/accept-invite?token=${token}`);
  return {
    link,
    ...(await sendEmail({
      to: email,
      subject: `You've been invited to ${businessName} on StockPilot`,
      text: `${inviterName} invited you to join ${businessName} as ${role}. Accept: ${link}`,
      html: layout(`Join ${businessName} on StockPilot`, `<p>${esc(inviterName)} has invited you to join <strong>${esc(businessName)}</strong> as <strong>${esc(role)}</strong>.</p>${button(link, "Accept invitation")}<p>This invitation expires in 7 days.</p>`),
    })),
  };
}

export async function sendNotificationEmail({ to, title, message, link }) {
  return sendEmail({
    to,
    subject: title,
    text: `${message}${link ? ` ${appUrl(link)}` : ""}`,
    html: layout(title, `<p>${esc(message)}</p>${link ? button(appUrl(link), "Open StockPilot") : ""}`),
  });
}
