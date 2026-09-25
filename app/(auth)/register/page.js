import Link from "next/link";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Start your free trial", description: "Create your StockPilot workspace. 7 days free, no payment required." };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your workspace</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">7 days free. No payment required to start.</p>
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
