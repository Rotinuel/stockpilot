import Link from "next/link";
import { cookies } from "next/headers";
import { GoogleSignupForm } from "@/components/auth/AuthForms";
import { GoogleIcon } from "@/components/auth/GoogleButton";
import { verifyPurposeToken } from "@/lib/auth/jwt";
import { GOOGLE_SIGNUP_COOKIE } from "@/lib/auth/google";
import ReferralNotice from "@/components/auth/ReferralNotice";
import { signupReferral } from "@/lib/referral-signup";

export const metadata = { title: "Finish signing up", robots: { index: false } };

export default async function GoogleSignupPage() {
  const store = await cookies();
  const referral = await signupReferral(null);
  const pending = await verifyPurposeToken(store.get(GOOGLE_SIGNUP_COOKIE)?.value, "google_signup");
  if (!pending) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign-up session expired</h1>
        <p className="mt-2 text-sm text-slate-500">Please continue with Google again to create your workspace.</p>
        <Link href="/register" className="mt-6 inline-block text-sm font-semibold text-brand-600">
          ← Back to sign up
        </Link>
      </>
    );
  }
  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
        <GoogleIcon className="h-4 w-4" /> Signed in with Google
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tell us about your business</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">One last step to create your workspace and start your 7-day free trial.</p>
      <ReferralNotice businessName={referral?.businessName} />
      <GoogleSignupForm name={pending.name} email={pending.email} referralCode={referral?.code || ""} />
    </>
  );
}
