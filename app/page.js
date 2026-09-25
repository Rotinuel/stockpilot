import Navbar from "@/components/landing/Navbar";
import DashboardPreview from "@/components/landing/DashboardPreview";
import Pricing from "@/components/landing/Pricing";
import { Hero, Problem, Features, HowItWorks, Testimonials, FAQ, CTA, Footer } from "@/components/landing/Sections";
import { getPublicPlans } from "@/services/plans";

// Plans come from MongoDB (configurable by the Super Admin).
export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "StockPilot — Inventory, POS & sales software for retail shops" },
  description:
    "Run your shop smarter. Track stock, record sales with a simple POS, manage customers, suppliers and expenses, and see your real profit. Start a 7-day free trial — no payment required.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const plans = (await getPublicPlans()).map((p) => ({ ...p, _id: String(p._id), paystackPlanCode: undefined }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "StockPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Inventory management, POS and reporting for small and medium retail shops.",
    offers: plans
      .filter((p) => !p.isTrial)
      .map((p) => ({ "@type": "Offer", name: p.name, price: p.price, priceCurrency: p.currency })),
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
        <Pricing plans={plans} />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
