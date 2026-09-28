import { test, expect } from "bun:test";
import { productUpdateSchema } from "../../lib/validators.js";
import { paystackStatus } from "../../lib/paystack.js";
test("image urls", () => {
  expect(productUpdateSchema.safeParse({ image: "/api/assets/0123456789abcdef01234567" }).success).toBe(true);
  expect(productUpdateSchema.safeParse({ image: "" }).success).toBe(true);
  expect(productUpdateSchema.safeParse({ image: null }).data.image).toBe("");
  expect(productUpdateSchema.safeParse({ image: "https://cdn.example.com/a.jpg" }).success).toBe(true);
  expect(productUpdateSchema.safeParse({ image: "javascript:alert(1)" }).success).toBe(false);
  expect(productUpdateSchema.safeParse({ image: "/api/assets/../x" }).success).toBe(false);
});
test("paystack status", () => {
  const saved = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;
  expect(paystackStatus().configured).toBe(false);
  process.env.PAYSTACK_SECRET_KEY = "pk_test_abc";
  expect(paystackStatus().problem).toMatch(/public key/);
  process.env.PAYSTACK_SECRET_KEY = " sk_test_abc123 ";
  expect(paystackStatus()).toEqual({ configured: true, mode: "test", problem: null });
  process.env.PAYSTACK_SECRET_KEY = "sk_live_x1";
  expect(paystackStatus().mode).toBe("live");
  if (saved === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = saved;
});
