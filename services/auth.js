import mongoose from "mongoose";
import { connectDB, withTransaction, Compensation } from "../lib/db.js";
import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import Location from "../models/Location.js";
import Subscription from "../models/Subscription.js";
import Invitation from "../models/Invitation.js";
import { hashPassword, verifyPassword } from "../lib/auth/password.js";
import { createToken, hashToken } from "../lib/auth/tokens.js";
import { signSessionToken } from "../lib/auth/jwt.js";
import { trialWindow } from "../lib/access.js";
import { COUNTRIES, ROLE_LABELS } from "../lib/constants.js";
import { ApiError, badRequest, conflict, forbidden, unauthorized, validationError } from "../lib/errors.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/email.js";
import { slugify } from "../utils/slug.js";
import { normalizePhone } from "../lib/phone.js";
import { getTrialPlan } from "./plans.js";
import { getPlatformSettings } from "./platform.js";
import { logAudit } from "./audit.js";
import { notify } from "./notifications.js";
import { sessionOpts } from "./_scope.js";
import { attachReferral } from "./referrals.js";

const MAX_FAILED_LOGINS = 5;
let dummyHashPromise = null;
const dummyHash = () => (dummyHashPromise ??= hashPassword("not-a-real-password-0"));
const LOCK_MINUTES = 15;

export async function issueSessionToken(user) {
  return signSessionToken({ sub: String(user._id), tid: user.tenantId ? String(user.tenantId) : null, role: user.role, tv: user.tokenVersion || 0 });
}

async function uniqueSlug(name) {
  const base = slugify(name);
  if (!(await Tenant.exists({ slug: base }))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await Tenant.exists({ slug: candidate }))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Registration: create user + tenant, make the user the owner, start the
 * 7-day trial on the trial plan, create the default location.
 */
export async function registerBusiness(data, request) {
  await connectDB();
  const platform = await getPlatformSettings();
  if (!platform.allowRegistrations) throw forbidden("New registrations are temporarily paused. Please try again later.");

  const email = data.email.toLowerCase();
  if (await User.exists({ email })) throw conflict("An account with this email already exists. Try signing in instead.", { email: "Already registered" });

  const trialPlan = await getTrialPlan();
  const slug = await uniqueSlug(data.businessName);
  const now = new Date();
  const { trialStartedAt, trialEndsAt } = trialWindow(now);
  const country = COUNTRIES.find((c) => c.code === data.country || c.name === data.country) || COUNTRIES[0];
  // The phone number doubles as the business WhatsApp number for alerts.
  const phoneE164 = normalizePhone(data.phone, country.code);
  if (!phoneE164) throw validationError({ phone: "Enter a valid phone number, e.g. 0803 123 4567" });
  const whatsappOptIn = data.whatsappOptIn !== false;
  // Password sign-up hashes the password; Google sign-up has a verified email and no password.
  const google = data.google || null;
  const passwordHash = data.password ? await hashPassword(data.password) : undefined;
  if (!passwordHash && !google?.sub) throw badRequest("A password is required.");
  const verification = createToken();

  const userId = new mongoose.Types.ObjectId();
  const tenantId = new mongoose.Types.ObjectId();

  await withTransaction(async (session) => {
    const comp = new Compensation(!session);
    const opts = sessionOpts(session);
    try {
      await Tenant.create(
        [
          {
            _id: tenantId,
            businessName: data.businessName,
            slug,
            ownerId: userId,
            email,
            phone: phoneE164,
            whatsappNumber: phoneE164,
            settings: { whatsappNotifications: whatsappOptIn },
            country: country.code,
            currency: country.currency,
            businessType: data.businessType,
            subscriptionPlan: trialPlan._id || undefined,
            subscriptionPlanCode: trialPlan.code || "trial",
            subscriptionStatus: "trialing",
            trialStartedAt,
            trialEndsAt,
            onboarding: { completed: false, step: 1 },
          },
        ],
        opts,
      );
      comp.add(() => Tenant.deleteOne({ _id: tenantId }));

      await User.create(
        [
          {
            _id: userId,
            name: data.ownerName,
            email,
            phone: phoneE164,
            password: passwordHash,
            googleId: google?.sub,
            authProviders: google ? ["google"] : ["password"],
            avatar: google?.picture || "",
            role: "owner",
            tenantId,
            isActive: true,
            emailVerified: Boolean(google),
            ...(google ? {} : { emailVerificationTokenHash: verification.hash, emailVerificationExpires: new Date(now.getTime() + 48 * 3600 * 1000) }),
          },
        ],
        opts,
      );
      comp.add(() => User.deleteOne({ _id: userId }));

      const [location] = await Location.create([{ tenantId, name: "Main Store", isDefault: true, isActive: true, phone: phoneE164 }], opts);
      comp.add(() => Location.deleteOne({ _id: location._id }));
      await User.updateOne({ _id: userId }, { $set: { defaultLocationId: location._id } }, opts);

      if (trialPlan._id) {
        await Subscription.create(
          [
            {
              tenantId,
              planId: trialPlan._id,
              planCode: trialPlan.code,
              status: "trialing",
              amount: 0,
              currency: trialPlan.currency || "NGN",
              currentPeriodStart: trialStartedAt,
              currentPeriodEnd: trialEndsAt,
              changeType: "new",
              createdBy: userId,
            },
          ],
          opts,
        );
      }
    } catch (err) {
      await comp.rollback();
      if (err?.code === 11000) throw conflict("An account with this email already exists.", { email: "Already registered" });
      throw err;
    }
  });

  const user = await User.findById(userId).lean();
  const tenant = await Tenant.findById(tenantId).lean();
  if (data.referralCode) await attachReferral({ tenantId, code: data.referralCode, email, phone: phoneE164, request });
  if (!google) await sendVerificationEmail(user, verification.token);
  await logAudit({ tenantId, userId, userName: user.name, role: "owner" }, "auth.register", { entity: "Tenant", entityId: tenantId, metadata: { businessName: tenant.businessName, provider: google ? "google" : "password" }, request });
  await notify({
    tenantId,
    type: "trial_ending",
    severity: "info",
    title: "Welcome to StockPilot! Your 7-day free trial has started",
    message: "Add your products, record sales and explore every feature. No payment is required during your trial.",
    link: "/billing",
    dedupeKey: `welcome:${tenantId}`,
    whatsapp: whatsappOptIn,
  });
  return { user, tenant, token: await issueSessionToken(user) };
}

export async function login({ email, password }, request) {
  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password +failedLoginAttempts +lockedUntil").lean();
  const genericError = unauthorized("Incorrect email or password.");
  if (!user) {
    await verifyPassword(password, await dummyHash()); // timing parity: don't reveal unknown emails
    throw genericError;
  }
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw new ApiError(423, "Too many failed attempts. Your account is locked for a few minutes — try again later or reset your password.", "ACCOUNT_LOCKED");
  }
  if (!user.password) {
    throw new ApiError(400, "This account signs in with Google. Use “Continue with Google”, or reset your password to add one.", "USE_GOOGLE");
  }
  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const update = { failedLoginAttempts: attempts };
    if (attempts >= MAX_FAILED_LOGINS) {
      update.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      update.failedLoginAttempts = 0;
    }
    await User.updateOne({ _id: user._id }, { $set: update });
    throw genericError;
  }
  if (!user.isActive) throw forbidden("Your account has been deactivated. Contact your business owner.", "ACCOUNT_DISABLED");

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), failedLoginAttempts: 0 }, $unset: { lockedUntil: 1 } });
  await logAudit({ tenantId: user.tenantId, userId: user._id, userName: user.name, role: user.role }, "auth.login", { entity: "User", entityId: user._id, request });
  return { user, token: await issueSessionToken(user) };
}

export async function requestPasswordReset(email) {
  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).lean();
  if (!user) return { ok: true }; // never reveal whether an email exists
  const { token, hash } = createToken();
  await User.updateOne({ _id: user._id }, { $set: { passwordResetTokenHash: hash, passwordResetExpires: new Date(Date.now() + 3600 * 1000) } });
  await sendPasswordResetEmail(user, token);
  return { ok: true };
}

export async function resetPassword({ token, password }, request) {
  await connectDB();
  const user = await User.findOne({ passwordResetTokenHash: hashToken(token), passwordResetExpires: { $gt: new Date() } }).lean();
  if (!user) throw badRequest("This reset link is invalid or has expired. Please request a new one.");
  await User.updateOne(
    { _id: user._id },
    {
      $set: { password: await hashPassword(password), emailVerified: true, failedLoginAttempts: 0 },
      $addToSet: { authProviders: "password" },
      $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1, lockedUntil: 1 },
      $inc: { tokenVersion: 1 }, // sign out all existing sessions
    },
  );
  await logAudit({ tenantId: user.tenantId, userId: user._id, userName: user.name, role: user.role }, "auth.password_reset", { entity: "User", entityId: user._id, request });
  return { ok: true };
}

export async function verifyEmail(token) {
  await connectDB();
  const user = await User.findOneAndUpdate(
    { emailVerificationTokenHash: hashToken(token), emailVerificationExpires: { $gt: new Date() } },
    { $set: { emailVerified: true }, $unset: { emailVerificationTokenHash: 1, emailVerificationExpires: 1 } },
    { new: true },
  ).lean();
  if (!user) throw badRequest("This verification link is invalid or has expired.");
  return { ok: true, email: user.email };
}

export async function resendVerification(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw unauthorized();
  if (user.emailVerified) return { ok: true, alreadyVerified: true };
  const { token, hash } = createToken();
  await User.updateOne({ _id: user._id }, { $set: { emailVerificationTokenHash: hash, emailVerificationExpires: new Date(Date.now() + 48 * 3600 * 1000) } });
  await sendVerificationEmail(user, token);
  return { ok: true };
}

export async function getInvitationByToken(token) {
  await connectDB();
  const invite = await Invitation.findOne({ tokenHash: hashToken(token), status: "pending", expiresAt: { $gt: new Date() } }).lean();
  if (!invite) return null;
  const tenant = await Tenant.findById(invite.tenantId).select("businessName logo").lean();
  return { email: invite.email, name: invite.name, role: invite.role, roleLabel: ROLE_LABELS[invite.role], businessName: tenant?.businessName || "" };
}

export async function acceptInvitation({ token, name, phone, password }, request) {
  await connectDB();
  const invite = await Invitation.findOne({ tokenHash: hashToken(token), status: "pending", expiresAt: { $gt: new Date() } }).lean();
  if (!invite) throw badRequest("This invitation is invalid or has expired. Ask your manager to send a new one.");
  if (await User.exists({ email: invite.email })) throw conflict("An account with this email already exists. Sign in instead, or ask for an invite to a different email.");
  const tenant = await Tenant.findById(invite.tenantId).lean();
  if (!tenant || tenant.status === "suspended") throw forbidden("This business is not accepting new staff right now.");

  const user = await User.create({
    name,
    email: invite.email,
    phone,
    password: await hashPassword(password),
    role: invite.role,
    tenantId: invite.tenantId,
    defaultLocationId: invite.locationId || null,
    isActive: true,
    emailVerified: true, // they received the invite at this address
  });
  await Invitation.updateOne({ _id: invite._id }, { $set: { status: "accepted", acceptedAt: new Date() } });
  await logAudit({ tenantId: invite.tenantId, userId: user._id, userName: user.name, role: user.role }, "staff.join", {
    entity: "User",
    entityId: user._id,
    metadata: { role: user.role, email: user.email },
    request,
  });
  await notify({
    tenantId: invite.tenantId,
    roles: ["owner", "admin"],
    type: "staff_invitation",
    severity: "success",
    title: `${user.name} joined your team`,
    message: `${user.name} accepted the invitation as ${ROLE_LABELS[user.role]}.`,
    link: "/staff",
  });
  const lean = user.toObject();
  return { user: lean, token: await issueSessionToken(lean) };
}

export async function changePassword(userId, { currentPassword, newPassword }, request) {
  const user = await User.findById(userId).select("+password").lean();
  if (!user) throw unauthorized();
  // Google-only accounts have no password yet: they can set one without a current password.
  if (user.password && !(await verifyPassword(currentPassword || "", user.password))) {
    throw badRequest("Your current password is incorrect.", { currentPassword: "Incorrect password" });
  }
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { password: await hashPassword(newPassword) }, $addToSet: { authProviders: "password" }, $inc: { tokenVersion: 1 } },
    { new: true },
  ).lean();
  await logAudit({ tenantId: user.tenantId, userId: user._id, userName: user.name, role: user.role }, "auth.password_change", { entity: "User", entityId: user._id, request });
  return { token: await issueSessionToken(updated) };
}

export async function logoutEverywhere(userId) {
  const updated = await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true }).lean();
  return { token: await issueSessionToken(updated) };
}

/**
 * Sign in with a VERIFIED Google identity ({sub, email, email_verified, name, picture}).
 * Returns { status: "signed_in", user, token } or { status: "needs_signup" } for new people.
 * Existing email/password accounts are linked automatically (Google has verified the email).
 */
export async function signInWithGoogle(identity, request) {
  await connectDB();
  if (!identity?.sub || !identity.email || identity.email_verified !== true) {
    throw badRequest("Your Google account email is not verified.");
  }
  const email = identity.email.toLowerCase();
  let user = await User.findOne({ googleId: identity.sub }).select("+googleId").lean();
  if (!user) user = await User.findOne({ email }).select("+googleId").lean();
  if (!user) return { status: "needs_signup" };

  if (user.role === "super_admin") {
    throw forbidden("Platform administrators must sign in with email and password.", "USE_PASSWORD");
  }
  if (user.googleId && user.googleId !== identity.sub) {
    throw forbidden("This email is linked to a different Google account.", "GOOGLE_MISMATCH");
  }
  if (!user.isActive) throw forbidden("Your account has been deactivated. Contact your business owner.", "ACCOUNT_DISABLED");

  const $set = { lastLoginAt: new Date(), failedLoginAttempts: 0, emailVerified: true };
  if (!user.googleId) $set.googleId = identity.sub;
  if (!user.avatar && identity.picture) $set.avatar = identity.picture;
  await User.updateOne({ _id: user._id }, { $set, $addToSet: { authProviders: "google" }, $unset: { lockedUntil: 1, emailVerificationTokenHash: 1, emailVerificationExpires: 1 } });
  await logAudit({ tenantId: user.tenantId, userId: user._id, userName: user.name, role: user.role }, "auth.login", {
    entity: "User",
    entityId: user._id,
    metadata: { provider: "google", linked: !user.googleId },
    request,
  });
  return { status: "signed_in", user, token: await issueSessionToken(user) };
}
