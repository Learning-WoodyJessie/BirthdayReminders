'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    if (searchParams.get('error') === 'auth') {
      setError('Authentication failed. Please try again.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="text-6xl mb-4 animate-bounce">📬</div>
        <h2 className="text-white font-black text-xl mb-2">check your inbox!</h2>
        <p className="text-white/50 text-sm leading-relaxed">
          magic link on its way to{' '}
          <span className="text-orange-400 font-medium">{email}</span>
          <br />tap it to get in ✨
        </p>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-white/60 mb-1.5"
          >
            your email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-orange-400/60 transition-colors text-sm"
          />
        </div>

        {error && (
          <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full btn-primary text-white font-bold py-3 px-4 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'sending…' : 'send magic link ✨'}
        </button>

        <p className="text-center text-white/25 text-xs">
          no password. no drama. just a link.
        </p>
      </form>
    </div>
  )
}

const features = [
  { emoji: '🎂', text: 'never miss a birthday again' },
  { emoji: '✍️', text: 'AI writes the perfect message' },
  { emoji: '🎙️', text: 'send voice notes with one tap' },
  { emoji: '💅', text: 'edit the vibe before you send' },
]

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Ambient glow blobs */}
      <div
        className="absolute top-[-120px] left-[-80px] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,107,53,0.15) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute bottom-[-100px] right-[-60px] w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,77,141,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-sm relative z-10">

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3 select-none">🌻</div>
          <h1 className="text-4xl font-black gradient-text mb-1 tracking-tight">Warmly</h1>
          <p className="text-white/40 text-sm">your people deserve a text 💌</p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {features.map(({ emoji, text }) => (
            <div
              key={text}
              className="glass rounded-xl px-3 py-2.5 flex items-center gap-2"
            >
              <span className="text-lg leading-none">{emoji}</span>
              <span className="text-white/60 text-xs leading-tight">{text}</span>
            </div>
          ))}
        </div>

        {/* Login form */}
        <Suspense
          fallback={
            <div className="glass rounded-2xl p-6 text-center text-white/30 text-sm">
              loading…
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        {/* Footer */}
        <p className="text-center text-white/20 text-xs mt-6">
          free forever · your data stays yours 🔒
        </p>
      </div>
    </div>
  )
}
