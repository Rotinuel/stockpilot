#!/usr/bin/env bun
// Project guard-rails: no TypeScript, no middleware.js, proxy.js present,
// no secrets referenced from client components.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const IGNORE = new Set(["node_modules", ".next", ".git"]);
const problems = [];
const files = [];

(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(path.relative(root, full));
  }
})(root);

const ts = files.filter((f) => /\.(ts|tsx|mts|cts)$/.test(f));
if (ts.length) problems.push(`TypeScript files found: ${ts.join(", ")}`);
if (files.some((f) => /(^|\/)middleware\.(js|mjs|ts)$/.test(f))) problems.push("middleware.js found — Next.js 16 uses proxy.js");
if (!existsSync(path.join(root, "proxy.js"))) problems.push("proxy.js is missing");
if (existsSync(path.join(root, "tsconfig.json"))) problems.push("tsconfig.json found — use jsconfig.json");

const SECRETS = ["PAYSTACK_SECRET_KEY", "JWT_SECRET", "MONGODB_URI", "PAYSTACK_WEBHOOK_SECRET", "CRON_SECRET", "RESEND_API_KEY"];
for (const f of files.filter((x) => /\.(js|jsx)$/.test(x))) {
  const src = readFileSync(path.join(root, f), "utf8");
  if (/^\s*["']use client["']/.test(src)) {
    for (const s of SECRETS) if (src.includes(s)) problems.push(`Client component ${f} references secret ${s}`);
    if (/from\s+["'](@\/|\.\.?\/)*(models|services)\//.test(src) || /from\s+["']mongoose["']/.test(src)) problems.push(`Client component ${f} imports server-only code`);
  }
}

if (problems.length) {
  console.error("✗ Project check failed:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log(`✓ Project check passed (${files.length} files): JavaScript only, proxy.js present, no middleware.js, no secrets in client components.`);
