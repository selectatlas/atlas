import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'castd.ai - AI Talent Discovery',
  description: 'Find the right creative talent in seconds with AI-native search.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'castd.ai',
  },
}

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const isDevelopment = process.env.NODE_ENV === 'development'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                if (${isDevelopment}) {
                  navigator.serviceWorker.getRegistrations().then((registrations) => {
                    registrations.forEach((registration) => registration.unregister())
                  })
                  if ('caches' in window) {
                    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
                  }
                } else {
                  navigator.serviceWorker.register('/sw.js').catch(() => {})
                }
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
