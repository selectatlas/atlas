import type { Metadata, Viewport } from 'next'
import { SITE_URL } from '@/lib/site'
import './globals.css'
import { PostHogAuthSync } from '@/components/analytics/PostHogAuthSync'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Atlas - AI Talent Discovery',
    template: '%s | Atlas',
  },
  description: 'Find the right creative talent with AI-native search.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Atlas',
    title: 'Atlas - AI Talent Discovery',
    description: 'Find the right creative talent with AI-native search.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atlas - AI Talent Discovery',
    description: 'Find the right creative talent with AI-native search.',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Atlas',
  },
}

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full">
        <PostHogAuthSync />
        {children}
      </body>
    </html>
  )
}
