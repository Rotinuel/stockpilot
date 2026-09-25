import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reset your password</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">Enter your email and we'll send you a link to choose a new password.</p>
      <ForgotPasswordForm />
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="font-medium text-slate-600 hover:text-slate-900">
          ← Back to sign in
        </Link>
      </p>
    </>
  );
}
