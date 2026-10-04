import Link from "next/link";
import { RegisterForm } from "@/components/auth/AuthForms";
import GoogleButton, { AuthErrorNotice } from "@/components/auth/GoogleButton";
import { isGoogleConfigured } from "@/lib/auth/google";
import ReferralNotice from "@/components/auth/ReferralNotice";
import { signupReferral } from "@/lib/referral-signup";

export const metadata = { title: "Start your free trial", description: "Create your StockPilot workspace. 7 days free, no payment required." };

export default async function RegisterPage({ searchParams }) {
  const sp = await searchParams;
  const referral = await signupReferral(sp);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your workspace</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">7 days free. No payment required to start.</p>
      <ReferralNotice businessName={referral?.businessName} />
      <AuthErrorNotice code={typeof sp?.error === "string" ? sp.error : null} />
      {isGoogleConfigured() ? <GoogleButton mode="signup" /> : null}
      <RegisterForm referralCode={referral?.code || ""} />
      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
