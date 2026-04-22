'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Nav from '@/components/nav'

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
]

interface Settings {
  whatsapp_number: string
  reminder_days: number[]
  timezone: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    whatsapp_number: '',
    reminder_days: [3, 0],
    timezone: 'America/Los_Angeles',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          if (data) {
            setSettings({
              whatsapp_number: data.whatsapp_number ?? '',
              reminder_days: data.reminder_days ?? [3, 0],
              timezone: data.timezone ?? 'America/Los_Angeles',
            })
          }
        }
      } catch {
        // settings not found — use defaults
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  function toggleReminderDay(day: number) {
    setSettings((prev) => {
      const current = prev.reminder_days
      if (current.includes(day)) {
        return { ...prev, reminder_days: current.filter((d) => d !== day) }
      } else {
        return { ...prev, reminder_days: [...current, day].sort((a, b) => b - a) }
      }
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save settings')
        setSaving(false)
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50 transition-colors text-sm'
  const labelClass = 'block text-sm font-medium text-white/70 mb-1.5'

  return (
    <>
      <Nav />
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">Settings</h1>
          <p className="text-white/40 text-sm mt-1">
            Configure your notification preferences
          </p>
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-8 text-center text-white/40 text-sm">
            Loading settings…
          </div>
        ) : (
          <form onSubmit={handleSave} className="glass rounded-2xl p-6 space-y-6">
            {/* WhatsApp number */}
            <div>
              <label htmlFor="whatsapp" className={labelClass}>
                WhatsApp number
              </label>
              <input
                id="whatsapp"
                type="text"
                value={settings.whatsapp_number}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    whatsapp_number: e.target.value,
                  }))
                }
                placeholder="+14155550001"
                className={inputClass}
              />
              <p className="text-white/30 text-xs mt-1">
                E.164 format — where you receive daily digests
              </p>
            </div>

            {/* Reminder timing */}
            <div>
              <p className={labelClass}>Remind me</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.reminder_days.includes(3)}
                    onChange={() => toggleReminderDay(3)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className="text-white/70 text-sm">
                    3 days before (heads-up reminder)
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.reminder_days.includes(0)}
                    onChange={() => toggleReminderDay(0)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className="text-white/70 text-sm">
                    On the day (ready-to-send message)
                  </span>
                </label>
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className={labelClass}>
                Timezone
              </label>
              <select
                id="timezone"
                value={settings.timezone}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    timezone: e.target.value,
                  }))
                }
                className={`${inputClass} bg-[#0A0A18]`}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} className="bg-[#0A0A18]">
                    {tz.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {saved && (
              <p className="text-green-400 text-xs bg-green-400/10 px-3 py-2 rounded-lg">
                Settings saved!
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full btn-primary text-white font-semibold py-2.5 px-4 rounded-xl text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </form>
        )}
      </main>
    </>
  )
}
