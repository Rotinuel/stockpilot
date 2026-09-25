export default function robots() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register"],
        disallow: ["/api/", "/dashboard", "/super-admin", "/onboarding", "/billing", "/settings", "/pos", "/products", "/inventory", "/sales", "/purchases", "/customers", "/suppliers", "/expenses", "/reports", "/staff", "/locations"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
