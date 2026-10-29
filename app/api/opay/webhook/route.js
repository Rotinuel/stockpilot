import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyOpayCallback } from "@/lib/opay";
import { verifyAndApply } from "@/services/billing";
import Payment from "@/models/Payment";

// OPay → StockPilot payment notification.
// The callback is only a TRIGGER: nothing in its body is trusted. We look the payment up by our
// own reference and ask OPay's status API (signed with our secret key) before granting access,
// so a forged or replayed callback can't activate a plan.
// OPay retries for up to 72 hours until it gets a 2xx, so we only fail on temporary errors.
export async function POST(request) {
  const raw = await request.text();
  if (raw.length > 100_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const reference = String(body?.payload?.reference || "").slice(0, 120);
  if (!/^[A-Za-z0-9_\-.=]{6,120}$/.test(reference)) return NextResponse.json({ received: true, ignored: "no reference" });
  if (!verifyOpayCallback(body)) console.warn("[opay-webhook] signature did not match for", reference, "— confirming with OPay's status API anyway");

  await connectDB();
  const payment = await Payment.findOne({ reference, provider: "opay" }).select("_id status").lean();
  if (!payment) return NextResponse.json({ received: true, ignored: "unknown reference" });
  if (payment.status === "success") return NextResponse.json({ received: true, duplicate: true });

  try {
    const result = await verifyAndApply(reference, { via: "webhook" });
    return NextResponse.json({ received: true, status: result.status });
  } catch (err) {
    if (err?.status && err.status < 500) {
      console.warn("[opay-webhook]", reference, err.message);
      return NextResponse.json({ received: true, error: err.message });
    }
    console.error("[opay-webhook] processing failed", reference, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // OPay retries later
  }
}
