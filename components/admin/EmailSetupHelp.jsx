// Setup instructions for the built-in mailer (server component: plain text, no secrets).
const PRESETS = [
  { name: "Gmail / Google Workspace", host: "smtp.gmail.com", port: "465", note: "Turn on 2-Step Verification, then create an App Password (Google Account → Security → App passwords). Use it as SMTP_PASS." },
  { name: "Email from your domain host (cPanel, Namecheap, Hostinger…)", host: "mail.yourdomain.com", port: "465", note: "Use the mailbox address and its password. Your host's email settings page shows the exact server name." },
  { name: "Zoho Mail", host: "smtp.zoho.com", port: "465", note: "SMTP access depends on your Zoho plan. Use smtp.zoho.eu / smtp.zoho.in if your account is in that region, and an app-specific password if 2FA is on." },
];

export default function EmailSetupHelp() {
  return (
    <details className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
      <summary className="cursor-pointer font-semibold text-slate-900">How to set up email</summary>
      <p className="mt-3">
        StockPilot has a built-in mailer: it signs in to an ordinary mailbox and sends through it. Add these to your environment variables (Vercel → Project → Settings → Environment Variables, or <code>.env</code> locally), then redeploy:
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=yourshop@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="StockPilot <yourshop@gmail.com>"`}</pre>
      <ul className="mt-3 space-y-2">
        {PRESETS.map((p) => (
          <li key={p.name}>
            <strong>{p.name}:</strong> <code>{p.host}</code>, port <code>{p.port}</code>. {p.note}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Use port 465 (or 587). Port 25 is blocked on most hosting. The sender in EMAIL_FROM should be the mailbox you sign in with (or an alias it&apos;s allowed to send as), otherwise emails may land in spam. The password is only read on the server — it is never shown here or sent to the browser.
      </p>
    </details>
  );
}
