import { VerifyEmail } from "@/components/auth/AuthForms";

export const metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">Email verification</h1>
      <VerifyEmail token={typeof token === "string" ? token : ""} />
    </>
  );
}
