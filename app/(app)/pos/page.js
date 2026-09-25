import { Lock } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { lookupProducts } from "@/services/products";
import { listLocations } from "@/services/locations";
import { hasFeature } from "@/lib/plans";
import { toPlain } from "@/lib/serialize";
import POS from "@/components/pos/POS";
import Button from "@/components/ui/Button";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "POS" };

export default async function POSPage() {
  const session = await requireTenantSession();
  if (!sessionCan(session, "pos:use")) return <AccessDenied />;
  const { ctx, access, tenant } = session;

  if (!access.canWrite) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">The POS is paused</h1>
        <p className="mt-1 max-w-md text-sm text-slate-500">{access.message || "An active subscription is required to record new sales."}</p>
        {sessionCan(session, "billing:view") ? (
          <Button href="/billing" className="mt-6">
            Choose a plan
          </Button>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Please ask the business owner to renew the subscription.</p>
        )}
      </div>
    );
  }

  const [products, locations] = await Promise.all([lookupProducts(ctx, "", { limit: 24 }), listLocations(ctx, { activeOnly: true })]);
  return (
    <>
      <h1 className="sr-only">Point of sale</h1>
      <POS
        initialProducts={products}
        currency={ctx.currency}
        taxRate={Number(tenant.settings?.taxRate || 0)}
        taxLabel={tenant.settings?.taxLabel || "VAT"}
        locations={toPlain(locations)}
        defaultLocationId={ctx.locationId ? String(ctx.locationId) : ""}
        allowCredit={hasFeature(session.plan, "customerBalances")}
      />
    </>
  );
}
