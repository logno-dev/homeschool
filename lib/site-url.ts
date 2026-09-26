const FALLBACK_SITE_URL = 'http://localhost:3000'

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  const siteUrl = configuredUrl
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : FALLBACK_SITE_URL)

  return siteUrl.replace(/\/$/, '')
}
