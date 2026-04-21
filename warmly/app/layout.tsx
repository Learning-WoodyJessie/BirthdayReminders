import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Warmly',
  description: 'Send messages that feel like you wrote them.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-warmly-cream">{children}</body>
    </html>
  )
}
