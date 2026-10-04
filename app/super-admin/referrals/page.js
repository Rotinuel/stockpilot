import Link from "next/link";
import { requireSuperAdminSession } from "@/lib/session";
import { listReferralsAdmin } from "@/services/referrals";
import { getPlatformSettings } from "@/services/platform";
import { describeReward } from "@/lib/referrals";
import { pageParams, str } from "@/lib/query";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/utils/format";
import { PageHeader, TableCard, StatCard, EmptyState } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { FilterSelect } from "@/components/ui/UrlFilters";
import ReferralActions from "@/components/admin/ReferralActions";

export const metadata = { title: "Referrals" };

const STATUS = { signed_up: ["On trial", "blue"], rewarded: ["Subscribed", "green"], void: ["Void", "gray"] };
const COMMISSION = { owed: ["Owed", "yellow"], paid: ["Paid", "green"], void: ["Cancelled", "gray"], none: ["—", "gray"] };

export default async function AdminReferralsPage({ searchParams }) {
  await requireSuperAdminSession();
  const sp = await searchParams;
  const [data, platform] = await Promise.all([
    listReferralsAdmin({ ...pageParams(sp, 25), commission: str(sp, "commission"), status: str(sp, "status") }),
    getPlatformSettings(),
  ]);
  const items = toPlain(data.items);
  const s = data.summary;
  return (
    <>
      <PageHeader
        title="Referrals"
        description={platform.referral?.enabled ? `Current reward: ${describeReward(platform.referral)}.` : "The referral programme is switched off."}
        actions={
          <Button href="/super-admin/settings" variant="outline">
            Reward settings
          </Button>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Referred businesses" value={s.total} />
        <StatCard label="Became paying" value={s.rewarded} tone="green" />
        <StatCard label="Commission owed" value={formatMoney(s.owed, "NGN")} hint={`${s.owedCount} to pay out`} tone="yellow" href="/super-admin/referrals?commission=owed" />
        <StatCard label="Commission paid" value={formatMoney(s.paid, "NGN")} />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <FilterSelect param="commission" placeholder="Any commission" options={[{ value: "owed", label: "Owed" }, { value: "paid", label: "Paid" }, { value: "void", label: "Cancelled" }, { value: "none", label: "No commission" }]} />
        <FilterSelect param="status" placeholder="Any status" options={[{ value: "signed_up", label: "On trial" }, { value: "rewarded", label: "Subscribed" }, { value: "void", label: "Void" }]} />
      </div>
      <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/super-admin/referrals" searchParams={sp} label="referrals" />}>
        {items.length ? (
          <table className="table-base">
            <thead>
              <tr>
                <th>Joined</th>
                <th>Referred by</th>
                <th>New business</th>
                <th>Status</th>
                <th className="hidden text-right md:table-cell">First payment</th>
                <th className="text-right">Reward</th>
                <th className="w-40">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r._id}>
                  <td className="whitespace-nowrap text-slate-600">{formatDate(r.signedUpAt || r.createdAt)}</td>
                  <td>
                    <Link href={`/super-admin/tenants/${r.referrerTenantId}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {r.referrerName}
                    </Link>
                    <p className="font-mono text-xs text-slate-400">{r.code}</p>
                  </td>
                  <td>
                    <Link href={`/super-admin/tenants/${r.referredTenantId}`} className="text-slate-700 hover:text-brand-700">
                      {r.referredName}
                    </Link>
                  </td>
                  <td>
                    <Badge tone={STATUS[r.status]?.[1]}>{STATUS[r.status]?.[0] || r.status}</Badge>
                    {r.voidReason ? <p className="max-w-40 truncate text-xs text-slate-500">{r.voidReason}</p> : null}
                  </td>
                  <td className="hidden text-right tabular-nums md:table-cell">{r.paymentAmount ? formatMoney(r.paymentAmount, r.currency) : "—"}</td>
                  <td className="text-right text-sm">
                    {r.rewardDays ? <p>{r.rewardDays} days</p> : null}
                    {r.commissionAmount ? (
                      <p className="tabular-nums">
                        {formatMoney(r.commissionAmount, r.currency)} <Badge tone={COMMISSION[r.commissionStatus]?.[1]}>{COMMISSION[r.commissionStatus]?.[0]}</Badge>
                      </p>
                    ) : null}
                    {!r.rewardDays && !r.commissionAmount ? <span className="text-slate-400">—</span> : null}
                    {r.payoutNote ? <p className="max-w-40 truncate text-xs text-slate-500 ml-auto">{r.payoutNote}</p> : null}
                  </td>
                  <td>
                    <ReferralActions referral={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No referrals yet" description="Businesses that sign up with a referral link appear here." />
        )}
      </TableCard>
    </>
  );
}
