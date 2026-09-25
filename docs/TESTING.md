# StockPilot testing strategy

Three layers, all run with Bun's built-in test runner (`bun test`).

| Layer | Folder | Needs | Command |
| --- | --- | --- | --- |
| Unit | `tests/unit` | nothing | `bun test` / `bun run test` |
| Integration (services + MongoDB) | `tests/integration` | `MONGODB_URI_TEST` (database is **dropped**) | `bun run test:integration` |
| End-to-end (HTTP) | `tests/e2e` | a running server, `E2E_BASE_URL` | `bun run test:e2e` |

Integration and e2e suites are automatically **skipped** when their environment variable is missing, so `bun test` is always safe to run in CI.

```bash
# Integration — ideally a replica set so the transactional code path runs
MONGODB_URI_TEST="mongodb://127.0.0.1:27017/stockpilot_test?replicaSet=rs0" bun run test:integration

# E2E — against dev or a production build
bun run dev &
E2E_BASE_URL=http://localhost:3000 bun run test:e2e
```

## Coverage by requirement

| Area | Unit | Integration | E2E |
| --- | --- | --- | --- |
| Authentication | JWT-free rules (password policy via validators) | register, duplicate email, login success/failure | session cookie, 401s, logout, proxy redirect |
| **Tenant isolation** | `scoped()` requires tenant context | B cannot get/update/delete/adjust/sell A's product; A's customers, suppliers, sales are 404 for B; list queries exclude foreign data | IDOR over HTTP (GET/PATCH/DELETE → 404), client-supplied `tenantId` ignored |
| RBAC | full permission matrix, role assignment, `canManageUser` | — | invited cashier: POS allowed; delete product, profit report, staff, billing, cancel sale → 403 |
| Product creation | SKU/CSV helpers | opening stock movement | create via API, 422 validation details |
| Inventory updates | — | set/damage adjustments create movements, no negative stock | stock reduced after API sale |
| Sales | cart/tax/discount/profit/settlement maths | stock reduction + movement, atomic failure, credit sale gating, cancel reversal, idempotent `clientRequestId` | cashier sale total |
| Purchases | — | stock increase, cost price update, supplier balance, FIFO supplier payment | — |
| Subscription lifecycle | trial/active/past_due/grace/cancelled/expired/suspended rules | checkout → verified webhook → active; failure → past_due + grace | trial state from `/api/auth/me` |
| Trial expiration | exactly 7 days, reminder schedule (5/3/1) | cron marks expired, data preserved, read-only | — |
| Paystack webhook | HMAC verification, tampering, event keys | idempotent processing, amount verification, cross-tenant reference rejected | invalid signature → 401 |
| Plan limits | `withinLimit`, messages, downgrade violations, report feature gating | 3rd product on a 2-product plan → `PLAN_LIMIT` with exact message | trial plan expenses → `PLAN_FEATURE` |
| Cron security | — | — | missing secret → 401 |

## Manual QA checklist (before release)

1. `bun install && bun run check && bun test && bun run build` all succeed.
2. `bun run seed`, sign in as `demo@stockpilot.ng`: dashboard charts render, low-stock badge shows, reports export CSV/PDF.
3. POS: scan/type a SKU + Enter adds to cart; complete a cash sale with change; print receipt; complete a credit sale for a credit customer; cancel it from the sale page and confirm stock returns.
4. Sign in as `cashier@stockpilot.ng`: no Billing/Staff/Expenses in the sidebar; visiting `/billing` shows *Access restricted*; `/pos` works.
5. Sign in as `trial@stockpilot.ng`: trial banner shows "3 days" warning. In Mongo set `trialEndsAt` to the past → app becomes read-only, POS paused, billing screen shown, data still visible.
6. Billing (Paystack test keys + tunnel for webhooks): subscribe, confirm callback activates the plan, webhook logged in `webhookevents`; upgrade; schedule a downgrade; cancel and resume.
7. Super admin: suspend a business (its users are signed out and see the suspended screen), reactivate, change a plan price (Paystack plan updated), send an announcement.
8. Mobile widths (360px, 768px): sidebar drawer, POS cart sheet, tables scroll horizontally.
