"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CircleCheck, TriangleAlert } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, Input, Select, Checkbox } from "@/components/ui/Field";
import { apiFetch } from "@/hooks/useApi";
import { BUSINESS_TYPES, COUNTRIES } from "@/lib/constants";
import { rememberUser, lastUser } from "@/lib/last-user";

function PasswordInput({ id, value, onChange, error, autoComplete = "current-password", placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={onChange} error={error} autoComplete={autoComplete} placeholder={placeholder} className="pr-10" required />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Best guess of the visitor's country from the browser (language region, then timezone). */
function detectCountry() {
  try {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    for (const lang of navigator.languages || [navigator.language]) {
      const region = String(lang || "").split("-")[1]?.toUpperCase();
      if (region && codes.has(region)) return region;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz === "Africa/Lagos") return "NG";
  } catch {}
  return null;
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function phonePlaceholder(code) {
  if (code === "NG") return "0803 000 0000";
  const c = COUNTRIES.find((x) => x.code === code);
  return c?.dial ? `+${c.dial} …` : "+ country code and number";
}

/** Pre-select the visitor's country once (unless they already picked one). */
function useDetectedCountry(f) {
  useEffect(() => {
    const code = detectCountry();
    if (code) f.setValues((v) => (v.countryTouched ? v : { ...v, country: code }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function AlreadyRegistered({ email }) {
  return (
    <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
      You already have an account.{" "}
      <Link href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="font-semibold underline">
        Sign in instead
      </Link>
    </p>
  );
}

function FormError({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const bind = (key) => ({ id: key, value: values[key], onChange: (e) => setValues((v) => ({ ...v, [key]: e.target.value })), error: errors[key] });
  const submit = async (fn) => {
    setLoading(true);
    setError("");
    setErrors({});
    try {
      return await fn(values);
    } catch (err) {
      setError(err.message);
      if (err.details && typeof err.details === "object") setErrors(err.details);
    } finally {
      setLoading(false);
    }
  };
  return { values, setValues, errors, error, loading, bind, submit };
}

export function LoginForm({ next, email: initialEmail = "" }) {
  const router = useRouter();
  const f = useForm({ email: initialEmail, password: "" });
  const [known, setKnown] = useState(null);
  useEffect(() => {
    // Returning on this device: greet them and fill in their email.
    const last = lastUser();
    if (last?.email) {
      setKnown(last);
      if (!initialEmail) f.setValues((v) => (v.email ? v : { ...v, email: last.email }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await apiFetch("/api/auth/login", { method: "POST", body: { ...v, next } });
      rememberUser({ email: v.email, name: res.user?.name });
      router.replace(res.redirect || "/dashboard");
      router.refresh();
    });
  };
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {known?.name && known.email === f.values.email ? <p className="text-sm font-medium text-slate-700">Welcome back, {known.name.split(" ")[0]}.</p> : null}
      <FormError message={f.error} />
      <Field label="Email address" htmlFor="email" error={f.errors.email}>
        <Input type="email" autoComplete="email" placeholder="you@business.com" required {...f.bind("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={f.errors.password}>
        <PasswordInput {...f.bind("password")} />
      </Field>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" size="lg" loading={f.loading}>
        Sign in
      </Button>
    </form>
  );
}

export function RegisterForm({ referralCode = "" }) {
  const router = useRouter();
  const f = useForm({ businessName: "", ownerName: "", email: "", phone: "", password: "", country: "NG", businessType: "", whatsappOptIn: true });
  useDetectedCountry(f);
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async ({ countryTouched, ...v }) => {
      const res = await apiFetch("/api/auth/register", { method: "POST", body: { ...v, timezone: browserTimezone(), referralCode: referralCode || undefined } });
      rememberUser({ email: v.email, name: v.ownerName });
      router.replace(res.redirect || "/onboarding");
      router.refresh();
    });
  };
  const exists = f.errors.email === "Already registered";
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {exists ? <AlreadyRegistered email={f.values.email} /> : <FormError message={f.error} />}
      <Field label="Business name" htmlFor="businessName" error={f.errors.businessName} required>
        <Input placeholder="e.g. Mama Nkechi Supermarket" autoComplete="organization" required {...f.bind("businessName")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="ownerName" error={f.errors.ownerName} required>
          <Input autoComplete="name" required {...f.bind("ownerName")} />
        </Field>
        <Field label="WhatsApp phone number" htmlFor="phone" error={f.errors.phone} hint="For stock, trial and payment alerts" required>
          <Input type="tel" autoComplete="tel" inputMode="tel" placeholder={phonePlaceholder(f.values.country)} required {...f.bind("phone")} />
        </Field>
      </div>
      <Field label="Email address" htmlFor="email" error={f.errors.email} required>
        <Input type="email" autoComplete="email" required {...f.bind("email")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country" htmlFor="country" error={f.errors.country} required>
          <Select {...f.bind("country")} onChange={(e) => f.setValues((v) => ({ ...v, country: e.target.value, countryTouched: true }))}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Business type" htmlFor="businessType" error={f.errors.businessType} required>
          <Select {...f.bind("businessType")}>
            <option value="">Select…</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Password" htmlFor="password" error={f.errors.password} hint="At least 8 characters, with letters and numbers." required>
        <PasswordInput autoComplete="new-password" {...f.bind("password")} />
      </Field>
      <Checkbox
        checked={f.values.whatsappOptIn}
        onChange={(e) => f.setValues((v) => ({ ...v, whatsappOptIn: e.target.checked }))}
        label="Send me alerts on WhatsApp"
        description="Low stock, trial reminders and payment updates. You can turn this off in Settings."
      />
      <Button type="submit" className="w-full" size="lg" loading={f.loading}>
        Start my 3-day free trial
      </Button>
      <p className="text-center text-xs text-slate-500">No payment required. By continuing you agree to our terms of service.</p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const f = useForm({ email: "" });
  const [done, setDone] = useState("");
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await apiFetch("/api/auth/forgot-password", { method: "POST", body: v });
      setDone(res.message);
    });
  };
  if (done) return <SuccessBox message={done} action={<Link href="/login" className="font-medium text-brand-600">Back to sign in</Link>} />;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={f.error} />
      <Field label="Email address" htmlFor="email" error={f.errors.email}>
        <Input type="email" autoComplete="email" required {...f.bind("email")} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={f.loading}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }) {
  const router = useRouter();
  const f = useForm({ password: "", confirm: "" });
  const [done, setDone] = useState(false);
  const onSubmit = (e) => {
    e.preventDefault();
    if (f.values.password !== f.values.confirm) {
      f.submit(async () => {
        throw Object.assign(new Error("Passwords do not match."), { details: { confirm: "Passwords do not match" } });
      });
      return;
    }
    f.submit(async (v) => {
      await apiFetch("/api/auth/reset-password", { method: "POST", body: { token, password: v.password } });
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    });
  };
  if (!token) return <FormError message="This reset link is missing its token. Please request a new link." />;
  if (done) return <SuccessBox message="Your password has been reset. Redirecting you to sign in…" />;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={f.error} />
      <Field label="New password" htmlFor="password" error={f.errors.password} hint="At least 8 characters, with letters and numbers.">
        <PasswordInput autoComplete="new-password" {...f.bind("password")} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={f.errors.confirm}>
        <PasswordInput autoComplete="new-password" {...f.bind("confirm")} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={f.loading}>
        Reset password
      </Button>
    </form>
  );
}

export function VerifyEmail({ token }) {
  const [state, setState] = useState({ status: token ? "loading" : "error", message: token ? "" : "Verification token missing." });
  useEffect(() => {
    if (!token) return;
    apiFetch("/api/auth/verify-email", { method: "POST", body: { token } })
      .then(() => setState({ status: "ok", message: "Your email address has been verified." }))
      .catch((err) => setState({ status: "error", message: err.message }));
  }, [token]);
  if (state.status === "loading") return <p className="text-sm text-slate-500">Verifying your email…</p>;
  if (state.status === "ok") return <SuccessBox message={state.message} action={<Link href="/dashboard" className="font-medium text-brand-600">Continue to dashboard →</Link>} />;
  return <FormError message={state.message} />;
}

export function AcceptInviteForm({ token, invite }) {
  const router = useRouter();
  const f = useForm({ name: invite?.name || "", phone: "", password: "" });
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await apiFetch("/api/auth/accept-invite", { method: "POST", body: { ...v, token } });
      router.replace(res.redirect || "/dashboard");
      router.refresh();
    });
  };
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={f.error} />
      <Field label="Email">
        <Input value={invite.email} disabled readOnly />
      </Field>
      <Field label="Your name" htmlFor="name" error={f.errors.name}>
        <Input autoComplete="name" required {...f.bind("name")} />
      </Field>
      <Field label="Phone (optional)" htmlFor="phone" error={f.errors.phone}>
        <Input type="tel" autoComplete="tel" {...f.bind("phone")} />
      </Field>
      <Field label="Create a password" htmlFor="password" error={f.errors.password} hint="At least 8 characters, with letters and numbers.">
        <PasswordInput autoComplete="new-password" {...f.bind("password")} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={f.loading}>
        Join {invite.businessName}
      </Button>
    </form>
  );
}

function SuccessBox({ message, action }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      <p className="flex items-start gap-2">
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> {message}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function GoogleSignupForm({ name, email, referralCode = "" }) {
  const router = useRouter();
  const f = useForm({ ownerName: name || "", businessName: "", phone: "", country: "NG", businessType: "", whatsappOptIn: true });
  useDetectedCountry(f);
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async ({ countryTouched, ...v }) => {
      const res = await apiFetch("/api/auth/google/complete", { method: "POST", body: { ...v, timezone: browserTimezone(), referralCode: referralCode || undefined } });
      rememberUser({ email, name: v.ownerName });
      router.replace(res.redirect || "/onboarding");
      router.refresh();
    });
  };
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={f.error} />
      <Field label="Google account">
        <Input value={email} disabled readOnly />
      </Field>
      <Field label="Business name" htmlFor="businessName" error={f.errors.businessName} required>
        <Input placeholder="e.g. Mama Nkechi Supermarket" autoComplete="organization" required {...f.bind("businessName")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="ownerName" error={f.errors.ownerName} required>
          <Input autoComplete="name" required {...f.bind("ownerName")} />
        </Field>
        <Field label="WhatsApp phone number" htmlFor="phone" error={f.errors.phone} hint="For stock, trial and payment alerts" required>
          <Input type="tel" autoComplete="tel" inputMode="tel" placeholder={phonePlaceholder(f.values.country)} required {...f.bind("phone")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country" htmlFor="country" error={f.errors.country} required>
          <Select {...f.bind("country")} onChange={(e) => f.setValues((v) => ({ ...v, country: e.target.value, countryTouched: true }))}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Business type" htmlFor="businessType" error={f.errors.businessType} required>
          <Select {...f.bind("businessType")}>
            <option value="">Select…</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Checkbox
        checked={f.values.whatsappOptIn}
        onChange={(e) => f.setValues((v) => ({ ...v, whatsappOptIn: e.target.checked }))}
        label="Send me alerts on WhatsApp"
        description="Low stock, trial reminders and payment updates. You can turn this off in Settings."
      />
      <Button type="submit" className="w-full" size="lg" loading={f.loading}>
        Start my 3-day free trial
      </Button>
      <p className="text-center text-xs text-slate-500">No payment required. You'll sign in with Google — no password needed.</p>
    </form>
  );
}
