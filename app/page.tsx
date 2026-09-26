import type { Metadata } from 'next'
import HomePageClient from './HomePageClient'
import { getSiteUrl } from '@/lib/site-url'

const title = 'DVCLC | Coachella Valley Homeschool Co-op'
const description = 'Desert Valley Creative Learning Collaborative is a Coachella Valley homeschool co-op offering academics, electives, community, and parent-led learning.'

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    title,
    description,
    images: [{ url: '/images/hero-home.jpg', width: 1400, height: 1050, alt: 'Students learning together in a bright homeschool classroom' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/images/hero-home.jpg'],
  },
  robots: { index: true, follow: true },
}

export default function HomePage() {
  const siteUrl = getSiteUrl()
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Desert Valley Creative Learning Collaborative',
    alternateName: 'DVCLC',
    url: siteUrl,
    logo: `${siteUrl}/web-app-manifest-512x512.png`,
    image: `${siteUrl}/images/hero-home.jpg`,
    description,
    foundingDate: '2011',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Indio',
      addressRegion: 'CA',
      addressCountry: 'US',
    },
    areaServed: 'Coachella Valley, California',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <HomePageClient />
    </>
  )
}
