import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about"],
      disallow: ["/admin/", "/account/", "/api/", "/dashboard", "/family/", "/registration/", "/schedule", "/teacher/", "/signup", "/signin", "/forgot-password", "/reset-password"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
