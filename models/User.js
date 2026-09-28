import { ALL_ROLES } from "../lib/constants.js";
import { Schema, ObjectId, baseOptions, defineModel } from "./_helpers.js";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 32 },
    // Optional for accounts created with Google sign-in (they can set one later).
    password: {
      type: String,
      select: false,
      required: function () {
        return !this.googleId;
      },
    },
    googleId: { type: String, select: false },
    authProviders: { type: [String], default: ["password"] },
    role: { type: String, enum: ALL_ROLES, required: true, default: "owner" },
    // Super admins have no tenant; every other user belongs to exactly one tenant.
    tenantId: { type: ObjectId, ref: "Tenant", index: true, default: null },
    defaultLocationId: { type: ObjectId, ref: "Location", default: null },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // Incrementing this invalidates every issued session (logout everywhere / password change).
    tokenVersion: { type: Number, default: 0 },
    avatar: { type: String, default: "" },
    lastLoginAt: Date,
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
  },
  baseOptions,
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, role: 1 });
UserSchema.index({ tenantId: 1, isActive: 1 });
UserSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });
UserSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: "string" } } });
UserSchema.index({ emailVerificationTokenHash: 1 }, { sparse: true });

export default defineModel("User", UserSchema);
