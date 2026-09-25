import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  ChartColumn,
  ClipboardList,
  CreditCard,
  PackageSearch,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Store,
  Truck,
  Users,
  Wallet,
  CircleHelp,
  Quote,
} from "lucide-react";
import Logo from "@/components/layout/Logo";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-brand-50/70 via-white to-white pt-16 pb-20 sm:pt-24">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700">
          <Store className="h-3.5 w-3.5" /> Built for supermarkets, provision stores, pharmacies & boutiques
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Run your shop smarter. <span className="text-brand-600">Know your stock. Know your numbers.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          StockPilot shows you what you have in stock, what you have sold, what you have spent, what customers owe you, and how your business is performing — from your laptop, tablet or phone.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700">
            Start Your 7-Day Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#pricing" className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-50">
            View Pricing
          </a>
        </div>
        <p className="mt-4 text-sm text-slate-500">No payment required to start your 7-day trial.</p>
      </div>
    </section>
  );
}

export function Problem() {
  const items = [
    { title: "Stock disappears without explanation", text: "Paper books and memory can't tell you which items were sold, damaged or missing." },
    { title: "You don't know your real profit", text: "Sales feel good, but after rent, fuel and salaries it's hard to know if you actually made money." },
    { title: "Debts are scattered everywhere", text: "Customers who buy on credit and suppliers you owe are tracked in notebooks and WhatsApp chats." },
  ];
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-brand-600">The problem</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Most shops run on guesswork</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((i) => (
            <div key={i.title} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
              <h3 className="font-semibold text-slate-900">{i.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{i.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Boxes, title: "Products & inventory", text: "SKUs, barcodes, units, categories and a full stock history for every item — nothing changes silently." },
  { icon: ShoppingCart, title: "Fast POS", text: "Scan or search, apply discounts and tax, take cash, POS, card or transfer, and print receipts." },
  { icon: PackageSearch, title: "Low-stock alerts", text: "See what's running low before it runs out, with a dedicated restock list." },
  { icon: Truck, title: "Suppliers & purchases", text: "Record deliveries, update cost prices and track exactly how much you owe each supplier." },
  { icon: Users, title: "Customers & credit", text: "Purchase history, outstanding balances and part-payments for your credit customers." },
  { icon: Wallet, title: "Expenses", text: "Rent, electricity, diesel, salaries — see where your money goes each month." },
  { icon: ChartColumn, title: "Reports & profit", text: "Revenue, cost of goods, gross and net profit, with CSV and PDF exports." },
  { icon: ShieldCheck, title: "Staff roles", text: "Owners, admins, managers, cashiers and inventory staff each see only what they should." },
  { icon: Smartphone, title: "Works on any device", text: "Responsive on desktop, tablet and mobile — use it at the counter or on the go." },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-brand-600">Features</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Everything your shop needs, in one place</h2>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { icon: Store, title: "Create your workspace", text: "Register your business in under two minutes. Your 7-day free trial starts immediately." },
    { icon: ClipboardList, title: "Add your products", text: "Type them in or import a CSV. Set opening stock, prices and reorder levels." },
    { icon: Receipt, title: "Start selling", text: "Use the POS for every sale. Stock, customer balances and reports update automatically." },
    { icon: CreditCard, title: "Choose a plan", text: "When your trial ends, subscribe securely through Paystack. Your data stays intact." },
  ];
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-brand-600">How it works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Up and running today</h2>
        </div>
        <ol className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="text-xs font-semibold text-brand-600">Step {i + 1}</span>
              <div className="mt-2 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="font-semibold text-slate-900">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-brand-600">Customer stories</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Stories from shop owners — coming soon</h2>
          <p className="mt-3 text-slate-600">We're collecting feedback from our first businesses. Want to share yours? Email us after your first month.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-slate-400">
              <Quote className="h-6 w-6" />
              <p className="mt-3 text-sm">Your story could be here.</p>
              <div className="mt-4 h-3 w-24 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  ["Do I need a card to start the free trial?", "No. Your 7-day trial starts as soon as you register and no payment details are required."],
  ["What happens when my trial ends?", "Your account becomes read-only: you can still sign in and view your products, sales and reports, but you'll need to subscribe to record new sales or stock changes. Nothing is deleted."],
  ["How do payments work?", "Subscriptions are billed through Paystack. You can pay with card, and Paystack handles renewals automatically. You can upgrade, downgrade or cancel from the Billing page."],
  ["Can my staff use it?", "Yes. Invite staff as admins, managers, cashiers or inventory staff. Each role only sees what it needs — cashiers can't delete products or see your profit reports, for example."],
  ["Is my data separate from other businesses?", "Yes. Every business has its own isolated workspace, and every request is checked on the server against your account."],
  ["Can I import my existing products?", "Yes — upload a CSV with your product names, prices and quantities, or add them one by one."],
  ["Does it work on my phone?", "Yes. StockPilot works in any modern browser on phones, tablets and computers."],
];

export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold text-brand-600">FAQ</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Questions, answered</h2>
        </div>
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-slate-900">
                <span className="inline-flex items-center gap-2">
                  <CircleHelp className="h-4 w-4 shrink-0 text-brand-500" />
                  {q}
                </span>
                <span className="text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 pl-6 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="bg-white pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-950 via-brand-800 to-brand-600 px-6 py-14 text-center sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Take control of your shop this week</h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-100">Set up in minutes. Try every feature free for 7 days.</p>
          <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-brand-700 hover:bg-brand-50">
            Start Your 7-Day Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-sm text-brand-200">No payment required to start your 7-day trial.</p>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:justify-between lg:px-8">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-slate-500">Inventory, POS and business reports for small and medium retail shops.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold text-slate-900">Product</p>
            <ul className="mt-3 space-y-2 text-slate-500">
              <li><a href="#features" className="hover:text-slate-900">Features</a></li>
              <li><a href="#pricing" className="hover:text-slate-900">Pricing</a></li>
              <li><a href="#faq" className="hover:text-slate-900">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Account</p>
            <ul className="mt-3 space-y-2 text-slate-500">
              <li><Link href="/register" className="hover:text-slate-900">Start free trial</Link></li>
              <li><Link href="/login" className="hover:text-slate-900">Sign in</Link></li>
              <li><Link href="/forgot-password" className="hover:text-slate-900">Reset password</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} StockPilot. All rights reserved.</div>
    </footer>
  );
}
