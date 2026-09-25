import "./globals.css";
import Providers from "@/components/providers";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "StockPilot — Inventory, POS & sales for retail shops",
    template: "%s · StockPilot",
  },
  description:
    "StockPilot helps small retail businesses know what they have in stock, what they have sold, what they have spent, what they are owed, and how the business is performing. Start a 7-day free trial.",
  applicationName: "StockPilot",
  manifest: "/site.webmanifest",
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
    description: "Inventory, POS and business reports for retail shops. 7-day free trial.",
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
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
