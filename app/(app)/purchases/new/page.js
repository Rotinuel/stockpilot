import { requireTenantSession, sessionCan } from "@/lib/session";
import { allSuppliersLite } from "@/services/suppliers";
import { listLocations } from "@/services/locations";
import { hasFeature } from "@/lib/plans";
import { toPlain } from "@/lib/serialize";
import { PageHeader } from "@/components/ui/Misc";
import { ReadOnlyNotice } from "@/components/layout/Banners";
import PurchaseForm from "@/components/purchases/PurchaseForm";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Record purchase" };

export default async function NewPurchasePage() {
  const session = await requireTenantSession();
  if (!sessionCan(session, "purchases:create")) return <AccessDenied />;
  const { ctx } = session;
  const [suppliers, locations] = await Promise.all([allSuppliersLite(ctx), listLocations(ctx, { activeOnly: true })]);
  return (
    <>
      <PageHeader back={{ href: "/purchases", label: "Purchases" }} title="Record a purchase" description="Receive stock from a supplier. Inventory and supplier balances update automatically." />
      <ReadOnlyNotice access={session.access} />
      {session.access.canWrite ? <PurchaseForm suppliers={toPlain(suppliers)} locations={toPlain(locations)} currency={ctx.currency} allowBalance={hasFeature(session.plan, "supplierBalances")} /> : null}
    </>
  );
}
