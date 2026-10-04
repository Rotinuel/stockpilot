import { Gift } from "lucide-react";

/** "Invited by …" note on the sign-up pages (server component). */
export default function ReferralNotice({ businessName }) {
  if (!businessName) return null;
  return (
    <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
      <Gift className="h-4 w-4 shrink-0" />
      <span>
        You were invited by <strong className="font-semibold">{businessName}</strong>.
      </span>
    </div>
  );
}
