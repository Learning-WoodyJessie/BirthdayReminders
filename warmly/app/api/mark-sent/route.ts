/**
 * POST /api/mark-sent
 *
 * Called by the Warmly UI immediately after the user taps "Send as text".
 * Writes the actual-sent message, context the user added, and tone chosen
 * back to the reminders row. This closes the feedback loop so check_reminders.py
 * can sync the data into sent_log.yaml and avoid duplicate messages.
 *
 * Body (JSON):
 *   token         string  — row identifier
 *   message_sent  string  — the exact message text that went to WhatsApp
 *   context_added string  — extra context the user typed (may be empty)
 *   tone_selected string  — tone label e.g. "warmer and more heartfelt" (may be empty)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, message_sent, context_added, tone_selected } = body

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { error } = await supabase
      .from('reminders')
      .update({
        whatsapp_sent:  true,
        sent_at:        new Date().toISOString(),
        message_sent:   message_sent  ?? null,
        context_added:  context_added ?? null,
        tone_selected:  tone_selected ?? null,
      })
      .eq('token', token)

    if (error) {
      console.error('[mark-sent] update error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[mark-sent] token=${token} marked as sent`)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
