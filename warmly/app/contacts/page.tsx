import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/nav'
import Link from 'next/link'

interface Person {
  id: string
  name: string
  relationship: string
  birthday: string | null
  anniversary: string | null
  phone: string | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  if (dateStr.startsWith('--')) {
    const parts = dateStr.slice(2).split('-')
    if (parts.length === 2) {
      const month = parseInt(parts[0], 10)
      const day = parseInt(parts[1], 10)
      if (!isNaN(month) && !isNaN(day)) {
        return new Date(2000, month - 1, day).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      }
    }
    return dateStr
  }
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function ContactsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: contacts } = await supabase
    .from('people')
    .select('id, name, relationship, birthday, anniversary, phone')
    .eq('user_id', user.id)
    .order('name')

  const allContacts: Person[] = contacts ?? []

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Contacts</h1>
            <p className="text-white/40 text-sm mt-0.5">
              {allContacts.length} {allContacts.length === 1 ? 'person' : 'people'}
            </p>
          </div>
          <Link
            href="/contacts/new"
            className="btn-primary text-white font-semibold px-4 py-2 rounded-xl text-sm"
          >
            + Add contact
          </Link>
        </div>

        {allContacts.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">👥</div>
            <h2 className="text-white font-bold text-xl mb-2">
              No contacts yet
            </h2>
            <p className="text-white/40 text-sm mb-6">
              Add the people you care about and never miss their special days.
            </p>
            <Link
              href="/contacts/new"
              className="inline-block btn-primary text-white font-semibold px-6 py-3 rounded-xl"
            >
              Add your first contact
            </Link>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            {allContacts.map((contact, i) => (
              <div
                key={contact.id}
                className="flex items-center justify-between px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm truncate">
                        {contact.name}
                      </p>
                      <p className="text-white/40 text-xs capitalize">
                        {contact.relationship}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-8 mr-4">
                  <div className="text-right">
                    <p className="text-white/30 text-xs mb-0.5">Birthday</p>
                    <p className="text-white/70 text-xs">
                      {formatDate(contact.birthday)}
                    </p>
                  </div>
                  {contact.anniversary && (
                    <div className="text-right">
                      <p className="text-white/30 text-xs mb-0.5">Anniversary</p>
                      <p className="text-white/70 text-xs">
                        {formatDate(contact.anniversary)}
                      </p>
                    </div>
                  )}
                </div>

                <Link
                  href={`/contacts/${contact.id}`}
                  className="text-white/30 hover:text-white/70 text-xs transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                >
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
