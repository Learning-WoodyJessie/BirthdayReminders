/**
 * GET /api/audio/[filename]
 * Proxy audio files from Supabase Storage through Vercel.
 * Twilio uses this URL as MediaUrl — guaranteed publicly accessible.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data, error } = await supabase.storage
    .from('voice-notes')
    .download(params.filename)

  if (error || !data) {
    return new NextResponse('Not found', { status: 404 })
  }

  const buffer      = await data.arrayBuffer()
  const contentType = data.type || 'audio/ogg'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':   contentType,
      'Content-Length': buffer.byteLength.toString(),
      'Cache-Control':  'public, max-age=3600',
    },
  })
}
