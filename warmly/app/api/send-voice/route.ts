/**
 * POST /api/send-voice
 *
 * Accepts a voice note (audio/webm or audio/mp4) as a multipart file upload,
 * uploads it to Supabase Storage (public bucket "voice-notes"),
 * then sends it to the recipient via Twilio WhatsApp media message.
 *
 * Body: multipart/form-data
 *   - audio: File  (the voice note blob)
 *   - token: string  (reminder token — used to look up phone number)
 *   - message: string  (the edited message text — sent alongside the audio)
 *   - to_self: "true" | "false"  (if true, sends to MY_WHATSAPP not recipient)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile   = formData.get('audio') as File | null
    const token  = formData.get('token') as string | null
    const toSelf = formData.get('to_self') === 'true'

    if (!audioFile || !token) {
      return NextResponse.json({ error: 'Missing audio or token' }, { status: 400 })
    }

    // ── 1. Look up phone from Supabase ────────────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data: row } = await supabase
      .from('reminders')
      .select('phone, person_name')
      .eq('token', token)
      .single()

    const recipientPhone = toSelf
      ? process.env.MY_WHATSAPP ?? ''
      : row?.phone ?? ''

    if (!recipientPhone) {
      return NextResponse.json({ error: 'No phone number found' }, { status: 400 })
    }

    // ── 2. Upload audio to Supabase Storage ───────────────────────────────
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)
    const type        = audioFile.type || 'audio/ogg'
    const ext         = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'
    const filename    = `voice-${token}-${Date.now()}.${ext}`
    console.log(`[send-voice] type=${type} ext=${ext} size=${buffer.length}`)

    const { error: uploadError } = await supabase.storage
      .from('voice-notes')
      .upload(filename, buffer, {
        contentType: audioFile.type || 'audio/webm',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const { data: publicData } = supabase.storage
      .from('voice-notes')
      .getPublicUrl(filename)
    const audioUrl = publicData.publicUrl

    // ── 3. Send via Twilio WhatsApp ───────────────────────────────────────
    const accountSid  = process.env.TWILIO_ACCOUNT_SID!
    const authToken   = process.env.TWILIO_AUTH_TOKEN!
    const fromNumber  = process.env.TWILIO_FROM!  // e.g. whatsapp:+14155238886
    const toNumber    = `whatsapp:${recipientPhone}`

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    // Send only the voice note (no text)
    const twilioBody = new URLSearchParams({
      From:     fromNumber,
      To:       toNumber,
      Body:     '🎤 Voice note',
      MediaUrl: audioUrl,
    })

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: twilioBody.toString(),
    })

    const twilioJson = await twilioRes.json()
    console.log(`[send-voice] Twilio audio response: ${JSON.stringify(twilioJson)}`)

    if (!twilioRes.ok) {
      return NextResponse.json(
        { error: `Twilio error: ${twilioJson.message ?? JSON.stringify(twilioJson)}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, audio_url: audioUrl })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
