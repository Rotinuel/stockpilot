import Navbar from "@/components/landing/Navbar";
import DashboardPreview from "@/components/landing/DashboardPreview";
import Pricing from "@/components/landing/Pricing";
import { Hero, Problem, Features, HowItWorks, Testimonials, FAQ, CTA, Footer } from "@/components/landing/Sections";
import { headers } from "next/headers";
import { getPublicPlans } from "@/services/plans";
import { billingCurrencyFor, planPrice } from "@/lib/pricing";
import { TRIAL_DAYS } from "@/lib/constants";

// Plans come from MongoDB (configurable by the Super Admin).
export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "StockPilot — Inventory, POS & sales software for retail shops" },
  description:
    "Run your shop smarter. Track stock, record sales with a simple POS, manage customers, suppliers and expenses, and see your real profit. Start a 3-day free trial — no payment required.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const plans = (await getPublicPlans()).map(({ paystackPlanCode, paystackPlanCodes, ...p }) => ({ ...p, _id: String(p._id), createdAt: undefined, updatedAt: undefined }));
  // Show Naira to visitors in Nigeria and US dollars elsewhere (country from the hosting provider's
  // geo header when available; Nigeria otherwise). Visitors can switch on the page.
  const h = await headers();
  const visitorCountry = (h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || h.get("x-country-code") || "NG").toUpperCase();
  const defaultCurrency = billingCurrencyFor(visitorCountry);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "StockPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Inventory management, POS and reporting for small and medium retail shops.",
    offers: plans
      .filter((p) => !p.isTrial)
      .flatMap((p) => [
        { "@type": "Offer", name: `${p.name} (monthly)`, price: p.price, priceCurrency: "NGN" },
        ...(p.usdPrice ? [{ "@type": "Offer", name: `${p.name} (monthly, USD)`, price: p.usdPrice, priceCurrency: "USD" }] : []),
        { "@type": "Offer", name: `${p.name} (yearly)`, price: planPrice(p, "NGN", "annually"), priceCurrency: "NGN" },
      ]),
  };
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <div className="-mt-6 bg-white px-4 pb-20 sm:px-6 lg:px-8">
          <DashboardPreview />
        </div>
        <Problem />
        <Features />
        <HowItWorks />
        <Pricing plans={JSON.parse(JSON.stringify(plans))} defaultCurrency={defaultCurrency} trialDays={TRIAL_DAYS} />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
