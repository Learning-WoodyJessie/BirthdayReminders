export const dynamic = 'force-dynamic'

import Nav from '@/components/nav'
import ContactForm from '@/components/contact-form'
import Link from 'next/link'

export default function NewContactPage() {
  return (
    <>
      <Nav />
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/contacts"
            className="text-white/30 hover:text-white/60 text-sm transition-colors"
          >
            ← Back to contacts
          </Link>
          <h1 className="text-2xl font-black text-white mt-3">Add contact</h1>
        </div>
        <div className="glass rounded-2xl p-6">
          <ContactForm />
        </div>
      </main>
    </>
  )
}
