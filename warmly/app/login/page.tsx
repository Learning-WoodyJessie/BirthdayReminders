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

  return (
    <div className="glass rounded-2xl p-6">
      {sent ? (
        <div className="text-center py-4">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-white font-bold text-lg mb-2">Check your inbox</h2>
          <p className="text-white/50 text-sm">
            We sent a magic link to{' '}
            <span className="text-white/80">{email}</span>. Click it to sign in.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-white/70 mb-1.5"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50 transition-colors text-sm"
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
            className="w-full btn-primary text-white font-semibold py-2.5 px-4 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending…' : 'Send magic link'}
          </button>

          <p className="text-center text-white/30 text-xs">
            No password needed — we&apos;ll email you a sign-in link
          </p>
        </form>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🌻</div>
          <h1 className="text-3xl font-black gradient-text mb-2">Warmly</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Never forget the people who matter
          </p>
        </div>

        <Suspense
          fallback={
            <div className="glass rounded-2xl p-6 text-center text-white/40 text-sm">
              Loading…
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
