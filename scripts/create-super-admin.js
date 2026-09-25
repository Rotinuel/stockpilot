#!/usr/bin/env bun
// Create (or reset the password of) a super admin.
//   bun run create-super-admin -- admin@yourdomain.com "StrongPassw0rd" "Your Name"
import { connectDB, disconnectDB } from "../lib/db.js";
import { hashPassword, passwordProblem } from "../lib/auth/password.js";
import User from "../models/User.js";

const [email = process.env.SUPER_ADMIN_EMAIL, password = process.env.SUPER_ADMIN_PASSWORD, name = process.env.SUPER_ADMIN_NAME || "Platform Admin"] = process.argv.slice(2);

async function main() {
  if (!email || !password) {
    console.error('Usage: bun run create-super-admin -- <email> <password> ["Name"]');
    process.exit(1);
  }
  const problem = passwordProblem(password);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  await connectDB();
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing && existing.role !== "super_admin") {
    console.error(`${email} belongs to a business account and cannot be promoted.`);
    process.exit(1);
  }
  const hash = await hashPassword(password);
  if (existing) {
    existing.password = hash;
    existing.isActive = true;
    existing.tokenVersion = (existing.tokenVersion || 0) + 1;
    await existing.save();
    console.log(`✓ Password reset for super admin ${email}`);
  } else {
    await User.create({ name, email, password: hash, role: "super_admin", tenantId: null, emailVerified: true });
    console.log(`✓ Super admin created: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
