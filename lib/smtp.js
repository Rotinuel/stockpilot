// Built-in SMTP mailer (no third-party package or email API needed).
//
// StockPilot talks SMTP directly to a mailbox you already own — Gmail / Google Workspace,
// Zoho, the email that came with your domain (cPanel, Namecheap, Hostinger…), or any SMTP
// relay (Amazon SES, Brevo, Mailgun…). Configure it with SMTP_* environment variables
// (see .env.example). Server-only: the password is read from the environment and never sent
// to the browser.
//
// Supports implicit TLS (port 465), STARTTLS (port 587 / 25 / 2525), AUTH PLAIN and LOGIN,
// UTF-8 subjects and names, and multipart text + HTML bodies.
import net from "node:net";
import tls from "node:tls";
import os from "node:os";
import crypto from "node:crypto";

const CRLF = "\r\n";
const TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || "").trim());
const falsy = (v) => /^(0|false|no|off)$/i.test(String(v || "").trim());
const isLocalHost = (h) => ["localhost", "127.0.0.1", "::1"].includes(String(h || "").toLowerCase());

/** SMTP settings from the environment (null when SMTP_HOST isn't set). */
export function smtpConfigFromEnv(env = process.env) {
  const host = (env.SMTP_HOST || "").trim();
  if (!host) return null;
  const port = Number(env.SMTP_PORT) || 587;
  const secure = env.SMTP_SECURE ? truthy(env.SMTP_SECURE) : port === 465;
  return {
    host,
    port,
    secure, // true = TLS from the first byte (465); false = upgrade with STARTTLS
    user: (env.SMTP_USER || "").trim(),
    pass: env.SMTP_PASS || "",
    // STARTTLS is required unless explicitly disabled (or you're talking to a local test server).
    requireTls: !falsy(env.SMTP_REQUIRE_TLS) && !isLocalHost(host),
  };
}

// ---------------------------------------------------------------------------
// Addresses and headers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/;

/** "StockPilot <no-reply@x.com>" → { name: "StockPilot", address: "no-reply@x.com" } */
export function parseAddress(input) {
  const raw = String(input || "").trim();
  if (/[\r\n]/.test(raw)) throw new Error("Email address contains a line break.");
  const m = raw.match(/^(.*)<([^<>]+)>$/);
  const name = m ? m[1].trim().replace(/^"(.*)"$/, "$1").trim() : "";
  const address = (m ? m[2] : raw).trim();
  if (!EMAIL_RE.test(address)) throw new Error(`"${address}" is not a valid email address.`);
  return { name, address };
}

/** RFC 2047 encoded-word for non-ASCII header text (split so no word exceeds 75 chars). */
export function encodeHeader(value) {
  const text = String(value ?? "").replace(/[\r\n]+/g, " ");
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  const words = [];
  let chunk = "";
  for (const ch of text) {
    // 45 bytes of UTF-8 → 60 base64 chars, + 12 for "=?UTF-8?B?…?=" = 72
    if (Buffer.byteLength(chunk + ch) > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w).toString("base64")}?=`).join(`${CRLF} `);
}

function formatAddress({ name, address }) {
  if (!name) return address;
  if (/^[\x20-\x7e]*$/.test(name)) return `"${name.replace(/["\\]/g, "\\$&")}" <${address}>`;
  return `${encodeHeader(name)} <${address}>`;
}

/** RFC 5322 date, e.g. "Thu, 08 Oct 2026 12:00:00 +0000". */
function rfcDate(d = new Date()) {
  return d.toUTCString().replace(/GMT$/, "+0000");
}

const wrap76 = (b64) => b64.replace(/.{1,76}/g, (line) => line + CRLF);

// ---------------------------------------------------------------------------
// MIME message
// ---------------------------------------------------------------------------

/**
 * Builds the raw message (CRLF line endings, before SMTP dot-stuffing).
 * @returns {{ raw: string, from: string, recipients: string[], messageId: string }}
 */
export function buildMessage({ from, to, replyTo, subject, text, html, date = new Date() }) {
  const sender = parseAddress(from);
  const recipients = (Array.isArray(to) ? to : String(to || "").split(","))
    .map((a) => String(a).trim())
    .filter(Boolean)
    .map(parseAddress);
  if (!recipients.length) throw new Error("No recipient.");
  const domain = sender.address.split("@")[1];
  const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const boundary = `sp_${crypto.randomBytes(12).toString("hex")}`;
  const plain = text || (html ? htmlToText(html) : "");

  const headers = [
    `From: ${formatAddress(sender)}`,
    `To: ${recipients.map(formatAddress).join(", ")}`,
    replyTo ? `Reply-To: ${formatAddress(parseAddress(replyTo))}` : null,
    `Subject: ${encodeHeader(subject || "")}`,
    `Date: ${rfcDate(date)}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    "X-Mailer: StockPilot",
  ].filter(Boolean);

  const part = (type, body) => [`Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", wrap76(Buffer.from(body, "utf8").toString("base64"))].join(CRLF);

  let body;
  if (html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [`--${boundary}`, part("text/plain", plain), `--${boundary}`, part("text/html", html), `--${boundary}--`, ""].join(CRLF);
  } else {
    headers.push("Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64");
    body = wrap76(Buffer.from(plain, "utf8").toString("base64"));
  }
  return { raw: `${headers.join(CRLF)}${CRLF}${CRLF}${body}`, from: sender.address, recipients: recipients.map((r) => r.address), messageId };
}

/** Plain-text fallback for HTML-only messages. */
export function htmlToText(html) {
  return String(html)
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** SMTP transparency: lines starting with "." get an extra "."; message ends with CRLF.CRLF */
export function dotStuff(raw) {
  const normalized = raw.replace(/\r?\n/g, CRLF);
  return normalized.replace(/^\./gm, "..") + (normalized.endsWith(CRLF) ? "" : CRLF) + "." + CRLF;
}

// ---------------------------------------------------------------------------
// SMTP conversation
// ---------------------------------------------------------------------------

export class SmtpError extends Error {
  constructor(message, { code, stage } = {}) {
    super(message);
    this.name = "SmtpError";
    this.code = code;
    this.stage = stage;
  }
}

/** Reads SMTP replies (multi-line "250-…" … "250 …") from a socket. */
class ReplyReader {
  constructor() {
    this.buffer = "";
    this.lines = [];
    this.waiters = [];
    this.error = null;
  }
  attach(socket) {
    this.socket = socket;
    this.onData = (chunk) => {
      this.buffer += chunk.toString("utf8");
      let i;
      while ((i = this.buffer.indexOf("\n")) >= 0) {
        this.lines.push(this.buffer.slice(0, i).replace(/\r$/, ""));
        this.buffer = this.buffer.slice(i + 1);
      }
      this.flush();
    };
    this.onError = (err) => this.fail(err);
    this.onClose = () => this.fail(new SmtpError("The mail server closed the connection.", { stage: "connection" }));
    socket.on("data", this.onData);
    socket.on("error", this.onError);
    socket.on("close", this.onClose);
  }
  detach() {
    if (!this.socket) return;
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onError);
    this.socket.off("close", this.onClose);
    this.socket = null;
  }
  fail(err) {
    if (this.error) return;
    this.error = err;
    for (const w of this.waiters.splice(0)) w.reject(err);
  }
  flush() {
    while (this.waiters.length) {
      const end = this.lines.findIndex((l) => /^\d{3}(?: |$)/.test(l));
      if (end < 0) return;
      const lines = this.lines.splice(0, end + 1);
      const code = Number(lines[end].slice(0, 3));
      this.waiters.shift().resolve({ code, lines: lines.map((l) => l.slice(4)), text: lines.map((l) => l.slice(4)).join(" ") });
    }
  }
  next() {
    if (this.error) return Promise.reject(this.error);
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      this.flush();
    });
  }
}

function connect({ host, port, secure, tlsOptions }) {
  return new Promise((resolve, reject) => {
    const opts = { host, port, servername: net.isIP(host) ? undefined : host, ...tlsOptions };
    const socket = secure ? tls.connect(opts) : net.connect({ host, port });
    const fail = (err) => {
      socket.destroy();
      reject(friendlyNetworkError(err, host, port));
    };
    const onTimeout = () => fail(new SmtpError(`Timed out connecting to ${host}:${port}.`, { code: "ETIMEDOUT", stage: "connection" }));
    socket.setTimeout(TIMEOUT_MS);
    socket.once("timeout", onTimeout);
    socket.once("error", fail);
    socket.once(secure ? "secureConnect" : "connect", () => {
      socket.off("error", fail);
      socket.off("timeout", onTimeout);
      resolve(socket);
    });
  });
}

function upgradeToTls(socket, { host, tlsOptions }) {
  return new Promise((resolve, reject) => {
    const secured = tls.connect({ socket, servername: net.isIP(host) ? undefined : host, ...tlsOptions });
    const onTimeout = () => {
      secured.destroy();
      reject(new SmtpError("Timed out while securing the connection (STARTTLS).", { stage: "starttls" }));
    };
    const onError = (err) => {
      secured.destroy();
      reject(friendlyNetworkError(err, host));
    };
    secured.setTimeout(TIMEOUT_MS);
    secured.once("timeout", onTimeout);
    secured.once("error", onError);
    secured.once("secureConnect", () => {
      secured.off("timeout", onTimeout);
      secured.off("error", onError);
      resolve(secured);
    });
  });
}

function friendlyNetworkError(err, host, port) {
  if (err instanceof SmtpError) return err;
  const code = err?.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new SmtpError(`Mail server "${host}" was not found. Check SMTP_HOST.`, { code, stage: "connection" });
  if (code === "ECONNREFUSED") return new SmtpError(`${host}:${port} refused the connection. Check SMTP_PORT (usually 465 or 587).`, { code, stage: "connection" });
  if (code === "ETIMEDOUT") return new SmtpError(`Couldn't reach ${host}:${port}. Port 25 is often blocked by hosts — use 465 or 587.`, { code, stage: "connection" });
  if (/wrong version number|ssl3_get_record|packet length too long/i.test(err?.message || "")) {
    return new SmtpError("TLS mismatch: use SMTP_SECURE=true with port 465, or SMTP_SECURE=false with port 587.", { code: "TLS_MISMATCH", stage: "connection" });
  }
  if (/certificate|self.signed|CERT_/i.test(`${code} ${err?.message}`)) return new SmtpError(`The mail server's security certificate isn't valid for "${host}".`, { code, stage: "tls" });
  return new SmtpError(err?.message || "Couldn't connect to the mail server.", { code, stage: "connection" });
}

function authError(reply) {
  const hint = /gmail|google/i.test(reply.text) || reply.code === 534
    ? " For Gmail/Google Workspace, turn on 2-Step Verification and use an App Password, not your normal password."
    : "";
  return new SmtpError(`The mail server rejected the username or password (${reply.code}).${hint}`, { code: reply.code, stage: "auth" });
}

/**
 * Opens a session, says EHLO, upgrades to TLS and logs in. Returns { send, quit }.
 * `tlsOptions` is for tests (e.g. a custom CA); certificates are always verified.
 */
async function openSession(config, { tlsOptions } = {}) {
  const { host, port, user, pass } = config;
  let socket = await connect({ host, port, secure: config.secure, tlsOptions });
  let reader;
  const listen = () => {
    reader = new ReplyReader();
    reader.attach(socket);
    socket.setTimeout(TIMEOUT_MS);
    socket.on("timeout", () => reader.fail(new SmtpError("The mail server stopped responding.", { stage: "timeout" })));
  };
  listen();
  let caps = [];

  const write = (line) => socket.write(line + CRLF);
  const expect = async (codes, stage, command) => {
    if (command !== undefined) write(command);
    const reply = await reader.next();
    if (!codes.includes(reply.code)) {
      throw new SmtpError(`Mail server error during ${stage}: ${reply.code} ${reply.text}`.trim(), { code: reply.code, stage });
    }
    return reply;
  };

  try {
    await expect([220], "greeting");
    const helo = (os.hostname() || "stockpilot.local").replace(/[^\w.-]/g, "") || "stockpilot.local";
    let ehlo = await expect([250], "EHLO", `EHLO ${helo}`);
    caps = ehlo.lines.map((l) => l.toUpperCase());

    if (!config.secure) {
      if (caps.some((c) => c.startsWith("STARTTLS"))) {
        await expect([220], "STARTTLS", "STARTTLS");
        reader.detach();
        socket = await upgradeToTls(socket, { host, tlsOptions });
        listen();
        ehlo = await expect([250], "EHLO", `EHLO ${helo}`);
        caps = ehlo.lines.map((l) => l.toUpperCase());
      } else if (config.requireTls) {
        throw new SmtpError(`${host}:${port} doesn't offer encryption (STARTTLS). Use port 465 with SMTP_SECURE=true, or set SMTP_REQUIRE_TLS=false if you really trust this network.`, { stage: "starttls" });
      }
    }

    if (user) {
      const authLine = caps.find((c) => c.startsWith("AUTH")) || "";
      const methods = authLine.replace(/^AUTH[ =]/, "").split(/\s+/);
      if (methods.includes("PLAIN") || !methods.includes("LOGIN")) {
        const token = Buffer.from(`\0${user}\0${pass}`, "utf8").toString("base64");
        write(`AUTH PLAIN ${token}`);
        const reply = await reader.next();
        if (reply.code !== 235) throw authError(reply);
      } else {
        await expect([334], "login", "AUTH LOGIN");
        await expect([334], "login", Buffer.from(user, "utf8").toString("base64"));
        write(Buffer.from(pass, "utf8").toString("base64"));
        const reply = await reader.next();
        if (reply.code !== 235) throw authError(reply);
      }
    }
  } catch (err) {
    socket.destroy();
    throw err;
  }

  return {
    async send(message) {
      const size = caps.some((c) => c.startsWith("SIZE")) ? ` SIZE=${Buffer.byteLength(message.raw)}` : "";
      await expect([250], "MAIL FROM", `MAIL FROM:<${message.from}>${size}`);
      let accepted = 0;
      const rejected = [];
      for (const rcpt of message.recipients) {
        write(`RCPT TO:<${rcpt}>`);
        const reply = await reader.next();
        if (reply.code === 250 || reply.code === 251) accepted += 1;
        else rejected.push({ address: rcpt, reason: `${reply.code} ${reply.text}` });
      }
      if (!accepted) throw new SmtpError(`The mail server refused the recipient: ${rejected.map((r) => r.reason).join("; ")}`, { stage: "RCPT TO" });
      await expect([354], "DATA", "DATA");
      socket.write(dotStuff(message.raw));
      const done = await expect([250], "DATA");
      return { accepted, rejected, response: done.text };
    },
    async quit() {
      try {
        write("QUIT");
        await Promise.race([reader.next(), new Promise((r) => setTimeout(r, 1000))]);
      } catch {
        // already closed
      } finally {
        reader.detach();
        socket.end();
        socket.destroy();
      }
    },
  };
}

/**
 * Sends one email over SMTP.
 * @returns {Promise<{ messageId: string, accepted: number, rejected: Array, response: string }>}
 */
export async function sendSmtp(config, { from, to, replyTo, subject, text, html }, options = {}) {
  const message = buildMessage({ from, to, replyTo, subject, text, html });
  const session = await openSession(config, options);
  try {
    const result = await session.send(message);
    return { messageId: message.messageId, ...result };
  } finally {
    await session.quit();
  }
}

/** Connects and logs in without sending anything (for "Test connection"). */
export async function verifySmtp(config, options = {}) {
  const session = await openSession(config, options);
  await session.quit();
  return true;
}
