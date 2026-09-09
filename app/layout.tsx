import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import TopBar from "./components/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ),
  title: {
    default: "DVCLC | Coachella Valley Homeschool Co-op",
    template: "%s | DVCLC",
  },
  description:
    "Desert Valley Creative Learning Collaborative is a Coachella Valley homeschool co-op offering academics, electives, community, and parent-led learning.",
  keywords: [
    "Coachella Valley homeschool co-op",
    "homeschool collaborative",
    "homeschool classes",
    "Desert Valley Creative Learning Collaborative",
  ],
  applicationName: "DVCLC",
  authors: [{ name: "Desert Valley Creative Learning Collaborative" }],
  creator: "Desert Valley Creative Learning Collaborative",
  publisher: "Desert Valley Creative Learning Collaborative",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Desert Valley Creative Learning Collaborative",
    title: "DVCLC | Coachella Valley Homeschool Co-op",
    description:
      "A Coachella Valley homeschool co-op built around academics, creativity, community, and parent-led learning.",
    images: [{ url: "/images/hero-home.jpg", width: 1400, height: 1050, alt: "Students learning together in a bright homeschool classroom" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DVCLC | Coachella Valley Homeschool Co-op",
    description:
      "A Coachella Valley homeschool co-op built around academics, creativity, community, and parent-led learning.",
    images: ["/images/hero-home.jpg"],
  },
  robots: { index: true, follow: true },
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon-96x96.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <TopBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
