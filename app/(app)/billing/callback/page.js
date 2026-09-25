import { PaymentCallback } from "@/components/billing/BillingClient";
import { requireTenantSession } from "@/lib/session";

export const metadata = { title: "Confirming payment" };

// Paystack redirects here with ?reference=...&trxref=...
// The reference is verified SERVER-SIDE (never trusted from the URL).
export default async function BillingCallbackPage({ searchParams }) {
  await requireTenantSession();
  const sp = await searchParams;
  const reference = typeof sp.reference === "string" ? sp.reference : typeof sp.trxref === "string" ? sp.trxref : "";
  return (
    <div className="py-10">
      <PaymentCallback reference={reference} />
    </div>
  );
}
