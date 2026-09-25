import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runCron, CRON_TASKS } from "@/services/cron";

export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handle(request, { params }) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { task } = await params;
  if (task !== "all" && !CRON_TASKS[task]) {
    return NextResponse.json({ error: "Unknown task", tasks: ["all", ...Object.keys(CRON_TASKS)] }, { status: 404 });
  }
  const results = await runCron(task);
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}

export const GET = handle; // Vercel Cron uses GET
export const POST = handle;
