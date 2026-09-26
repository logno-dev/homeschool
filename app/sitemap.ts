import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-url"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl()

  return [
    { url: baseUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.8 },
  ]
}
