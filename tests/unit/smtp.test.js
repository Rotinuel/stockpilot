import { test, expect, describe, afterEach } from "bun:test";
import net from "node:net";
import tls from "node:tls";
import { buildMessage, dotStuff, encodeHeader, parseAddress, htmlToText, smtpConfigFromEnv, sendSmtp, verifySmtp } from "../../lib/smtp.js";
import { emailProvider, emailFrom, emailStatus } from "../../lib/email.js";

// Self-signed certificate for "localhost" (tests only).
const CERT = `-----BEGIN CERTIFICATE-----
MIIBkjCCATmgAwIBAgIUfXnMQDybj/YKTHO/putR7Yi5nq4wCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MTAwODEyNDUxNloXDTM2MTAwNTEy
NDUxNlowFDESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEM7i1Z4XgNhJoiWa9nS5MuILjMpAVxRaizLwCkWaRnEcAG7IyCAiJmJYo
Q/fhEWHxolx6NhHGzz5la7mVmlsZHqNpMGcwHQYDVR0OBBYEFNIdT2zR4oW/E9M4
Uw9sDM3PDLzHMB8GA1UdIwQYMBaAFNIdT2zR4oW/E9M4Uw9sDM3PDLzHMA8GA1Ud
EwEB/wQFMAMBAf8wFAYDVR0RBA0wC4IJbG9jYWxob3N0MAoGCCqGSM49BAMCA0cA
MEQCICvTDjsYAbQQOCD5bHqLLKiDpLhfeNFUSdIkROCOisqvAiAFbKQoYSS1O5e1
QjnmPufaD28QS19ERKh5Y8cJOrcIaQ==
-----END CERTIFICATE-----`;
const KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgIl/bCoRUvTQRBokh
LFx5chCEajCZD9X9x26JE0t/d5KhRANCAAQzuLVnheA2EmiJZr2dLky4guMykBXF
FqLMvAKRZpGcRwAbsjIICImYlihD9+ERYfGiXHo2EcbPPmVruZWaWxke
-----END PRIVATE KEY-----`;
const trustTestCert = { tlsOptions: { ca: CERT } };

/**
 * Minimal SMTP server: optional implicit TLS / STARTTLS / AUTH PLAIN+LOGIN. Records messages.
 * STARTTLS is emulated by piping the connection into an internal TLS listener (Bun can't
 * upgrade a server-side socket in place); the client sees a normal in-place upgrade.
 */
function fakeSmtpServer({ implicitTls = false, starttls = false, auth = null, user = "shop@example.com", pass = "app-password", rejectRcpt = null } = {}) {
  const messages = [];
  const transcripts = [];
  const upgrades = [];
  let innerPort = 0;
  const handle = (socket, { secured = implicitTls, greet = true, log = null } = {}) => {
    if (!log) {
      log = [];
      transcripts.push(log);
    }
    let buf = "";
    let mode = "cmd";
    let data = "";
    let mail = null;
    let loginStep = 0;
    let loginUser = "";
    const send = (line) => socket.write(line + "\r\n");
    const ehlo = () => {
      const caps = ["localhost greets you", "SIZE 10485760", "8BITMIME"];
      if (starttls && !secured) caps.push("STARTTLS");
      if (auth && (secured || !starttls)) caps.push(`AUTH ${auth}`);
      caps.forEach((c, i) => send(`250${i === caps.length - 1 ? " " : "-"}${c}`));
    };
    const onLine = (line) => {
      log.push(line);
      if (mode === "data") {
        if (line === ".") {
          mode = "cmd";
          messages.push({ ...mail, data });
          return send("250 2.0.0 Ok: queued");
        }
        data += (line.startsWith("..") ? line.slice(1) : line) + "\n";
        return;
      }
      if (mode === "login") {
        const value = Buffer.from(line, "base64").toString();
        if (loginStep === 1) {
          loginUser = value;
          loginStep = 2;
          return send("334 UGFzc3dvcmQ6");
        }
        mode = "cmd";
        return send(loginUser === user && value === pass ? "235 2.7.0 Authentication successful" : "535 5.7.8 Bad credentials");
      }
      const [verb, ...rest] = line.split(" ");
      const arg = rest.join(" ");
      switch (verb.toUpperCase()) {
        case "EHLO":
          return ehlo();
        case "STARTTLS": {
          send("220 2.0.0 Ready to start TLS");
          socket.off("data", onData);
          upgrades.push(log);
          const inner = net.connect(innerPort, "127.0.0.1");
          socket.pipe(inner);
          inner.pipe(socket);
          inner.on("error", () => socket.destroy());
          socket.on("close", () => inner.destroy());
          return;
        }
        case "AUTH": {
          const [method, token] = arg.split(" ");
          if (method === "PLAIN") {
            const [, u, p] = Buffer.from(token, "base64").toString().split("\0");
            return send(u === user && p === pass ? "235 2.7.0 Authentication successful" : "535 5.7.8 Bad credentials");
          }
          mode = "login";
          loginStep = 1;
          return send("334 VXNlcm5hbWU6");
        }
        case "MAIL":
          mail = { from: arg.match(/<([^>]*)>/)[1], to: [] };
          return send("250 2.1.0 Ok");
        case "RCPT": {
          const addr = arg.match(/<([^>]*)>/)[1];
          if (rejectRcpt && addr === rejectRcpt) return send("550 5.1.1 No such user");
          mail.to.push(addr);
          return send("250 2.1.5 Ok");
        }
        case "DATA":
          mode = "data";
          data = "";
          return send("354 End data with <CR><LF>.<CR><LF>");
        case "QUIT":
          send("221 2.0.0 Bye");
          return socket.end();
        default:
          return send("502 5.5.2 Command not recognized");
      }
    };
    function onData(chunk) {
      buf += chunk.toString();
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        onLine(line);
      }
    }
    socket.on("data", onData);
    socket.on("error", () => {});
    if (greet) send("220 localhost ESMTP test");
  };
  const server = implicitTls ? tls.createServer({ key: KEY, cert: CERT }, (s) => handle(s)) : net.createServer((s) => handle(s));
  const innerServer = tls.createServer({ key: KEY, cert: CERT }, (s) => handle(s, { secured: true, greet: false, log: upgrades.shift() }));
  innerServer.on("tlsClientError", () => {});
  const listen = (srv) => new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve(srv.address().port)));
  return Promise.all([listen(server), listen(innerServer)]).then(([port, inner]) => {
    innerPort = inner;
    const closeOne = (srv) => new Promise((r) => srv.close(() => r()));
    return { port, messages, transcripts, close: () => Promise.all([closeOne(server), closeOne(innerServer)]) };
  });
}

let server;
afterEach(async () => {
  await server?.close();
  server = null;
});

const decodeParts = (raw) =>
  [...raw.matchAll(/Content-Type: (text\/\w+); charset=UTF-8\nContent-Transfer-Encoding: base64\n\n([A-Za-z0-9+/=\n]+)/g)].map((m) => ({ type: m[1], body: Buffer.from(m[2].replace(/\n/g, ""), "base64").toString("utf8") }));

describe("message building", () => {
  test("parses sender addresses and blocks header injection", () => {
    expect(parseAddress("StockPilot <no-reply@shop.ng>")).toEqual({ name: "StockPilot", address: "no-reply@shop.ng" });
    expect(parseAddress('"Mama Put" <a@b.co>')).toEqual({ name: "Mama Put", address: "a@b.co" });
    expect(parseAddress("plain@b.co")).toEqual({ name: "", address: "plain@b.co" });
    expect(() => parseAddress("a@b.co\r\nBcc: x@y.z")).toThrow();
    expect(() => parseAddress("not-an-email")).toThrow();
  });

  test("encodes non-ASCII subjects and strips line breaks", () => {
    expect(encodeHeader("Plain subject")).toBe("Plain subject");
    expect(encodeHeader("Hello\r\nBcc: evil@x.com")).toBe("Hello Bcc: evil@x.com");
    const encoded = encodeHeader("Payment received — ₦12,500 ✅ for your StockPilot subscription renewal this month");
    for (const word of encoded.split("\r\n ")) {
      expect(word).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
      expect(word.length).toBeLessThanOrEqual(75);
    }
    const decoded = encoded.split("\r\n ").map((w) => Buffer.from(w.slice(10, -2), "base64").toString("utf8")).join("");
    expect(decoded).toBe("Payment received — ₦12,500 ✅ for your StockPilot subscription renewal this month");
  });

  test("builds multipart text + html with CRLF and short lines", () => {
    const m = buildMessage({ from: "Shop <s@shop.ng>", to: "c@x.com", subject: "Hi", text: "Hello", html: "<p>Hello <b>₦</b></p>" });
    expect(m.from).toBe("s@shop.ng");
    expect(m.recipients).toEqual(["c@x.com"]);
    expect(m.messageId).toMatch(/^<[\w-]+@shop\.ng>$/);
    expect(m.raw).toContain('From: "Shop" <s@shop.ng>\r\n');
    expect(m.raw).toContain("multipart/alternative");
    expect(m.raw.replace(/\r\n/g, "").includes("\n")).toBe(false);
    for (const line of m.raw.split("\r\n")) expect(line.length).toBeLessThanOrEqual(998);
  });

  test("dot-stuffs lines that start with a dot", () => {
    expect(dotStuff("a\r\n.b\r\nc")).toBe("a\r\n..b\r\nc\r\n.\r\n");
  });

  test("html to text keeps links", () => {
    expect(htmlToText('<p>Hi</p><p><a href="https://x.co/v">Verify</a></p>')).toBe("Hi\nVerify (https://x.co/v)");
  });
});

describe("configuration", () => {
  test("reads SMTP settings and infers TLS from the port", () => {
    expect(smtpConfigFromEnv({})).toBeNull();
    expect(smtpConfigFromEnv({ SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", SMTP_USER: "a@gmail.com", SMTP_PASS: "x" })).toMatchObject({ host: "smtp.gmail.com", port: 465, secure: true, requireTls: true });
    expect(smtpConfigFromEnv({ SMTP_HOST: "mail.shop.ng" })).toMatchObject({ port: 587, secure: false, requireTls: true });
    expect(smtpConfigFromEnv({ SMTP_HOST: "localhost", SMTP_PORT: "1025" }).requireTls).toBe(false);
  });

  test("picks the provider and sender", () => {
    expect(emailProvider({})).toBe("console");
    expect(emailProvider({ RESEND_API_KEY: "re_x" })).toBe("resend");
    expect(emailProvider({ RESEND_API_KEY: "re_x", SMTP_HOST: "smtp.gmail.com" })).toBe("smtp");
    expect(emailProvider({ RESEND_API_KEY: "re_x", SMTP_HOST: "smtp.gmail.com", EMAIL_PROVIDER: "resend" })).toBe("resend");
    expect(emailFrom({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "myshop@gmail.com" })).toBe("StockPilot <myshop@gmail.com>");
    expect(emailFrom({ SMTP_HOST: "h", SMTP_USER: "u@x.co", EMAIL_FROM: "Shop <hi@shop.ng>" })).toBe("Shop <hi@shop.ng>");
  });

  test("status explains problems without exposing the password", () => {
    expect(emailStatus({}).configured).toBe(false);
    const ok = emailStatus({ SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", SMTP_USER: "a@gmail.com", SMTP_PASS: "secret-pass" });
    expect(ok).toMatchObject({ provider: "smtp", configured: true, server: "smtp.gmail.com:465 (TLS)" });
    expect(JSON.stringify(ok)).not.toContain("secret-pass");
    expect(emailStatus({ SMTP_HOST: "h.co", SMTP_USER: "a@b.co" }).problem).toMatch(/SMTP_PASS/);
    expect(emailStatus({ SMTP_HOST: "h.co", EMAIL_FROM: "bad sender" }).problem).toMatch(/EMAIL_FROM/);
  });
});

describe("talking to an SMTP server", () => {
  const msg = { from: "StockPilot <shop@example.com>", to: "customer@example.org", subject: "Your receipt ✅", text: "Line one\n.dot line\nThanks", html: "<p>Thanks</p>" };

  test("STARTTLS + AUTH PLAIN delivers the message", async () => {
    server = await fakeSmtpServer({ starttls: true, auth: "PLAIN LOGIN" });
    const cfg = { host: "localhost", port: server.port, secure: false, user: "shop@example.com", pass: "app-password", requireTls: true };
    const res = await sendSmtp(cfg, msg, trustTestCert);
    expect(res.accepted).toBe(1);
    expect(server.messages).toHaveLength(1);
    const sent = server.messages[0];
    expect(sent.from).toBe("shop@example.com");
    expect(sent.to).toEqual(["customer@example.org"]);
    const parts = decodeParts(sent.data);
    expect(parts.find((p) => p.type === "text/plain").body).toBe("Line one\n.dot line\nThanks");
    expect(parts.find((p) => p.type === "text/html").body).toBe("<p>Thanks</p>");
    // the password was only sent after encryption started
    const log = server.transcripts[0];
    expect(log.indexOf("STARTTLS")).toBeLessThan(log.findIndex((l) => l.startsWith("AUTH")));
  });

  test("implicit TLS (port 465 style) + AUTH LOGIN", async () => {
    server = await fakeSmtpServer({ implicitTls: true, auth: "LOGIN" });
    const cfg = { host: "localhost", port: server.port, secure: true, user: "shop@example.com", pass: "app-password", requireTls: true };
    await sendSmtp(cfg, msg, trustTestCert);
    expect(server.messages).toHaveLength(1);
  });

  test("wrong password gives a clear error", async () => {
    server = await fakeSmtpServer({ starttls: true, auth: "PLAIN" });
    const cfg = { host: "localhost", port: server.port, secure: false, user: "shop@example.com", pass: "wrong", requireTls: true };
    await expect(verifySmtp(cfg, trustTestCert)).rejects.toThrow(/username or password/);
    expect(server.messages).toHaveLength(0);
  });

  test("refuses to send a password over an unencrypted connection", async () => {
    server = await fakeSmtpServer({ auth: "PLAIN" });
    const cfg = { host: "127.0.0.1", port: server.port, secure: false, user: "shop@example.com", pass: "app-password", requireTls: true };
    await expect(sendSmtp(cfg, msg)).rejects.toThrow(/encryption/);
    expect(server.transcripts[0].some((l) => l.startsWith("AUTH"))).toBe(false);
  });

  test("rejects a certificate that isn't trusted", async () => {
    server = await fakeSmtpServer({ starttls: true, auth: "PLAIN" });
    const cfg = { host: "localhost", port: server.port, secure: false, user: "shop@example.com", pass: "app-password", requireTls: true };
    await expect(sendSmtp(cfg, msg)).rejects.toThrow(/certificate/);
  });

  test("a refused recipient is reported", async () => {
    server = await fakeSmtpServer({ rejectRcpt: "nobody@example.org" });
    const cfg = { host: "localhost", port: server.port, secure: false, user: "", pass: "", requireTls: false };
    await expect(sendSmtp(cfg, { ...msg, to: "nobody@example.org" })).rejects.toThrow(/refused the recipient/);
  });

  test("a closed port gives a helpful message", async () => {
    const cfg = { host: "127.0.0.1", port: 1, secure: false, user: "", pass: "", requireTls: false };
    await expect(sendSmtp(cfg, msg)).rejects.toThrow(/refused the connection/);
  });
});
