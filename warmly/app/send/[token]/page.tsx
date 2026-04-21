'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import clsx from 'clsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TONES = [
  { label: '😄 Funnier',    value: 'funnier and more playful' },
  { label: '💝 Warmer',     value: 'warmer and more heartfelt' },
  { label: '✂️ Shorter',    value: 'shorter and punchier' },
  { label: '🌟 Add memory', value: 'include a shared memory' },
]

const GIFS = [
  { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', label: 'Confetti' },
  { url: 'https://media.giphy.com/media/3ohhwf1zhO0P7NIIXA/giphy.gif', label: 'Cake' },
  { url: 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif', label: 'Balloons' },
  { url: 'https://media.giphy.com/media/l4FGlGlWzEJLWfJny/giphy.gif', label: 'Party' },
  { url: 'https://media.giphy.com/media/xT9IgG50Lg7russbC8/giphy.gif', label: 'Celebrate' },
  { url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', label: 'Happy' },
]

interface ReminderData {
  person_name: string
  occasion: string
  relationship: string
  notes: string
  message: string
  phone?: string
}

export default function SendPage({ params }: { params: { token: string } }) {
  const [data, setData]           = useState<ReminderData | null>(null)
  const [message, setMessage]     = useState('')
  const [loading, setLoading]     = useState(true)
  const [regenerating, setRegen]  = useState(false)
  const [selectedGif, setGif]     = useState<string | null>(null)
  const [showGifs, setShowGifs]   = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceNote, setVoice]     = useState<Blob | null>(null)
  const [sent, setSent]           = useState(false)
  const [error, setError]         = useState('')
  const mediaRef                  = useRef<MediaRecorder | null>(null)
  const chunksRef                 = useRef<Blob[]>([])

  // ── load reminder from Supabase ───────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: row, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('token', params.token)
        .single()

      if (error || !row) {
        setError('This link has expired or is invalid.')
        setLoading(false)
        return
      }
      setData(row)
      setMessage(row.message)
      setLoading(false)
    }
    load()
  }, [params.token])

  // ── regenerate with tone ──────────────────────────────────────────────────
  async function regenerate(tone: string) {
    if (!data) return
    setRegen(true)
    try {
      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_name:  data.person_name,
          relationship: data.relationship,
          occasion:     data.occasion,
          notes:        data.notes,
          tone,
        }),
      })
      const json = await res.json()
      if (json.message) setMessage(json.message)
    } finally {
      setRegen(false)
    }
  }

  // ── voice recording ───────────────────────────────────────────────────────
  async function toggleRecording() {
    if (recording) {
      mediaRef.current?.stop()
      setRecording(false)
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    chunksRef.current = []
    mr.ondataavailable = e => chunksRef.current.push(e.data)
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setVoice(blob)
      stream.getTracks().forEach(t => t.stop())
    }
    mediaRef.current = mr
    mr.start()
    setRecording(true)
  }

  // ── build WhatsApp deep link and open ────────────────────────────────────
  function sendOnWhatsApp() {
    let text = message
    if (selectedGif) text += `\n\n${selectedGif}`
    const phone = data?.phone?.replace(/\D/g, '') ?? ''
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
    setSent(true)
  }

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-4xl">🌻</div>
    </div>
  )

  if (error) return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <div className="text-5xl mb-4">😔</div>
        <p className="text-gray-500">{error}</p>
      </div>
    </div>
  )

  if (sent) return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-warmly-dark mb-2">Sent!</h2>
        <p className="text-gray-500">
          You made {data?.person_name}'s day a little warmer.
        </p>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-warmly-cream px-4 py-8 max-w-lg mx-auto">

      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-1">
          {data?.occasion === 'birthday' ? '🎂' : '💑'}
        </div>
        <h1 className="text-2xl font-bold text-warmly-dark">
          {data?.person_name}'s {data?.occasion}
        </h1>
        <p className="text-gray-400 text-sm capitalize">{data?.relationship}</p>
      </div>

      {/* Message editor */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">
          Your message
        </label>
        <textarea
          className="w-full text-gray-800 text-base leading-relaxed resize-none focus:outline-none min-h-[140px]"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        {regenerating && (
          <p className="text-xs text-warmly-orange mt-2 animate-pulse">
            Rewriting...
          </p>
        )}
      </div>

      {/* Tone buttons */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Adjust tone
        </p>
        <div className="flex flex-wrap gap-2">
          {TONES.map(t => (
            <button
              key={t.value}
              onClick={() => regenerate(t.value)}
              disabled={regenerating}
              className="px-3 py-1.5 rounded-full bg-white shadow-sm text-sm font-medium
                         text-warmly-dark hover:bg-warmly-orange hover:text-white
                         transition-colors disabled:opacity-40"
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => regenerate('completely different')}
            disabled={regenerating}
            className="px-3 py-1.5 rounded-full bg-white shadow-sm text-sm font-medium
                       text-warmly-dark hover:bg-warmly-orange hover:text-white
                       transition-colors disabled:opacity-40"
          >
            🔄 Regenerate
          </button>
        </div>
      </div>

      {/* Extras */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Add extras
        </p>
        <div className="flex gap-3">

          {/* GIF picker */}
          <button
            onClick={() => setShowGifs(!showGifs)}
            className={clsx(
              "flex-1 py-3 rounded-xl text-sm font-medium transition-colors shadow-sm",
              selectedGif
                ? "bg-warmly-orange text-white"
                : "bg-white text-warmly-dark hover:bg-warmly-orange hover:text-white"
            )}
          >
            🎞️ {selectedGif ? 'GIF added' : 'Add GIF'}
          </button>

          {/* Voice note */}
          <button
            onClick={toggleRecording}
            className={clsx(
              "flex-1 py-3 rounded-xl text-sm font-medium transition-colors shadow-sm",
              recording
                ? "bg-red-500 text-white animate-pulse"
                : voiceNote
                ? "bg-warmly-orange text-white"
                : "bg-white text-warmly-dark hover:bg-warmly-orange hover:text-white"
            )}
          >
            🎤 {recording ? 'Stop' : voiceNote ? 'Recorded ✓' : 'Voice note'}
          </button>

        </div>

        {/* GIF grid */}
        {showGifs && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {GIFS.map(gif => (
              <button
                key={gif.url}
                onClick={() => { setGif(gif.url); setShowGifs(false) }}
                className={clsx(
                  "rounded-xl overflow-hidden border-2 transition-all",
                  selectedGif === gif.url
                    ? "border-warmly-orange scale-95"
                    : "border-transparent"
                )}
              >
                <img src={gif.url} alt={gif.label} className="w-full h-20 object-cover" />
              </button>
            ))}
            <button
              onClick={() => { setGif(null); setShowGifs(false) }}
              className="rounded-xl border-2 border-dashed border-gray-200
                         flex items-center justify-center h-20 text-gray-400 text-xs"
            >
              None
            </button>
          </div>
        )}

        {/* Voice note playback */}
        {voiceNote && (
          <div className="mt-3 bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
            <span className="text-xl">🎤</span>
            <audio controls src={URL.createObjectURL(voiceNote)} className="flex-1 h-8" />
            <button onClick={() => setVoice(null)} className="text-gray-400 text-sm">✕</button>
          </div>
        )}

        {/* Selected GIF preview */}
        {selectedGif && (
          <div className="mt-3 relative rounded-xl overflow-hidden shadow-sm">
            <img src={selectedGif} alt="selected gif" className="w-full h-32 object-cover" />
            <button
              onClick={() => setGif(null)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Send button */}
      <button
        onClick={sendOnWhatsApp}
        className="w-full py-4 rounded-2xl bg-warmly-orange text-white text-lg
                   font-bold shadow-lg hover:bg-orange-500 active:scale-95
                   transition-all"
      >
        Send on WhatsApp 💬
      </button>

      <p className="text-center text-xs text-gray-400 mt-4">
        Made with Warmly 🌻
      </p>
    </main>
  )
}
