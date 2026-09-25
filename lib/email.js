// Transactional email. Uses the Resend HTTP API when RESEND_API_KEY is set;
// otherwise logs the message (with links) to the server console so the full
// verification/reset/invite flows work in development without an email provider.
import { appUrl } from "./request.js";

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

export async function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${text || ""}\n`);
    return { delivered: false, dev: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "StockPilot <no-reply@stockpilot.ng>", to, subject, html, text }),
    });
    if (!res.ok) {
      console.error("[email] provider error", res.status, await res.text().catch(() => ""));
      return { delivered: false };
    }
    return { delivered: true };
  } catch (err) {
    console.error("[email] send failed", err?.message);
    return { delivered: false };
  }
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
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
