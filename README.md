# StockPilot

**Run your shop smarter. Know your stock. Know your numbers.**

StockPilot is a multi-tenant SaaS inventory, POS and business-management platform for small and medium-sized retail shops (supermarkets, provision stores, pharmacies, boutiques…). Each business gets an isolated workspace to manage products and stock, sell through a simple POS, track customers, suppliers, purchases and expenses, see real profit, and subscribe to a paid plan through **Paystack**. The platform owner runs everything from a separate **Super Admin** area.

---

## Contents

1. [Features](#features)
2. [Technology stack](#technology-stack)
3. [Quick start](#quick-start)
4. [Environment variables](#environment-variables)
5. [MongoDB setup](#mongodb-setup)
6. [Paystack setup](#paystack-setup)
7. [Seed data & demo logins](#seed-data--demo-logins)
8. [Commands](#commands)
9. [Deployment](#deployment)
10. [Architecture](#architecture)
11. [Multi-tenancy](#multi-tenancy)
12. [RBAC (roles & permissions)](#rbac-roles--permissions)
13. [Subscription architecture](#subscription-architecture)
14. [Webhooks](#webhooks)
15. [Cron / scheduled jobs](#cron--scheduled-jobs)
16. [Security](#security)
17. [Testing](#testing)
18. [Project structure](#project-structure)

---

## Features

**For businesses (tenants)**

- Registration → business workspace, owner account, default location and a **7-day free trial** (no card needed), then a 6-step onboarding wizard (skippable steps).
- **Products**: SKU (auto-generated if blank), barcode, category, brand, cost/selling price, units (piece, pack, carton, bottle, kg, g, litre, metre…), low-stock level, supplier, image, status. Search, filter, sort, server-side pagination, **CSV import/export**.
- **Inventory**: per-location stock, immutable movement ledger (opening stock, purchase, sale, adjustment, return, damage, transfer) with before/after quantities, reason and user. Stock is never changed without a movement.
- **Low-stock**: dashboard widget, sidebar badge, dedicated page with suggested reorder quantities, optional notifications.
- **POS**: product grid + search, barcode/SKU scan-and-Enter, cart with quantity controls, discount (₦ or %), tax, split tender/change, 5 payment methods, credit sales to customers, printable receipt, double-submit protection.
- **Sales**: list/filter, receipt view/print, cancellation that reverses stock and customer balances.
- **Purchases**: receive stock from suppliers, optionally update cost/selling prices, part-payments → supplier balance.
- **Customers & suppliers**: profiles, purchase history, outstanding balances, FIFO payment allocation, payment history.
- **Expenses** by category with charts.
- **Dashboard**: today's/monthly sales and profit, product/customer/supplier counts, balances, recent sales/purchases, charts (sales & profit over time, top products, payment methods, expenses by category).
- **Reports**: Sales, Inventory, Profit & Loss (gross vs net clearly separated), Expenses, Customers — presets (today, yesterday, this week, this month, …) or custom ranges; **CSV and PDF export**.
- **Staff**: invite by email or shareable link, roles, activate/deactivate, role changes (forces re-login).
- **Locations** (multi-branch on Professional), stock transfers between locations.
- **Billing**: current plan, trial countdown, status, next billing date, usage vs limits, payment history, subscribe/upgrade/downgrade/cancel/resume with confirmation dialogs, update card.
- **Notifications** (in-app + optional email), **audit logs**, business & personal settings.

**For the platform owner (`/super-admin`)**

- Metrics: total/active businesses, trials, expired trials, active subscriptions, **MRR/ARR**, total revenue, failed payments, new registrations, cancellations/churn, revenue & registration charts.
- Businesses: search/filter, details (usage, users, payments, activity), **suspend/activate**, extend trial, set plan manually (offline payments).
- Users, subscriptions, payments, platform audit log.
- **Plans & pricing** (stored in MongoDB — nothing hard-coded), limits and feature flags, Paystack plan sync.
- Global settings: grace period, registrations on/off, support contacts, banner announcement, broadcast notifications.

## Technology stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router, Server Components by default, `proxy.js`) |
| Language | **JavaScript only** (no TypeScript anywhere) |
| Runtime / package manager | **Bun** |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`, `@theme` tokens) |
| Database | **MongoDB** + **Mongoose 8** |
| Payments | **Paystack** (transactions, plans, subscriptions, webhooks) |
| Auth | JWT (HS256 via `jose`) in an HTTP-only cookie + DB-backed session validation, `bcryptjs` |
| Validation | `zod` |
| Icons | `lucide-react` |
| Charts | Lightweight in-house SVG charts (no chart dependency) |
| PDF export | `pdf-lib` (server-side) |

## Quick start

Prerequisites: **Bun ≥ 1.1**, **Node.js ≥ 20.9** (used by Next.js), a **MongoDB** database (Atlas free tier works).

```bash
bun install
cp .env.example .env.local        # then fill in MONGODB_URI and JWT_SECRET at minimum
bun run seed                      # plans, super admin, demo businesses
bun run dev                       # http://localhost:3000
```

Generate a JWT secret:

```bash
bun -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Environment variables

See `.env.example` for the full, commented list.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | ≥32 random characters; signs session tokens |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL (links in emails, Paystack callback, sitemap) |
| `SESSION_DAYS` | | Session lifetime (default 7) |
| `PAYSTACK_SECRET_KEY` | for billing | Paystack secret key (server only) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | optional | Public key (not required by the redirect checkout flow; safe to expose) |
| `PAYSTACK_WEBHOOK_SECRET` | optional | Key used to verify webhook HMAC. Paystack signs with your **secret key**, so leave empty unless you proxy webhooks |
| `PAYSTACK_ENFORCE_IP_WHITELIST` | optional | `true` → only accept webhooks from Paystack's IPs |
| `CRON_SECRET` | for cron | Bearer token for `/api/cron/*` |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Transactional email. Without it, emails (verification, reset, invites) are printed to the server log and invite links are shown in the UI |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME` | seed | First super admin |
| `MONGODB_URI_TEST` | tests | Throw-away database for integration tests |

Only variables prefixed with `NEXT_PUBLIC_` are ever sent to the browser. MongoDB credentials, JWT, Paystack and cron secrets are read exclusively in server code (route handlers, server components, services, `proxy.js`). `bun run check` fails if a client component references one of them.

## MongoDB setup

- **Atlas (recommended)**: create a free cluster → Database Access (user) → Network Access (allow your IP / `0.0.0.0/0` for serverless hosts) → copy the `mongodb+srv://…` string into `MONGODB_URI` (add `/stockpilot` as the DB name).
- **Local**: `mongod` works as-is. For full transaction support run a single-node replica set:
  ```bash
  mongod --replSet rs0 --dbpath ./data
  mongosh --eval 'rs.initiate()'
  # MONGODB_URI=mongodb://127.0.0.1:27017/stockpilot?replicaSet=rs0
  ```
- **Transactions**: sales, purchases, cancellations, stock adjustments and registration run inside multi-document transactions when the server is a replica set/Atlas. On a standalone server the same code path uses **compensating writes** (every write registers an undo step that runs if a later step fails) and conditional atomic updates (`quantity >= n`) so stock can never go negative. Production should use a replica set.
- **Indexes** are declared on every model (tenant-scoped compound indexes such as `{tenantId, sku}` unique, `{tenantId, createdAt}`, `{tenantId, invoiceNumber}` unique, `{tenantId, barcode}` partial unique, `{email}` unique). `bun run seed` creates them explicitly; in development Mongoose auto-indexes. In production set `MONGODB_AUTO_INDEX=true` once or run the seed.

## Paystack setup

1. Create a Paystack account → **Settings → API Keys & Webhooks**.
2. Put the **secret key** in `PAYSTACK_SECRET_KEY` (use `sk_test_…` in development).
3. Set the **Webhook URL** to `https://YOUR_DOMAIN/api/paystack/webhook`.
4. Set the **Callback URL** (optional — the app passes it per transaction) to `https://YOUR_DOMAIN/billing/callback`.
5. Sign in as super admin → **Plans & pricing** → click **Create on Paystack** for each paid plan (or just let the first checkout create it automatically). The Paystack `plan_code` is stored on the plan.
6. For local webhook testing use a tunnel (e.g. `ngrok http 3000`, `cloudflared tunnel`) and put the tunnel URL in the Paystack dashboard.

Test cards: see Paystack's docs (e.g. `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`).

## Seed data & demo logins

`bun run seed` is idempotent (safe to re-run; it never overwrites prices a super admin changed). `bun run seed:reset` deletes and recreates **only the two demo businesses**.

| Who | Email | Password |
| --- | --- | --- |
| Super admin | `SUPER_ADMIN_EMAIL` (default `admin@stockpilot.ng`) | `SUPER_ADMIN_PASSWORD` (or a generated one printed by the seed) |
| Demo owner (Professional plan) | `demo@stockpilot.ng` | `Demo@12345` |
| Demo manager | `manager@stockpilot.ng` | `Demo@12345` |
| Demo cashier | `cashier@stockpilot.ng` | `Demo@12345` |
| Demo inventory staff | `stock@stockpilot.ng` | `Demo@12345` |
| Trial shop owner (3 days left) | `trial@stockpilot.ng` | `Demo@12345` |

The demo supermarket (“Mama Nkechi Supermarket”, Surulere, Lagos) has ~34 Nigerian products (Indomie, Golden Penny Spaghetti, Peak Milk, Milo, Coca-Cola, Pepsi, bread, rice, beans, vegetable oil…), 4 suppliers, 10 customers (some owing), 2 locations, ~60 days of consistent sales, purchases, stock movements, expenses, a cancelled sale and a damage adjustment. Stock quantities, balances and ledgers are simulated chronologically so every number reconciles.

**Can't sign in to a demo account?**

- Run `bun run seed` again — every run resets all demo passwords to `Demo@12345`, clears lockouts and re-creates the trial owner if it's missing. `bun run seed:reset` rebuilds both demo businesses from scratch.
- Five wrong passwords lock an account for 15 minutes (the seed clears this). Only *failed* sign-ins count towards the per-IP limit, so switching between demo roles is never blocked.
- You can open `/login` while signed in to switch accounts; it shows who you're currently signed in as.
- The trial shop's 7-day trial starts 4 days before the seed runs. If you seeded more than 3 days ago it will have expired: you can still sign in (read-only) — re-run `bun run seed:reset` to restart it.

> Change or remove the demo accounts before going live (`bun run seed:reset` only touches the demo businesses; delete them from the super admin panel or the database for production).

## Commands

```bash
bun install               # install dependencies
bun run dev               # development server (Turbopack)
bun run build             # production build
bun run start             # start the production server
bun run seed              # seed plans, settings, super admin, demo data
bun run seed:reset        # recreate the demo businesses
bun run create-super-admin -- admin@you.com "StrongPassw0rd" "Your Name"
bun run cron [task]       # run scheduled jobs once (all | trial-reminders | expire-trials | subscriptions | payments | sync-subscriptions | low-stock)
bun run check             # guard rails: JS only, proxy.js present, no middleware.js, no secrets in client code
bun test                  # = bun run test (unit tests, no database needed)
bun run test:integration  # needs MONGODB_URI_TEST (database is dropped!)
bun run test:e2e          # needs E2E_BASE_URL of a running server
```

## Deployment

### Vercel

1. Import the repository. Framework: Next.js. Install command: `bun install`. Build: `bun run build`.
2. Add environment variables (all from `.env.example`). Set `NEXT_PUBLIC_APP_URL` to your domain.
3. `vercel.json` registers a daily cron (`/api/cron/all`, 06:00 UTC). Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set. On Pro plans change the schedule to hourly (`0 * * * *`) for faster renewal/grace handling.
4. Point the Paystack webhook to `https://YOUR_DOMAIN/api/paystack/webhook`.
5. Run `bun run seed` once from your machine with the production `MONGODB_URI` (creates plans, indexes and the super admin), then delete the demo businesses if you don't want them.

### Any Node/Bun host (Render, Railway, Fly.io, VPS, Docker)

```bash
bun install            # commit the generated bun.lock, then use --frozen-lockfile in CI
bun run build
bun run start          # PORT env var is respected by Next.js
```

Use a process manager (systemd/pm2) or the platform's service config, put it behind HTTPS, and schedule the cron (below).

## Architecture

```
Browser ──► proxy.js (optimistic JWT check, redirects)
        ──► Server Components (pages) ──► services/* ──► Mongoose models ──► MongoDB
        ──► Client Components ──fetch──► app/api/*/route.js ──► lib/api.js withApi()
                                                             (auth → RBAC → tenant → subscription → plan feature)
                                                             ──► services/* ──► models
Paystack ──► /api/paystack/webhook (HMAC + idempotency + re-verification) ──► services/billing.js
Scheduler ──► /api/cron/<task> (Bearer CRON_SECRET) ──► services/cron.js
```

- **Server Components by default.** List pages read data directly through the service layer; filters/search/pagination are URL query params, so the server does the filtering and only the current page (20 rows) is fetched.
- **Client Components only for interactivity** (forms, modals, POS, charts' hover layer, debounced search inputs, dropdowns, toasts).
- **Mutations** go through REST route handlers wrapped by `withApi()`; the client then calls `router.refresh()` to re-render the server data.
- **Business logic lives in `services/`**, never in UI components. Models are in `models/`, cross-cutting helpers in `lib/` and `utils/`.

## Multi-tenancy

- Every business-owned document (products, stock, movements, sales, sale items, purchases, customers, suppliers, expenses, locations, notifications, audit logs, counters, payments, subscriptions, invitations, assets…) has a required, indexed `tenantId`.
- The tenant is **never taken from the client**. `lib/session.js` resolves the user from the HTTP-only session cookie, reloads the user and tenant from MongoDB, and builds a `ctx` object (`tenantId`, `userId`, `role`, `plan`, `access`, …).
- Services build every query with `scoped(ctx, filter)` / `byId(ctx, id)` (in `services/_scope.js`), which **append `tenantId: ctx.tenantId` last** so it can't be overridden, and throw if the context is missing. Unknown/foreign IDs return **404** (not 403) so IDs can't be probed.
- Writes copy `tenantId` from `ctx`, not from the request body (zod schemas also strip unknown keys like `tenantId`).
- Uniqueness is tenant-scoped (e.g. two shops can both use SKU `PEAK-400`; invoice numbers are per tenant).
- Uploaded images are only served to users of the owning tenant.
- The only cross-tenant queries live in `services/admin.js` and are reachable only through `withApi({ superAdmin: true })`.

## RBAC (roles & permissions)

Roles: `owner`, `admin`, `manager`, `cashier`, `inventory_staff` (+ platform `super_admin`). The permission matrix is in `lib/rbac.js` and is enforced **on every API route** (`withApi({ permission })`) and **every page** (`sessionCan()` → `AccessDenied`). The UI hides controls with the same function, but hiding is never relied upon.

| Capability | Owner | Admin | Manager | Cashier | Inventory staff |
| --- | :-: | :-: | :-: | :-: | :-: |
| POS / create sales | ✅ | ✅ | ✅ | ✅ | — |
| View products | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create / edit / delete products | ✅ | ✅ | ✅ | — | — |
| Adjust / transfer stock | ✅ | ✅ | ✅ | — | ✅ |
| Cancel sales | ✅ | ✅ | ✅ | — | — |
| See all sales (not just own) | ✅ | ✅ | ✅ | — | — |
| Customers (view / create) | ✅ | ✅ | ✅ | ✅ | — |
| Suppliers & purchases | ✅ | ✅ | ✅ | — | — |
| Expenses | ✅ | ✅ | — | — | — |
| Sales / profit / customer reports | ✅ | ✅ | ✅ | optional* | — |
| Inventory reports | ✅ | ✅ | ✅ | — | ✅ |
| Staff management | ✅ | ✅ (not admins/owner) | — | — | — |
| Billing (view) | ✅ | ✅ | — | — | — |
| Billing (subscribe, change, cancel) | ✅ | — | — | — | — |
| Business settings, audit logs | ✅ | ✅ | — | — | — |

\* The owner can allow cashiers to view the Sales report (never profit/expenses) in Settings → Notifications & permissions.

Nobody can create a second owner; admins can't manage other admins or the owner; users can't change their own role; role changes and deactivation invalidate the user's sessions immediately (`tokenVersion`).

## Subscription architecture

Plans (trial, starter, business, professional) live in the `subscriptionplans` collection with price, interval, **limits** (`products`, `staffUsers`, `locations`, `monthlyTransactions`, `-1` = unlimited) and **feature flags** (`expenses`, `advancedReports`, `profitAnalysis`, `lowStockAlerts`, `customerBalances`, `supplierBalances`, `export`, `auditLogs`, `multiLocation`, `prioritySupport`). Everything in the UI and API reads these values; super admins edit them without code changes.

Tenant state: `subscriptionPlan`, `subscriptionStatus` (`trialing | active | expired | cancelled | past_due`), `trialStartedAt`, `trialEndsAt`, `subscriptionStartDate`, `subscriptionEndDate`, `nextBillingDate`, `paystackCustomerCode`, `paystackSubscriptionCode`, grace-period fields. History is kept in `subscriptions` and `payments`.

`lib/access.js → computeAccess()` turns that state into `{ canRead, canWrite, daysLeft, severity, message }`. It's evaluated on every request, so access is correct even if a cron run is late.

```
NEW USER → 7-DAY TRIAL (full access)
   → reminders at 5 days (info), 3 days (warning), 1 day (urgent)
   → TRIAL EXPIRES → read-only + subscription screen (data preserved)
   → PAYSTACK CHECKOUT (server-initialised transaction with plan_code)
   → VERIFIED (callback page + charge.success webhook; both call GET /transaction/verify)
   → ACTIVE (period = interval from payment date)
   → RENEWAL (Paystack charges the saved card → charge.success → period extended)
   → PAYMENT FAILURE (invoice.payment_failed / charge failure / renewal not confirmed)
   → PAST_DUE + GRACE PERIOD (default 3 days, configurable; full access + urgent banner)
   → EXPIRED / READ-ONLY (never deleted; subscribe again at any time)
```

- **Limits are enforced server-side before creating resources** (`services/limits.js`): e.g. on Starter the 501st product returns *“You have reached your 500-product limit. Upgrade your plan to add more products.”* (HTTP 403, `PLAN_LIMIT`). Staff seats count pending invitations. Features are enforced with `withApi({ feature })` and inside services (credit sales, supplier balances, transfers, exports).
- **Read-only mode**: all mutating tenant endpoints use `withApi({ write: true })` → HTTP 402 `SUBSCRIPTION_REQUIRED`. Billing endpoints are intentionally exempt so expired tenants can pay. Pages remain readable; the POS shows a paused screen.
- **Upgrade**: charged immediately through Paystack; on success the previous Paystack subscription is disabled and the new billing period starts.
- **Downgrade**: validated against current usage (you can't downgrade to 500 products while holding 800), scheduled for the end of the paid period: the current Paystack subscription is disabled and a new subscription on the cheaper plan is created with `start_date` = period end using the saved authorization. If no reusable card exists, the tenant is asked to pay for the new plan when the period ends.
- **Cancel**: disables the Paystack subscription; full access until the period ends, then read-only. **Resume** re-enables it before the period ends.
- **Update card**: Paystack's hosted “manage subscription” link.
- **Payment status is never trusted from the browser.** The callback page only sends the `reference`; the server verifies it with Paystack, checks the amount/currency and that the payment belongs to the caller's tenant.

## Webhooks

`POST /api/paystack/webhook`

1. Reads the **raw body** and verifies `x-paystack-signature` = HMAC-SHA512(raw body, secret key) with a constant-time comparison. Invalid → 401.
2. Optional IP allow-list (`PAYSTACK_ENFORCE_IP_WHITELIST=true`).
3. **Idempotency**: each event is hashed into `webhookevents` (unique index); duplicates are acknowledged without re-processing; failures return 500 so Paystack retries.
4. Charges are **re-verified** with `GET /transaction/verify/:reference` before any access is granted.

Handled events: `charge.success` (first payment, upgrades, **renewals**), `subscription.create`, `subscription.disable`, `subscription.not_renew`, `invoice.create`, `invoice.update`, `invoice.payment_failed`, `charge.failed`.

## Cron / scheduled jobs

`services/cron.js` contains idempotent jobs:

| Task | What it does |
| --- | --- |
| `trial-reminders` | In-app (+email) reminders at 5, 3 and 1 days left |
| `expire-trials` | Marks ended trials `expired` (read-only) and notifies |
| `subscriptions` | Applies scheduled downgrades; moves unrenewed `active` → `past_due` with grace; `past_due` past grace → `expired`; ended `cancelled` → `expired` |
| `payments` | Re-verifies pending Paystack payments older than 15 min; abandons ones older than 3 days |
| `sync-subscriptions` | Pulls subscription status/next payment date from Paystack |
| `low-stock` | Daily low-stock digest for plans with low-stock alerts |

Trigger options (all require `CRON_SECRET`):

```bash
# HTTP (Vercel Cron, GitHub Actions, cron-job.org, EasyCron, Render cron…)
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/cron/all
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/cron/trial-reminders

# Traditional crontab on a server (hourly)
0 * * * * cd /srv/stockpilot && bun run cron all >> /var/log/stockpilot-cron.log 2>&1
```

Hourly is recommended; daily is sufficient because `computeAccess()` evaluates dates live on every request.

## Security

- Passwords hashed with bcrypt (cost 12); password policy; timing-safe login for unknown emails; account lock after 5 failed attempts (15 min).
- Sessions: signed JWT (HS256, issuer/audience/expiry) in an `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie. Every request re-checks the user in MongoDB (`isActive`, `tokenVersion`), so deactivation, password resets, role changes and “sign out other devices” revoke sessions instantly.
- `proxy.js` (Next.js 16) performs optimistic redirects only; **authoritative checks run on the server for every page and API route**.
- CSRF: SameSite cookies + `Origin`/`Sec-Fetch-Site` validation on all state-changing API requests.
- Input validation with zod on every body/query; strings are coerced so operator-injection objects never reach MongoDB; user search terms are regex-escaped.
- IDOR protection via tenant-scoped queries and 404s for foreign IDs; server-side prices at checkout (POS prices are recalculated from the database).
- Rate limiting (login, registration, password reset, checkout, uploads) with a pluggable store (`lib/rate-limit.js` — swap the in-memory store for Redis/Upstash when running several instances).
- Secure webhook verification, constant-time cron secret comparison, uploads validated by magic bytes and size, security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS in production), `noindex` on app pages.
- Errors: known errors return friendly messages with a code; unknown errors are logged server-side and returned as a generic 500 — raw database errors never reach users.

## Testing

See [`docs/TESTING.md`](docs/TESTING.md) for the full strategy.

- **Unit** (`tests/unit`, no DB): RBAC matrix, trial/subscription access rules, reminders, cart/tax/profit maths, plan limits & feature gating, CSV (incl. formula injection), timezone date ranges, Paystack signature verification.
- **Integration** (`tests/integration`, real MongoDB): registration + exact 7-day trial, **cross-tenant access attempts** (read/update/delete/sell/adjust another tenant's product, customer, supplier, sale), plan limits, sales reduce stock with movements, atomic failure on insufficient stock, credit-sale feature gating, cancellation reversal, idempotent POS submissions, purchases increase stock and supplier balances, stock adjustments, trial expiry cron, Paystack checkout → verified webhook activation (idempotent), payment failure → past_due grace.
- **End-to-end** (`tests/e2e`, running server): proxy redirects, 401s, CSRF, IDOR over HTTP, ignored client `tenantId`, invited cashier RBAC, stock changes via API, feature gating, webhook/cron secrets, validation errors, logout.

## Project structure

```
app/
  (auth)/            login, register, forgot/reset password, verify email, accept invite
  (app)/             tenant app: dashboard, products, inventory, pos, sales, purchases, customers,
                     suppliers, expenses, reports, staff, locations, billing, settings, notifications, audit-logs
  onboarding/        6-step setup wizard
  super-admin/       platform owner area
  api/               REST route handlers (auth, products, inventory, sales, purchases, customers,
                     suppliers, expenses, reports, staff, locations, subscriptions, payments, plans,
                     paystack/webhook, cron, assets, admin/*, health)
  page.js            marketing landing page · robots.js · sitemap.js · opengraph-image.js
components/          ui/ (Button, Field, Card, Modal, Toast, Confirm, Dropdown, Tabs, Pagination…),
                     layout/, charts/, landing/, pos/, products/, inventory/, sales/, purchases/,
                     parties/, expenses/, staff/, billing/, settings/, onboarding/, admin/
hooks/               useApi (fetch + toasts), useDebounce
lib/                 db, session, api wrapper, rbac, access (subscription rules), plans, money,
                     validators (zod), paystack client, email, rate limit, errors, auth/*
models/              25 Mongoose models (User, Tenant, SubscriptionPlan, Subscription, Payment, Product,
                     ProductStock, Category, InventoryMovement, Sale, SaleItem, Purchase, PurchaseItem,
                     Customer, Supplier, Expense, BalancePayment, Location, Notification, AuditLog,
                     Invitation, Counter, Asset, WebhookEvent, PlatformSetting)
services/            business logic (tenant-scoped)
utils/               formatting, CSV, dates (timezone-aware), slug/regex helpers
scripts/             seed, create-super-admin, cron runner, project checks
tests/               unit/, integration/, e2e/
proxy.js             Next.js 16 request proxy (route protection)
```
# stockpilot
