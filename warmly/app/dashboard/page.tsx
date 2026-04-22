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
  notes: string | null
  phone: string | null
}

interface UpcomingEvent {
  person: Person
  occasion: 'birthday' | 'anniversary'
  daysAway: number
  emoji: string
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  // Handle --MM-DD format (unknown year)
  const normalized = dateStr.startsWith('--')
    ? `2000${dateStr.slice(1)}`
    : dateStr
  const parts = normalized.split('-')
  if (parts.length < 3) return null
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (isNaN(month) || isNaN(day)) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const next = new Date(today.getFullYear(), month, day)
  next.setHours(0, 0, 0, 0)
  if (next < today) {
    next.setFullYear(today.getFullYear() + 1)
  }
  const diff = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function getUpcomingEvents(contacts: Person[]): UpcomingEvent[] {
  const events: UpcomingEvent[] = []
  for (const person of contacts) {
    if (person.birthday) {
      const days = daysUntil(person.birthday)
      if (days !== null && days <= 30) {
        events.push({ person, occasion: 'birthday', daysAway: days, emoji: '🎂' })
      }
    }
    if (person.anniversary) {
      const days = daysUntil(person.anniversary)
      if (days !== null && days <= 30) {
        events.push({ person, occasion: 'anniversary', daysAway: days, emoji: '💍' })
      }
    }
  }
  events.sort((a, b) => a.daysAway - b.daysAway)
  return events
}

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: contacts } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', user.id)
    .order('name')

  const allContacts: Person[] = contacts ?? []
  const upcomingEvents = getUpcomingEvents(allContacts)
  const noBirthday = allContacts.filter((c) => !c.birthday).length

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-1">
            Good morning 🌻
          </h1>
          <p className="text-white/40 text-sm">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-2xl p-5 text-center">
            <div className="text-3xl font-black text-white mb-1">
              {allContacts.length}
            </div>
            <div className="text-white/40 text-xs uppercase tracking-wide">
              Contacts
            </div>
          </div>
          <div className="glass rounded-2xl p-5 text-center">
            <div className="text-3xl font-black gradient-text mb-1">
              {upcomingEvents.length}
            </div>
            <div className="text-white/40 text-xs uppercase tracking-wide">
              Upcoming (30d)
            </div>
          </div>
          <div className="glass rounded-2xl p-5 text-center">
            <div className="text-3xl font-black text-white mb-1">
              {noBirthday}
            </div>
            <div className="text-white/40 text-xs uppercase tracking-wide">
              No birthday set
            </div>
          </div>
        </div>

        {/* Upcoming events */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-white font-bold text-lg mb-4">
            Upcoming in the next 30 days
          </h2>

          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-white/40 text-sm">
                {allContacts.length === 0
                  ? 'No contacts yet — add someone to get started'
                  : 'No birthdays or anniversaries in the next 30 days'}
              </p>
              {allContacts.length === 0 && (
                <Link
                  href="/contacts/new"
                  className="inline-block mt-4 btn-primary text-white text-sm font-semibold px-5 py-2 rounded-xl"
                >
                  Add first contact
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((ev, i) => (
                <div
                  key={`${ev.person.id}-${ev.occasion}`}
                  className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{ev.emoji}</span>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {ev.person.name}
                      </p>
                      <p className="text-white/40 text-xs capitalize">
                        {ev.occasion} · {ev.person.relationship}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {ev.daysAway === 0 ? (
                      <span className="gradient-text font-black text-sm">
                        TODAY
                      </span>
                    ) : (
                      <span className="text-white/60 text-sm">
                        in {ev.daysAway}d
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA if no contacts */}
        {allContacts.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="text-white font-bold text-lg mb-2">
              Add your first contact
            </h3>
            <p className="text-white/40 text-sm mb-5">
              Start by adding someone you care about. Warmly will remind you of
              their special days.
            </p>
            <Link
              href="/contacts/new"
              className="inline-block btn-primary text-white font-semibold px-6 py-3 rounded-xl"
            >
              Add contact
            </Link>
          </div>
        )}

        {allContacts.length > 0 && (
          <div className="flex justify-end">
            <Link
              href="/contacts"
              className="text-white/40 text-sm hover:text-white/70 transition-colors"
            >
              View all contacts →
            </Link>
          </div>
        )}
      </main>
    </>
  )
}
