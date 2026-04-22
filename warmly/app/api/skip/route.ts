/**
 * POST /api/skip
 *
 * Called when the owner taps "Skip this reminder" in Warmly.
 * Marks the reminder as skipped in Supabase so the daily orchestrator
 * will treat it the same as sent — no duplicate message next run.
 *
 * Body (JSON):
 *   token  string  — row identifier
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { error } = await supabase
      .from('reminders')
      .update({ skipped: true, skipped_at: new Date().toISOString() })
      .eq('token', token)

    if (error) {
      console.error('[skip] update error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[skip] token=${token} marked as skipped`)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
