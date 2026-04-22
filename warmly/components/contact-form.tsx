'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const RELATIONSHIP_SUGGESTIONS = [
  'mother','father','mom','dad','sister','brother','best friend',
  'partner','spouse','husband','wife','daughter','son',
  'grandmother','grandfather','friend','colleague','mentor','neighbour',
]

export default function ContactForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [birthday, setBirthday] = useState('')
  const [anniversary, setAnniversary] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          relationship,
          birthday: birthday || null,
          anniversary: anniversary || null,
          phone: phone || null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
        return
      }
      router.push('/contacts')
      router.refresh()
    } catch {
      setError('Network error — please try again')
      setLoading(false)
    }
  }

  const inputClass = 'w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50 transition-colors text-sm'
  const labelClass = 'block text-sm font-medium text-white/70 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className={labelClass}>Name <span className="text-orange-400">*</span></label>
        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Smith" className={inputClass} />
      </div>

      <div>
        <label htmlFor="relationship" className={labelClass}>Relationship <span className="text-orange-400">*</span></label>
        <input id="relationship" type="text" value={relationship} onChange={e => setRelationship(e.target.value)} required placeholder="best friend" list="relationship-suggestions" className={inputClass} />
        <datalist id="relationship-suggestions">
          {RELATIONSHIP_SUGGESTIONS.map(r => <option key={r} value={r} />)}
        </datalist>
      </div>

      <div>
        <label htmlFor="birthday" className={labelClass}>Birthday</label>
        <input id="birthday" type="text" value={birthday} onChange={e => setBirthday(e.target.value)} placeholder="YYYY-MM-DD or --MM-DD if year unknown" className={inputClass} />
        <p className="text-white/30 text-xs mt-1">e.g. 1990-06-15 or --06-15 if you don&apos;t know the year</p>
      </div>

      <div>
        <label htmlFor="anniversary" className={labelClass}>Anniversary <span className="text-white/30">(optional)</span></label>
        <input id="anniversary" type="text" value={anniversary} onChange={e => setAnniversary(e.target.value)} placeholder="YYYY-MM-DD" className={inputClass} />
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>Phone <span className="text-white/30">(optional)</span></label>
        <input id="phone" type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+14155550001" className={inputClass} />
        <p className="text-white/30 text-xs mt-1">E.164 format with country code</p>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>Notes <span className="text-white/30">(optional)</span></label>
        <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Memories, interests, life events — more detail = better personalised messages" className={`${inputClass} resize-none`} />
      </div>

      {error && <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

      <button type="submit" disabled={loading} className="w-full btn-primary text-white font-semibold py-2.5 px-4 rounded-xl text-sm disabled:opacity-50">
        {loading ? 'Adding…' : 'Add contact'}
      </button>
    </form>
  )
}
