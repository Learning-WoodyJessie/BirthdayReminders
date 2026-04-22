/**
 * POST /api/send-voice
 * Uploads a voice note blob to Supabase Storage and returns ok.
 * The client pre-generates the filename so it can open WhatsApp immediately
 * on the user's tap (before the async upload completes).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const formData  = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const token     = formData.get('token') as string | null
    const filename  = formData.get('filename') as string | null

    if (!audioFile || !token) {
      return NextResponse.json({ error: 'Missing audio or token' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)
    const type        = audioFile.type || 'audio/ogg'
    const ext         = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'
    const fname       = filename ?? `voice-${token}-${Date.now()}.${ext}`

    console.log(`[send-voice] uploading ${fname} type=${type} size=${buffer.length}`)

    const { error: uploadError } = await supabase.storage
      .from('voice-notes')
      .upload(fname, buffer, { contentType: type, upsert: true })

    if (uploadError) {
      console.error(`[send-voice] upload error: ${uploadError.message}`)
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    console.log(`[send-voice] uploaded OK: ${fname}`)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
