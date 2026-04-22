'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/nav'
import clsx from 'clsx'

const TONES = [
  { label: '😄 Funnier',  value: 'funnier and more playful' },
  { label: '💝 Warmer',   value: 'warmer and more heartfelt' },
  { label: '✂️ Shorter',  value: 'shorter and punchier' },
]

interface GeneratedData {
  token: string
  person_name: string
  occasion: string
  relationship: string
  notes: string
  message: string
  phone?: string
}

function ComposeInner({ personId }: { personId: string }) {
  const searchParams = useSearchParams()
  const occasion = searchParams.get('occasion') ?? 'birthday'

  const [data, setData]           = useState<GeneratedData | null>(null)
  const [message, setMessage]     = useState('')
  const [context, setContext]     = useState('')
  const [toneUsed, setToneUsed]   = useState('')
  const [loading, setLoading]     = useState(true)
  const [regenerating, setRegen]  = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceNote, setVoice]     = useState<Blob | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const [copied, setCopied]       = useState(false)
  const [sent, setSent]           = useState(false)
  const [voiceSent, setVoiceSent] = useState(false)
  const [error, setError]         = useState('')
  const mediaRef                  = useRef<MediaRecorder | null>(null)
  const chunksRef                 = useRef<Blob[]>([])

  useEffect(() => {
    async function generate() {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person_id: personId, occasion }),
        })
        const json = await res.json()
        if (!res.ok || json.error) { setError(json.error ?? 'Failed to generate message'); setLoading(false); return }
        setData(json)
        setMessage(json.message)
      } catch {
        setError('Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    generate()
  }, [personId, occasion])

  async function regenerate(toneOverride?: string) {
    if (!data) return
    setRegen(true)
    try {
      const tone = toneOverride ?? 'personalised with the additional context provided'
      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_name: data.person_name,
          relationship: data.relationship,
          occasion: data.occasion,
          notes: [data.notes, context].filter(Boolean).join('\n'),
          tone,
        }),
      })
      const json = await res.json()
      if (json.message) { setMessage(json.message); setToneUsed(tone) }
    } finally { setRegen(false) }
  }

  async function copyMessage() {
    try { await navigator.clipboard.writeText(message) }
    catch {
      const el = document.createElement('textarea'); el.value = message
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function toggleRecording() {
    setVoiceError('')
    if (recording) { mediaRef.current?.stop(); setRecording(false); return }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError('Voice recording not supported in this browser.'); return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/ogg;codecs=opus','audio/mp4','audio/webm;codecs=opus','audio/webm']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => { setVoice(new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })); stream.getTracks().forEach(t => t.stop()) }
      mr.onerror = () => { setVoiceError('Recording failed. Try again.'); stream.getTracks().forEach(t => t.stop()); setRecording(false) }
      mediaRef.current = mr; mr.start(100); setRecording(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setVoiceError(msg.includes('denied') ? 'Microphone access denied. Please allow and retry.' : 'Could not start recording.')
    }
  }

  function sendVoiceNote() {
    if (!voiceNote || !data) return
    const ext = voiceNote.type.includes('mp4') ? 'mp4' : voiceNote.type.includes('ogg') ? 'ogg' : 'webm'
    const filename = `voice-${data.token}-${Date.now()}.${ext}`
    const appUrl = process.env.NEXT_PUBLIC_WARMLY_URL ?? window.location.origin
    const audioUrl = `${appUrl}/api/audio/${filename}`

    const phone = data.phone?.replace(/\D/g, '') ?? ''
    const text = `🎤 Voice note — tap to listen:\n${audioUrl}`
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(waUrl, '_blank')
    setVoiceSent(true)

    const form = new FormData()
    form.append('audio', voiceNote, filename)
    form.append('filename', filename)
    form.append('token', data.token)
    fetch('/api/send-voice', { method: 'POST', body: form })
      .catch(e => console.error('[voice upload]', e))
  }

  function sendOnWhatsApp() {
    if (!data) return
    const phone = data.phone?.replace(/\D/g, '') ?? ''
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
    setSent(true)

    fetch('/api/mark-sent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: data.token,
        message_sent: message,
        context_added: context,
        tone_selected: toneUsed,
      }),
    }).catch(e => console.error('[mark-sent]', e))
  }

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
        <p className="text-white/30 text-sm">Writing your message…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <div className="text-5xl mb-4">😔</div>
        <p className="text-white/50 mb-4">{error}</p>
        <Link href="/dashboard" className="text-orange-400 text-sm hover:underline">← Back to dashboard</Link>
      </div>
    </div>
  )

  if (sent) return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="flex flex-col items-center">
        <div className="text-7xl mb-6">🎉</div>
        <h2 className="text-3xl font-black text-white mb-2">Sent!</h2>
        <p className="text-white/40 max-w-xs mb-6">You just made {data?.person_name}&apos;s day a little warmer.</p>
        <Link href="/dashboard" className="btn-primary text-white font-bold px-6 py-3 rounded-xl text-sm">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen pb-16">
      <Nav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-4 pt-8 pb-8 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-6xl mb-3">
            {data?.occasion === 'birthday' ? '🎂' : '💑'}
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {data?.person_name}&apos;s
            <span className="gradient-text"> {data?.occasion}</span>
          </h1>
          <p className="text-white/35 text-sm mt-1 capitalize">{data?.relationship}</p>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* ── Message editor ───────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Your message</span>
            <button
              onClick={copyMessage}
              className={clsx(
                "text-xs font-semibold px-3 py-1 rounded-full transition-all",
                copied ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
              )}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <textarea
            className="msg-textarea w-full text-[15px] leading-relaxed p-3 min-h-[130px] mb-1"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Write your message…"
          />
          <div className="flex justify-between items-center mb-4">
            <span className="text-white/20 text-xs">{message.length} chars</span>
            {regenerating && <span className="text-orange-400 text-xs animate-pulse">Rewriting…</span>}
          </div>

          <div className="mb-4">
            <p className="text-white/40 text-xs font-medium mb-1.5">
              Add your own context <span className="text-white/20">(a memory, inside joke, recent moment…)</span>
            </p>
            <textarea
              className="msg-textarea w-full text-sm p-3 min-h-[72px]"
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder={`e.g. "We stayed up all night before our finals exam and laughed the whole time…"`}
            />
          </div>

          <button
            onClick={() => regenerate()}
            disabled={regenerating}
            className="w-full py-2.5 rounded-xl btn-primary text-white text-sm font-bold mb-3 disabled:opacity-50"
          >
            {regenerating ? '⏳ Rewriting…' : '✨ Regenerate with my context'}
          </button>

          <div className="flex flex-wrap gap-1.5">
            {TONES.map(t => (
              <button
                key={t.value}
                onClick={() => regenerate(t.value)}
                disabled={regenerating}
                className="px-3 py-1 rounded-full btn-secondary text-xs text-white/60 hover:text-white disabled:opacity-30 transition-all"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Send ─────────────────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-4">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">
            Send on WhatsApp
          </p>

          <button
            onClick={sendOnWhatsApp}
            className="w-full py-4 rounded-xl btn-primary text-white text-base font-bold mb-3"
          >
            Send as text 💬
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-white/25 text-xs font-medium">or send a voice note</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {!voiceSent ? (
            <>
              <button
                onClick={toggleRecording}
                className={clsx(
                  "w-full py-3.5 rounded-xl text-sm font-bold transition-all mb-2",
                  recording
                    ? "bg-red-500 text-white recording-ring"
                    : voiceNote
                    ? "glass-warm text-orange-300 border border-orange-500/30"
                    : "btn-secondary text-white/60 hover:text-white"
                )}
              >
                {recording ? '⏹  Stop recording' : voiceNote ? '🎤 Re-record' : '🎤 Tap to record'}
              </button>

              {voiceError && <p className="text-xs text-red-400 text-center mb-2">{voiceError}</p>}

              {voiceNote && (
                <>
                  <div className="flex items-center gap-2 bg-black/20 rounded-xl p-2 mb-3 border border-white/5">
                    <audio controls src={URL.createObjectURL(voiceNote)} className="flex-1 h-8" />
                    <button
                      onClick={() => setVoice(null)}
                      className="w-7 h-7 bg-white/5 text-white/40 rounded-full text-xs hover:bg-white/10 flex items-center justify-center flex-shrink-0"
                    >✕</button>
                  </div>
                  <button
                    onClick={sendVoiceNote}
                    className="w-full py-3 rounded-xl btn-primary text-white text-sm font-bold"
                  >
                    Send voice note on WhatsApp 🎤
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="py-3 text-center">
              <p className="text-green-400 font-bold">✓ Opening WhatsApp…</p>
              <p className="text-white/30 text-xs mt-1">Your voice note link is in the message.</p>
            </div>
          )}
        </div>

        {/* ── Back link ────────────────────────────────────────────────────── */}
        <div className="text-center pt-2">
          <Link href="/dashboard" className="text-white/25 text-xs hover:text-white/50 transition-colors">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function ComposePage({ params }: { params: { personId: string } }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
      </div>
    }>
      <ComposeInner personId={params.personId} />
    </Suspense>
  )
}
