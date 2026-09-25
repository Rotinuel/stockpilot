import { ResetPasswordForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">You'll be signed out of all other devices.</p>
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </>
  );
}
