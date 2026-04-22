import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Nav from '@/components/nav'
import ContactForm from '@/components/contact-form'
import Link from 'next/link'

interface PageProps {
  params: { id: string }
}

export default async function EditContactPage({ params }: PageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: contact, error } = await supabase
    .from('people')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !contact) notFound()

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
          <h1 className="text-2xl font-black text-white mt-3">
            Edit {contact.name}
          </h1>
        </div>
        <div className="glass rounded-2xl p-6">
          <ContactForm
            initialData={{
              id: contact.id,
              name: contact.name,
              relationship: contact.relationship,
              birthday: contact.birthday ?? '',
              anniversary: contact.anniversary ?? '',
              phone: contact.phone ?? '',
              notes: contact.notes ?? '',
            }}
          />
        </div>
      </main>
    </>
  )
}
