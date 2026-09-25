import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import Location from "../models/Location.js";
import Tenant from "../models/Tenant.js";
import { byId, scoped } from "./_scope.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { assignableRoles, canManageUser } from "../lib/rbac.js";
import { ROLE_LABELS } from "../lib/constants.js";
import { createToken } from "../lib/auth/tokens.js";
import { sendInvitationEmail, isEmailConfigured } from "../lib/email.js";
import { assertCanAddStaff } from "./limits.js";
import { logAudit } from "./audit.js";

export async function listStaff(ctx) {
  const [users, invitations] = await Promise.all([
    User.find(scoped(ctx)).sort({ role: 1, name: 1 }).select("name email phone role isActive lastLoginAt createdAt avatar defaultLocationId emailVerified").lean(),
    Invitation.find(scoped(ctx, { status: "pending" })).sort({ createdAt: -1 }).lean(),
  ]);
  return {
    users,
    invitations: invitations.map((i) => ({ ...i, expired: new Date(i.expiresAt) < new Date() })),
  };
}

export async function inviteStaff(ctx, data, request) {
  if (!assignableRoles(ctx.role).includes(data.role)) throw forbidden(`You cannot invite someone as ${ROLE_LABELS[data.role]}.`);
  const email = data.email.toLowerCase();
  if (await User.exists({ email })) throw conflict("A StockPilot user with this email already exists.", { email: "Already registered" });
  if (await Invitation.exists(scoped(ctx, { email, status: "pending", expiresAt: { $gt: new Date() } }))) {
    throw conflict("An invitation is already pending for this email.", { email: "Invitation pending" });
  }
  await assertCanAddStaff(ctx);
  if (data.locationId && !(await Location.exists(byId(ctx, data.locationId)))) throw badRequest("Location not found.");

  const { token, hash } = createToken();
  const invite = await Invitation.create({
    tenantId: ctx.tenantId,
    email,
    name: data.name,
    role: data.role,
    locationId: data.locationId || undefined,
    tokenHash: hash,
    invitedBy: ctx.userId,
    invitedByName: ctx.userName,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });
  const tenant = await Tenant.findById(ctx.tenantId).select("businessName").lean();
  const mail = await sendInvitationEmail({ email, businessName: tenant.businessName, inviterName: ctx.userName, role: ROLE_LABELS[data.role], token });
  await logAudit(ctx, "staff.invite", { entity: "Invitation", entityId: invite._id, metadata: { email, role: data.role }, request });
  return {
    invitation: { _id: invite._id, email, role: invite.role, expiresAt: invite.expiresAt },
    // Shown to the inviter so they can share it manually (e.g. WhatsApp) — useful when email isn't configured.
    inviteLink: mail.link,
    emailSent: Boolean(mail.delivered),
    emailConfigured: isEmailConfigured(),
  };
}

export async function revokeInvitation(ctx, id, request) {
  const invite = await Invitation.findOneAndUpdate(byId(ctx, id, { status: "pending" }), { $set: { status: "revoked" } }, { new: true }).lean();
  if (!invite) throw notFound("Invitation not found.");
  await logAudit(ctx, "staff.invite_revoke", { entity: "Invitation", entityId: invite._id, metadata: { email: invite.email }, request });
  return { ok: true };
}

export async function updateStaff(ctx, id, data, request) {
  const target = await User.findOne(byId(ctx, id)).lean();
  if (!target) throw notFound("Staff member not found.");
  const actor = { _id: ctx.userId, role: ctx.role, tenantId: ctx.tenantId };
  if (!canManageUser(actor, target)) throw forbidden("You cannot change this user's account.");

  const $set = {};
  const $inc = {};
  if (data.role !== undefined && data.role !== target.role) {
    if (!assignableRoles(ctx.role).includes(data.role)) throw forbidden(`You cannot assign the ${ROLE_LABELS[data.role]} role.`);
    $set.role = data.role;
    $inc.tokenVersion = 1; // force a fresh session with the new role
  }
  if (data.isActive !== undefined && data.isActive !== target.isActive) {
    if (data.isActive) await assertCanAddStaff(ctx);
    $set.isActive = data.isActive;
    if (!data.isActive) $inc.tokenVersion = 1; // sign the user out immediately
  }
  if (data.defaultLocationId !== undefined) {
    if (data.defaultLocationId && !(await Location.exists(byId(ctx, data.defaultLocationId)))) throw badRequest("Location not found.");
    $set.defaultLocationId = data.defaultLocationId || null;
  }
  if (!Object.keys($set).length) return target;
  const update = { $set };
  if (Object.keys($inc).length) update.$inc = $inc;
  const user = await User.findOneAndUpdate(byId(ctx, id), update, { new: true }).select("name email role isActive").lean();
  if ($set.role) {
    await logAudit(ctx, "staff.role_change", { entity: "User", entityId: user._id, metadata: { email: user.email, from: target.role, to: $set.role }, request });
  }
  if ($set.isActive !== undefined) {
    await logAudit(ctx, $set.isActive ? "staff.activate" : "staff.deactivate", { entity: "User", entityId: user._id, metadata: { email: user.email }, request });
  }
  return user;
}
