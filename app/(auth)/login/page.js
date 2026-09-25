import Link from "next/link";
import { LoginForm } from "@/components/auth/AuthForms";
import { getSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/constants";

export const metadata = { title: "Sign in", description: "Sign in to your StockPilot account." };

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const next = typeof sp?.next === "string" ? sp.next : undefined;
  let current = null;
  try {
    current = await getSession();
  } catch {
    current = null;
  }
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">Sign in to manage your shop.</p>
      {current ? (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          You're already signed in as <strong>{current.user.email}</strong> ({ROLE_LABELS[current.user.role]}
          {current.tenant ? ` · ${current.tenant.businessName}` : ""}).{" "}
          <Link href={current.isSuperAdmin ? "/super-admin" : "/dashboard"} className="font-semibold underline">
            Continue
          </Link>{" "}
          or sign in below with a different account.
        </div>
      ) : null}
      <LoginForm next={next} />
      <p className="mt-8 text-center text-sm text-slate-500">
        New to StockPilot?{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
          Start your free trial
        </Link>
      </p>
    </>
  );
}
