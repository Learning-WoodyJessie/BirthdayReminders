'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/contacts', label: 'Contacts' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-white/8 bg-[#0A0A18]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="text-white font-black text-lg tracking-tight">
          Warmly <span className="text-2xl">🌻</span>
        </Link>
        <div className="flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                pathname.startsWith(l.href)
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
