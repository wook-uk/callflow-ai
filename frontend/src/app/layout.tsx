// app/layout.tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'CallFlow AI — Sales Meeting Assistant',
  description: 'AI-powered sales call analysis. Transcribe, summarize, and auto-update your CRM.',
  openGraph: {
    title: 'CallFlow AI',
    description: 'Stop wasting 2 hours/day on CRM updates after sales calls.',
    images: ['/og.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-[#0A0A0B] text-white font-sans">
        {children}
      </body>
    </html>
  )
}
