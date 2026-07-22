import type { Metadata, Viewport } from 'next'
import { SITE_URL } from '@/lib/site'
import './globals.css'
import { PostHogAuthSync } from '@/components/analytics/PostHogAuthSync'
import { Toaster } from '@/components/ui/sonner'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Atlas - AI Talent Search for the Creative Industry',
    template: '%s | Atlas',
  },
  description:
    'Describe the person your project needs and get a ranked shortlist in seconds. AI talent search for casting directors, producers, and creative teams.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Atlas',
    title: 'Atlas - AI Talent Search for the Creative Industry',
    description:
      'Describe the person your project needs and get a ranked shortlist in seconds. AI talent search for casting directors, producers, and creative teams.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atlas - AI Talent Search for the Creative Industry',
    description:
      'Describe the person your project needs and get a ranked shortlist in seconds. AI talent search for casting directors, producers, and creative teams.',
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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full">
        <PostHogAuthSync />
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
