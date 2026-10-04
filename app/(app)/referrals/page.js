import { Gift, Users, BadgeCheck, CalendarPlus, Wallet, Link2, Landmark, Info } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { getReferralOverview } from "@/services/referrals";
import { describeReward, rewardParts } from "@/lib/referrals";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/utils/format";
import { PageHeader, StatCard, Alert, TableCard, EmptyState } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ReferralLinkBox, PayoutForm } from "@/components/referrals/ReferralClient";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Refer & earn" };

const COMMISSION_LABEL = { owed: ["To be paid", "yellow"], paid: ["Paid", "green"], void: ["Cancelled", "gray"] };

export default async function ReferralsPage() {
  const session = await requireTenantSession();
  if (!sessionCan(session, "referrals:view")) return <AccessDenied />;
  const data = toPlain(await getReferralOverview(session.ctx));
  const { stats, settings } = data;
  const { days, percent } = rewardParts(settings);
  const rewardText = describeReward(settings);
  const currency = session.ctx.currency || "NGN";
  const showCommission = percent > 0 || stats.commissionOwed > 0 || stats.commissionPaid > 0;

  return (
    <>
      <PageHeader title="Refer & earn" description="Invite other businesses to StockPilot and get rewarded when they subscribe." />

      {!settings.enabled ? (
        <Alert tone="warning" icon={Info} className="mb-6" title="The referral programme is paused">
          New sign-ups through referral links aren&apos;t being counted right now. Businesses who already joined with your link still earn you a reward when they subscribe.
        </Alert>
      ) : null}
      {data.pendingCreditDays > 0 ? (
        <Alert tone="info" icon={CalendarPlus} className="mb-6" title={`${data.pendingCreditDays} free days waiting for you`}>
          They&apos;ll be added to your subscription as soon as it&apos;s active again.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Your referral link" icon={Link2} description="Share it with other business owners — by WhatsApp, SMS, email or on social media." />
          <CardBody>
            <ReferralLinkBox link={data.link} code={data.code} businessName={session.tenant.businessName} rewardText={settings.enabled ? rewardText : ""} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="How it works" icon={Gift} />
          <CardBody>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">1</span>
                Share your link with another business.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">2</span>
                They sign up and start their free trial.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">3</span>
                <span>
                  When they pay for their first subscription, you get <strong className="font-semibold text-slate-800">{rewardText}</strong>.
                </span>
              </li>
            </ol>
            {days > 0 ? <p className="mt-4 text-xs text-slate-500">Free days are added to your trial or paid plan automatically, and your next card charge moves back to match.</p> : null}
          </CardBody>
        </Card>
      </div>

      <div className={`mt-6 grid gap-4 sm:grid-cols-2 ${showCommission ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <StatCard label="Businesses signed up" value={stats.signedUp} icon={Users} />
        <StatCard label="Became paying customers" value={stats.paying} icon={BadgeCheck} tone="green" />
        <StatCard label="Free days earned" value={stats.daysEarned} icon={CalendarPlus} />
        {showCommission ? <StatCard label="Commission to be paid" value={formatMoney(stats.commissionOwed, currency)} hint={`${formatMoney(stats.commissionPaid, currency)} paid so far`} icon={Wallet} tone="yellow" /> : null}
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-slate-900">Businesses you referred</h2>
      {data.referrals.length ? (
        <TableCard>
          <table className="table-base">
            <thead>
              <tr>
                <th>Business</th>
                <th className="hidden sm:table-cell">Joined</th>
                <th>Status</th>
                <th className="text-right">Your reward</th>
              </tr>
            </thead>
            <tbody>
              {data.referrals.map((r) => (
                <tr key={r._id}>
                  <td className="font-medium text-slate-900">{r.businessName}</td>
                  <td className="hidden whitespace-nowrap text-slate-600 sm:table-cell">{formatDate(r.signedUpAt)}</td>
                  <td>
                    {r.status === "rewarded" ? (
                      <Badge tone="green">Subscribed {r.qualifiedAt ? formatDate(r.qualifiedAt) : ""}</Badge>
                    ) : r.status === "void" ? (
                      <Badge tone="gray">Not eligible</Badge>
                    ) : (
                      <Badge tone="blue">On free trial</Badge>
                    )}
                  </td>
                  <td className="text-right text-sm">
                    {r.status === "rewarded" ? (
                      <div className="space-y-0.5">
                        {r.rewardDays ? <p className="text-slate-800">{r.rewardDays} free days</p> : null}
                        {r.commissionAmount ? (
                          <p className="text-slate-800">
                            {formatMoney(r.commissionAmount, r.currency)}{" "}
                            {COMMISSION_LABEL[r.commissionStatus] ? <Badge tone={COMMISSION_LABEL[r.commissionStatus][1]}>{COMMISSION_LABEL[r.commissionStatus][0]}</Badge> : null}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Users} title="No referrals yet" description="Share your link — businesses who sign up with it will appear here." />
        </div>
      )}

      {showCommission ? (
        <Card className="mt-10">
          <CardHeader title="Payout details" icon={Landmark} description="Where we send your cash commission. Payouts are made by bank transfer." />
          <CardBody>
            <PayoutForm payout={data.payout} canEdit={sessionCan(session, "referrals:manage")} />
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
