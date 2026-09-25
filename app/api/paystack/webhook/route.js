import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyPaystackSignature, webhookEventKey, PAYSTACK_WEBHOOK_IPS } from "@/lib/paystack";
import { clientIp } from "@/lib/request";
import { handlePaystackEvent } from "@/services/billing";
import WebhookEvent from "@/models/WebhookEvent";

// Paystack → StockPilot. Security:
//  1. HMAC-SHA512 signature of the RAW body (x-paystack-signature)
//  2. Optional source-IP allow-list (PAYSTACK_ENFORCE_IP_WHITELIST=true)
//  3. Idempotency (duplicate deliveries are acknowledged but not re-processed)
//  4. Every charge is re-verified with GET /transaction/verify before granting access
export async function POST(request) {
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!verifyPaystackSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (process.env.PAYSTACK_ENFORCE_IP_WHITELIST === "true" && !PAYSTACK_WEBHOOK_IPS.includes(clientIp(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await connectDB();
  const eventKey = webhookEventKey(event);
  let record;
  try {
    record = await WebhookEvent.create({ eventKey, event: event.event, status: "processing" });
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await WebhookEvent.findOne({ eventKey }).lean();
      if (existing?.status !== "failed") return NextResponse.json({ received: true, duplicate: true });
      record = await WebhookEvent.findOneAndUpdate({ eventKey }, { $set: { status: "processing" } }, { new: true });
    } else throw err;
  }

  try {
    const result = await handlePaystackEvent(event);
    const ignored = result && typeof result === "object" && "ignored" in result;
    await WebhookEvent.updateOne({ _id: record._id }, { $set: { status: ignored ? "ignored" : "processed", processedAt: new Date(), error: ignored ? String(result.ignored) : undefined } });
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[paystack-webhook] processing failed", event?.event, err);
    await WebhookEvent.updateOne({ _id: record._id }, { $set: { status: "failed", error: String(err?.message || err).slice(0, 500) } });
    // Non-2xx makes Paystack retry later.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
