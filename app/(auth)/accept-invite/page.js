import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/AuthForms";
import { getInvitationByToken } from "@/services/auth";

export const metadata = { title: "Accept invitation", robots: { index: false } };

export default async function AcceptInvitePage({ searchParams }) {
  const { token } = await searchParams;
  const invite = typeof token === "string" && token.length > 20 ? await getInvitationByToken(token) : null;
  if (!invite) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Invitation not found</h1>
        <p className="mt-2 text-sm text-slate-500">This invitation link is invalid or has expired. Ask the person who invited you to send a new one.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-brand-600">
          Go to sign in →
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Join {invite.businessName}</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        You've been invited as <strong>{invite.roleLabel}</strong>. Set up your account to get started.
      </p>
      <AcceptInviteForm token={token} invite={invite} />
    </>
  );
}
