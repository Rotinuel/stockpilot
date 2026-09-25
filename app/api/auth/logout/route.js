import { NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth/cookies";

export const POST = withApi(async () => clearSessionCookie(NextResponse.json({ ok: true, redirect: "/login" })), { auth: false });
