import "./globals.css";
import Providers from "@/components/providers";
import ServiceWorkerRegister from "@/components/offline/ServiceWorkerRegister";
import { INSTALL_CAPTURE_SCRIPT } from "@/components/offline/InstallApp";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "StockPilot — Inventory, POS & sales for retail shops",
    template: "%s · StockPilot",
  },
  description:
    "StockPilot helps small retail businesses know what they have in stock, what they have sold, what they have spent, what they are owed, and how the business is performing. Start a 3-day free trial.",
  applicationName: "StockPilot",
  manifest: "/site.webmanifest",
  // iPhone/iPad "Add to Home Screen": open full-screen with our icon and name.
  appleWebApp: { capable: true, title: "StockPilot", statusBarStyle: "default" },
  keywords: ["inventory management", "POS", "retail", "Nigeria", "stock management", "sales tracking", "small business"],
  openGraph: {
    type: "website",
    siteName: "StockPilot",
    title: "StockPilot — Run your shop smarter",
    description: "Know your stock. Know your numbers. Inventory, POS, customers, suppliers, expenses and reports in one place.",
    url: appUrl,
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: "StockPilot — Run your shop smarter",
    description: "Inventory, POS and business reports for retail shops. 3-day free trial.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, password managers, translators, dark-mode
    // tools…) add attributes to <html>/<body> before React loads. This only ignores attribute
    // differences on these two tags — mismatches anywhere inside the app are still reported.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Catch the browser's "install app" event even if it fires before React has loaded. */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
