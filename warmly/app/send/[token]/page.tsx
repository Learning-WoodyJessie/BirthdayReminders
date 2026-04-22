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

// Fallback GIFs used before AI image is generated
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

  // ── AI image generation ───────────────────────────────────────────────────
  async function generateAIImage() {
    if (!data) return
    setGeneratingAI(true)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_name:  data.person_name,
          occasion:     data.occasion,
          relationship: data.relationship,
        }),
      })
      const json = await res.json()
      if (json.url) {
        setAiImageUrl(json.url)
        setImage(json.url)
        setShowPicker(false)
      }
    } catch (e) {
      console.error('AI image generation failed', e)
    } finally {
      setGeneratingAI(false)
    }
  }

  // ── voice recording ───────────────────────────────────────────────────────
  async function toggleRecording() {
    setVoiceError('')

    if (recording) {
      mediaRef.current?.stop()
      setRecording(false)
      return
    }

    // Check MediaRecorder support
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError('Voice recording is not supported in this browser. Try Chrome or Safari.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Pick a MIME type that works cross-browser (Safari needs mp4)
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find(t => MediaRecorder.isTypeSupported(t)) ?? ''

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        setVoice(blob)
        stream.getTracks().forEach(t => t.stop())
      }

      mr.onerror = () => {
        setVoiceError('Recording failed. Please try again.')
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
      }

      mediaRef.current = mr
      mr.start(100) // collect data every 100ms for reliability
      setRecording(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Permission') || msg.includes('denied')) {
        setVoiceError('Microphone access denied. Please allow microphone access and try again.')
      } else {
        setVoiceError('Could not start recording. Please check your microphone.')
      }
    }
  }

  // ── copy message to clipboard ─────────────────────────────────────────────
  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea')
      el.value = message
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ── send voice note via Twilio (to recipient OR to self) ─────────────────
  async function sendVoiceNote(toSelf: boolean) {
    if (!voiceNote || !data) return
    setSendingVoice(true)
    setVoiceSendErr('')
    try {
      const form = new FormData()
      const ext  = voiceNote.type.includes('mp4') ? 'mp4' : 'webm'
      form.append('audio', voiceNote, `voice.${ext}`)
      form.append('token', params.token)
      form.append('to_self', toSelf ? 'true' : 'false')

      const res  = await fetch('/api/send-voice', { method: 'POST', body: form })
      const json = await res.json()
      if (res.ok) {
        setVoiceSent(true)
      } else {
        setVoiceSendErr(json.error ?? 'Failed to send voice note.')
      }
    } catch (e: unknown) {
      setVoiceSendErr(e instanceof Error ? e.message : 'Failed to send voice note.')
    } finally {
      setSendingVoice(false)
    }
  }

  // ── build WhatsApp deep link and open ─────────────────────────────────────
  function sendOnWhatsApp() {
    // Build the text: message + optional image URL note
    let text = message
    if (selectedImage) {
      text += `\n\n🎉 [Tap to view your card: ${selectedImage}]`
    }

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
          You made {data?.person_name}&apos;s day a little warmer.
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
          {data?.person_name}&apos;s {data?.occasion}
        </h1>
        <p className="text-gray-400 text-sm capitalize">{data?.relationship}</p>
      </div>

      {/* Message editor */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Your message
          </label>
          <button
            onClick={copyMessage}
            className="text-xs text-warmly-orange font-medium hover:underline"
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <textarea
          className="w-full text-gray-800 text-base leading-relaxed resize-none focus:outline-none min-h-[140px]"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <p className="text-xs text-gray-300 text-right mt-1">{message.length} chars</p>
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

          {/* Image picker */}
          <button
            onClick={() => setShowPicker(!showImagePicker)}
            className={clsx(
              "flex-1 py-3 rounded-xl text-sm font-medium transition-colors shadow-sm",
              selectedImage
                ? "bg-warmly-orange text-white"
                : "bg-white text-warmly-dark hover:bg-warmly-orange hover:text-white"
            )}
          >
            🎞️ {selectedImage ? 'Image added' : 'Add image'}
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
            🎤 {recording ? '⏹ Stop' : voiceNote ? 'Recorded ✓' : 'Voice note'}
          </button>

        </div>

        {/* Voice recording error */}
        {voiceError && (
          <p className="text-xs text-red-500 mt-2 text-center">{voiceError}</p>
        )}

        {/* Image picker panel */}
        {showImagePicker && (
          <div className="mt-3">
            {/* AI generate button */}
            <button
              onClick={generateAIImage}
              disabled={generatingAI}
              className="w-full py-3 mb-3 rounded-xl bg-gradient-to-r from-warmly-orange to-pink-400
                         text-white text-sm font-semibold shadow-sm disabled:opacity-60
                         flex items-center justify-center gap-2"
            >
              {generatingAI ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Generating AI image…
                </>
              ) : (
                <>✨ Generate AI image for {data?.person_name}</>
              )}
            </button>

            {/* Show AI image if generated */}
            {aiImageUrl && (
              <div className="mb-3 relative rounded-xl overflow-hidden shadow-sm border-2 border-warmly-orange">
                <img src={aiImageUrl} alt="AI generated" className="w-full h-40 object-cover" />
                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                  ✨ AI generated
                </div>
                <button
                  onClick={() => { setImage(aiImageUrl); setShowPicker(false) }}
                  className="absolute bottom-2 right-2 bg-warmly-orange text-white text-xs px-3 py-1 rounded-full"
                >
                  Use this
                </button>
              </div>
            )}

            <p className="text-xs text-gray-400 mb-2 text-center">— or pick a GIF —</p>

            {/* GIF grid */}
            <div className="grid grid-cols-3 gap-2">
              {FALLBACK_GIFS.map(gif => (
                <button
                  key={gif.url}
                  onClick={() => { setImage(gif.url); setShowPicker(false) }}
                  className={clsx(
                    "rounded-xl overflow-hidden border-2 transition-all",
                    selectedImage === gif.url
                      ? "border-warmly-orange scale-95"
                      : "border-transparent"
                  )}
                >
                  <img src={gif.url} alt={gif.label} className="w-full h-20 object-cover" />
                </button>
              ))}
              <button
                onClick={() => { setImage(null); setShowPicker(false) }}
                className="rounded-xl border-2 border-dashed border-gray-200
                           flex items-center justify-center h-20 text-gray-400 text-xs"
              >
                None
              </button>
            </div>
          </div>
        )}

        {/* Voice note playback + send options */}
        {voiceNote && (
          <div className="mt-3 bg-white rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">🎤</span>
              <audio controls src={URL.createObjectURL(voiceNote)} className="flex-1 h-8" />
              <button onClick={() => { setVoice(null); setVoiceSent(false); setVoiceSendErr('') }}
                className="text-gray-400 text-sm">✕</button>
            </div>

            {voiceSent ? (
              <p className="text-xs text-green-500 text-center font-medium">✓ Voice note sent!</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 text-center mb-2">
                  WhatsApp links don&apos;t support audio. Send the voice note directly:
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => sendVoiceNote(false)}
                    disabled={sendingVoice}
                    className="flex-1 py-2 rounded-lg bg-warmly-orange text-white text-xs font-semibold
                               disabled:opacity-50"
                  >
                    {sendingVoice ? '⏳ Sending…' : `Send to ${data?.person_name}`}
                  </button>
                  <button
                    onClick={() => sendVoiceNote(true)}
                    disabled={sendingVoice}
                    className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold
                               disabled:opacity-50"
                  >
                    Send to me first
                  </button>
                </div>
                {voiceSendError && (
                  <p className="text-xs text-red-500 text-center mt-1">{voiceSendError}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Selected image preview */}
        {selectedImage && !showImagePicker && (
          <div className="mt-3 relative rounded-xl overflow-hidden shadow-sm">
            <img src={selectedImage} alt="selected" className="w-full h-32 object-cover" />
            <button
              onClick={() => setImage(null)}
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

      {selectedImage && (
        <p className="text-center text-xs text-gray-400 mt-2">
          💡 WhatsApp will open with your message. Share the image link or save &amp; attach it manually.
        </p>
      )}

      <p className="text-center text-xs text-gray-400 mt-4">
        Made with Warmly 🌻
      </p>
    </main>
  )
}
