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

const FALLBACK_GIFS = [
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
  const [data, setData]                   = useState<ReminderData | null>(null)
  const [message, setMessage]             = useState('')
  const [loading, setLoading]             = useState(true)
  const [regenerating, setRegen]          = useState(false)
  const [selectedImage, setImage]         = useState<string | null>(null)
  const [showImagePicker, setShowPicker]  = useState(false)
  const [generatingAI, setGeneratingAI]   = useState(false)
  const [aiImageUrl, setAiImageUrl]       = useState<string | null>(null)
  const [recording, setRecording]         = useState(false)
  const [voiceNote, setVoice]             = useState<Blob | null>(null)
  const [voiceError, setVoiceError]       = useState('')
  const [copied, setCopied]               = useState(false)
  const [sent, setSent]                   = useState(false)
  const [sendingVoice, setSendingVoice]   = useState(false)
  const [voiceSent, setVoiceSent]         = useState(false)
  const [voiceSendError, setVoiceSendErr] = useState('')
  const [error, setError]                 = useState('')
  const mediaRef                          = useRef<MediaRecorder | null>(null)
  const chunksRef                         = useRef<Blob[]>([])

  useEffect(() => {
    async function load() {
      const { data: row, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('token', params.token)
        .single()
      if (error || !row) { setError('This link has expired or is invalid.'); setLoading(false); return }
      setData(row); setMessage(row.message); setLoading(false)
    }
    load()
  }, [params.token])

  async function regenerate(tone: string) {
    if (!data) return
    setRegen(true)
    try {
      const res  = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_name: data.person_name, relationship: data.relationship, occasion: data.occasion, notes: data.notes, tone }),
      })
      const json = await res.json()
      if (json.message) setMessage(json.message)
    } finally { setRegen(false) }
  }

  async function generateAIImage() {
    if (!data) return
    setGeneratingAI(true)
    try {
      const res  = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_name: data.person_name, occasion: data.occasion, relationship: data.relationship }),
      })
      const json = await res.json()
      if (json.url) { setAiImageUrl(json.url); setImage(json.url); setShowPicker(false) }
    } catch (e) { console.error(e) }
    finally { setGeneratingAI(false) }
  }

  async function toggleRecording() {
    setVoiceError('')
    if (recording) { mediaRef.current?.stop(); setRecording(false); return }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError('Voice recording not supported. Try Chrome or Safari.'); return
    }
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        setVoice(new Blob(chunksRef.current, { type: mimeType || 'audio/webm' }))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.onerror = () => { setVoiceError('Recording failed. Try again.'); stream.getTracks().forEach(t => t.stop()); setRecording(false) }
      mediaRef.current = mr; mr.start(100); setRecording(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setVoiceError(msg.includes('denied') ? 'Microphone access denied. Please allow and retry.' : 'Could not start recording.')
    }
  }

  async function copyMessage() {
    try { await navigator.clipboard.writeText(message) }
    catch { const el = document.createElement('textarea'); el.value = message; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el) }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function sendVoiceNote(toSelf: boolean) {
    if (!voiceNote || !data) return
    setSendingVoice(true); setVoiceSendErr('')
    try {
      const form = new FormData()
      const ext  = voiceNote.type.includes('mp4') ? 'mp4' : 'webm'
      form.append('audio', voiceNote, `voice.${ext}`)
      form.append('token', params.token)
      form.append('message', message)
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
    let text = message
    if (selectedImage) text += `\n\n🎉 [View card: ${selectedImage}]`
    const phone = data?.phone?.replace(/\D/g, '') ?? ''
    const url   = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
    setSent(true)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A18]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
        <p className="text-white/40 text-sm">Loading your reminder…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A18] px-6 text-center">
      <div>
        <div className="text-5xl mb-4">😔</div>
        <p className="text-white/50">{error}</p>
      </div>
    </div>
  )

  if (sent) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A18] px-6 text-center">
      <div className="flex flex-col items-center">
        <div className="text-7xl mb-6 animate-float">🎉</div>
        <h2 className="text-3xl font-bold text-white mb-3">Sent!</h2>
        <p className="text-white/50 text-base max-w-xs">
          You just made {data?.person_name}&apos;s day a little warmer.
        </p>
      </div>
    </div>
  )

  const occasionIcon = data?.occasion === 'birthday' ? '🎂' : '💑'

  return (
    <main className="min-h-screen bg-[#0A0A18] pb-12">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-4 pt-14 pb-10 text-center">
        {/* Glow blob */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full
                        bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-6xl mb-4 animate-float">{occasionIcon}</div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">
            {data?.person_name}&apos;s
            <span className="gradient-text"> {data?.occasion}</span>
          </h1>
          <p className="text-white/40 text-sm capitalize font-medium">{data?.relationship}</p>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-3">

        {/* ── Section A: Text message ──────────────────────────────────────── */}
        <div className="glass rounded-2xl overflow-hidden">
          {/* Section header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500
                              flex items-center justify-center text-sm">💬</div>
              <span className="text-white font-semibold text-sm">Text message</span>
            </div>
            <button
              onClick={copyMessage}
              className={clsx(
                "text-xs font-semibold px-3 py-1 rounded-full transition-all",
                copied
                  ? "bg-green-500/20 text-green-400"
                  : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
              )}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {/* Message textarea */}
          <div className="p-4">
            <textarea
              className="msg-textarea w-full text-sm leading-relaxed p-3 min-h-[130px]"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your message…"
            />
            <div className="flex items-center justify-between mt-1 mb-3">
              <span className="text-white/20 text-xs">{message.length} chars</span>
              {regenerating && (
                <span className="text-orange-400 text-xs animate-pulse">Rewriting…</span>
              )}
            </div>

            {/* Tone chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {TONES.map(t => (
                <button
                  key={t.value}
                  onClick={() => regenerate(t.value)}
                  disabled={regenerating}
                  className="px-3 py-1 rounded-full btn-secondary text-xs text-white/70
                             hover:text-white disabled:opacity-30 transition-all"
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={() => regenerate('completely different')}
                disabled={regenerating}
                className="px-3 py-1 rounded-full btn-secondary text-xs text-white/70
                           hover:text-white disabled:opacity-30 transition-all"
              >
                🔄 Regenerate
              </button>
            </div>

            {/* Image picker */}
            <button
              onClick={() => setShowPicker(!showImagePicker)}
              className={clsx(
                "w-full py-2.5 rounded-xl text-sm font-medium mb-3 transition-all",
                selectedImage
                  ? "btn-primary text-white"
                  : "btn-secondary text-white/60 hover:text-white"
              )}
            >
              🎞️ {selectedImage ? 'Image added — change' : 'Add an image (optional)'}
            </button>

            {showImagePicker && (
              <div className="mb-3">
                <button
                  onClick={generateAIImage}
                  disabled={generatingAI}
                  className="w-full py-3 mb-3 rounded-xl text-sm font-bold text-white btn-primary
                             disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generatingAI
                    ? <><span className="animate-spin inline-block">⏳</span> Generating…</>
                    : <>✨ AI-generate for {data?.person_name}</>}
                </button>

                {aiImageUrl && (
                  <div className="mb-3 relative rounded-xl overflow-hidden border border-orange-500/40">
                    <img src={aiImageUrl} alt="AI" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                      ✨ AI generated
                    </div>
                    <button
                      onClick={() => { setImage(aiImageUrl); setShowPicker(false) }}
                      className="absolute bottom-2 right-2 btn-primary text-white text-xs px-3 py-1.5 rounded-full font-semibold"
                    >
                      Use this
                    </button>
                  </div>
                )}

                <p className="text-white/30 text-xs text-center mb-2">— or pick a GIF —</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {FALLBACK_GIFS.map(gif => (
                    <button
                      key={gif.url}
                      onClick={() => { setImage(gif.url); setShowPicker(false) }}
                      className={clsx(
                        "rounded-xl overflow-hidden border-2 transition-all",
                        selectedImage === gif.url ? "border-orange-500" : "border-white/5 hover:border-white/20"
                      )}
                    >
                      <img src={gif.url} alt={gif.label} className="w-full h-16 object-cover" />
                    </button>
                  ))}
                  <button
                    onClick={() => { setImage(null); setShowPicker(false) }}
                    className="rounded-xl border-2 border-dashed border-white/10
                               flex items-center justify-center h-16 text-white/30 text-xs hover:border-white/20"
                  >
                    None
                  </button>
                </div>
              </div>
            )}

            {selectedImage && !showImagePicker && (
              <div className="relative rounded-xl overflow-hidden mb-3">
                <img src={selectedImage} alt="selected" className="w-full h-32 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <button
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full text-xs
                             flex items-center justify-center hover:bg-black/80"
                >✕</button>
              </div>
            )}

            {/* Send button */}
            <button
              onClick={sendOnWhatsApp}
              className="w-full py-4 rounded-xl btn-primary text-white text-base font-bold"
            >
              Open in WhatsApp 💬
            </button>
            {selectedImage && (
              <p className="text-center text-xs text-white/30 mt-2">
                Attach the image manually in WhatsApp after it opens.
              </p>
            )}
          </div>
        </div>

        {/* ── OR divider ───────────────────────────────────────────────────── */}
        <div className="divider">
          <span className="text-xs text-white/25 font-semibold tracking-widest uppercase">or</span>
        </div>

        {/* ── Section B: Voice note ────────────────────────────────────────── */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500
                            flex items-center justify-center text-sm">🎤</div>
            <div>
              <span className="text-white font-semibold text-sm">Voice note</span>
              <p className="text-white/35 text-xs">Record & send directly via WhatsApp</p>
            </div>
          </div>

          <div className="p-4">
            {/* Record button */}
            <button
              onClick={toggleRecording}
              className={clsx(
                "w-full py-4 rounded-xl text-sm font-bold transition-all mb-2",
                recording
                  ? "bg-red-500 text-white recording-ring"
                  : voiceNote
                  ? "btn-primary text-white"
                  : "btn-secondary text-white/70 hover:text-white"
              )}
            >
              {recording
                ? '⏹  Stop recording'
                : voiceNote
                ? '🎤  Recorded — tap to re-record'
                : '🎤  Tap to record'}
            </button>

            {voiceError && (
              <p className="text-xs text-red-400 text-center mb-2">{voiceError}</p>
            )}

            {/* Playback + send */}
            {voiceNote && !voiceSent && (
              <div>
                <div className="flex items-center gap-2 bg-black/20 rounded-xl p-2 mb-3 border border-white/5">
                  <audio controls src={URL.createObjectURL(voiceNote)} className="flex-1 h-8" />
                  <button
                    onClick={() => { setVoice(null); setVoiceSent(false); setVoiceSendErr('') }}
                    className="w-7 h-7 bg-white/5 text-white/40 rounded-full text-xs hover:bg-white/10
                               flex items-center justify-center flex-shrink-0"
                  >✕</button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => sendVoiceNote(false)}
                    disabled={sendingVoice}
                    className="flex-1 py-3 rounded-xl btn-primary text-white text-sm font-bold
                               disabled:opacity-50"
                  >
                    {sendingVoice ? '⏳ Sending…' : `Send to ${data?.person_name} 🎤`}
                  </button>
                  <button
                    onClick={() => sendVoiceNote(true)}
                    disabled={sendingVoice}
                    className="flex-1 py-3 rounded-xl btn-secondary text-white/70 text-sm font-semibold
                               hover:text-white disabled:opacity-50"
                  >
                    Send to me first
                  </button>
                </div>

                {voiceSendError && (
                  <p className="text-xs text-red-400 text-center mt-2">{voiceSendError}</p>
                )}
              </div>
            )}

            {voiceSent && (
              <div className="text-center py-3">
                <p className="text-green-400 font-bold text-sm">✓ Voice note sent!</p>
                <p className="text-white/30 text-xs mt-0.5">They&apos;ll hear from you on WhatsApp.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer */}
      <p className="text-center text-white/15 text-xs mt-10 tracking-wide">
        Made with Warmly 🌻
      </p>
    </main>
  )
}
