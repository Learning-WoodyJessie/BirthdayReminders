'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import clsx from 'clsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TONES = [
  { label: '😄 Funnier',  value: 'funnier and more playful' },
  { label: '💝 Warmer',   value: 'warmer and more heartfelt' },
  { label: '✂️ Shorter',  value: 'shorter and punchier' },
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
  const [data, setData]                 = useState<ReminderData | null>(null)
  const [message, setMessage]           = useState('')
  const [context, setContext]           = useState('')   // user's own thoughts
  const [loading, setLoading]           = useState(true)
  const [regenerating, setRegen]        = useState(false)
  const [recording, setRecording]       = useState(false)
  const [voiceNote, setVoice]           = useState<Blob | null>(null)
  const [voiceError, setVoiceError]     = useState('')
  const [copied, setCopied]             = useState(false)
  const [sent, setSent]                 = useState(false)
  const [sendingVoice, setSendingVoice] = useState(false)
  const [voiceSent, setVoiceSent]       = useState(false)
  const [voiceSendErr, setVoiceSendErr] = useState('')
  const [error, setError]               = useState('')
  const mediaRef                        = useRef<MediaRecorder | null>(null)
  const chunksRef                       = useRef<Blob[]>([])

  useEffect(() => {
    async function load() {
      const { data: row, error } = await supabase
        .from('reminders').select('*').eq('token', params.token).single()
      if (error || !row) { setError('This link has expired or is invalid.'); setLoading(false); return }
      setData(row); setMessage(row.message); setLoading(false)
    }
    load()
  }, [params.token])

  // Regenerate — uses the user's added context if provided
  async function regenerate(toneOverride?: string) {
    if (!data) return
    setRegen(true)
    try {
      const tone = toneOverride ?? 'personalised with the additional context provided'
      const res  = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_name:  data.person_name,
          relationship: data.relationship,
          occasion:     data.occasion,
          notes:        [data.notes, context].filter(Boolean).join('\n'),
          tone,
        }),
      })
      const json = await res.json()
      if (json.message) setMessage(json.message)
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
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Prefer WhatsApp-compatible formats: ogg (Chrome/Firefox) → mp4 (Safari) → webm fallback
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

  async function sendVoiceNote(toSelf: boolean) {
    if (!voiceNote) return
    setSendingVoice(true); setVoiceSendErr('')
    try {
      const form = new FormData()
      const ext  = voiceNote.type.includes('mp4') ? 'mp4' : 'webm'
      form.append('audio', voiceNote, `voice.${ext}`)
      form.append('token', params.token)
      form.append('to_self', toSelf ? 'true' : 'false')
      const res  = await fetch('/api/send-voice', { method: 'POST', body: form })
      const json = await res.json()
      if (res.ok) setVoiceSent(true)
      else setVoiceSendErr(json.error ?? 'Failed to send.')
    } catch (e: unknown) {
      setVoiceSendErr(e instanceof Error ? e.message : 'Failed to send.')
    } finally { setSendingVoice(false) }
  }

  function sendOnWhatsApp() {
    const phone = data?.phone?.replace(/\D/g, '') ?? ''
    const url   = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
    setSent(true)
  }

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A18]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
        <p className="text-white/30 text-sm">Loading…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A18] px-6 text-center">
      <div><div className="text-5xl mb-4">😔</div><p className="text-white/50">{error}</p></div>
    </div>
  )

  if (sent) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A18] px-6 text-center">
      <div className="flex flex-col items-center">
        <div className="text-7xl mb-6 animate-float">🎉</div>
        <h2 className="text-3xl font-black text-white mb-2">Sent!</h2>
        <p className="text-white/40 max-w-xs">You just made {data?.person_name}&apos;s day a little warmer.</p>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#0A0A18] pb-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-4 pt-14 pb-8 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-64 rounded-full
                        bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-6xl mb-3 animate-float">
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

          {/* Label + copy */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">
              Your message
            </span>
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

          {/* Editable message */}
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

          {/* Add personal context */}
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

          {/* Regenerate */}
          <button
            onClick={() => regenerate()}
            disabled={regenerating}
            className="w-full py-2.5 rounded-xl btn-primary text-white text-sm font-bold mb-3 disabled:opacity-50"
          >
            {regenerating ? '⏳ Rewriting…' : '✨ Regenerate with my context'}
          </button>

          {/* Tone quick-adjust */}
          <div className="flex flex-wrap gap-1.5">
            {TONES.map(t => (
              <button
                key={t.value}
                onClick={() => regenerate(t.value)}
                disabled={regenerating}
                className="px-3 py-1 rounded-full btn-secondary text-xs text-white/60
                           hover:text-white disabled:opacity-30 transition-all"
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

          {/* Path A — text */}
          <button
            onClick={sendOnWhatsApp}
            className="w-full py-4 rounded-xl btn-primary text-white text-base font-bold mb-3"
          >
            Send as text 💬
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-white/25 text-xs font-medium">or send a voice note</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Path B — voice */}
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
                      onClick={() => { setVoice(null); setVoiceSendErr('') }}
                      className="w-7 h-7 bg-white/5 text-white/40 rounded-full text-xs hover:bg-white/10
                                 flex items-center justify-center flex-shrink-0"
                    >✕</button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => sendVoiceNote(false)}
                      disabled={sendingVoice}
                      className="flex-1 py-3 rounded-xl btn-primary text-white text-sm font-bold disabled:opacity-50"
                    >
                      {sendingVoice ? '⏳ Sending…' : `Send to ${data?.person_name} 🎤`}
                    </button>
                    <button
                      onClick={() => sendVoiceNote(true)}
                      disabled={sendingVoice}
                      className="flex-1 py-3 rounded-xl btn-secondary text-white/60 text-sm font-semibold
                                 hover:text-white disabled:opacity-50"
                    >
                      Send to me first
                    </button>
                  </div>
                  {voiceSendErr && <p className="text-xs text-red-400 text-center mt-2">{voiceSendErr}</p>}
                </>
              )}
            </>
          ) : (
            <div className="text-center py-3">
              <p className="text-green-400 font-bold">✓ Voice note sent!</p>
              <p className="text-white/30 text-xs mt-1">They&apos;ll hear from you on WhatsApp.</p>
            </div>
          )}
        </div>

      </div>

      <p className="text-center text-white/15 text-xs mt-10">Made with Warmly 🌻</p>
    </main>
  )
}
