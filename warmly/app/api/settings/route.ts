import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function makeSupabaseAdmin() {
  return require('@supabase/supabase-js').createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

function makeSupabaseUser() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

async function getUser() {
  const supabase = makeSupabaseUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = makeSupabaseAdmin()
  const { data, error } = await admin
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    data ?? {
      user_id: user.id,
      whatsapp_number: null,
      reminder_days: [3, 0],
      timezone: 'America/Los_Angeles',
    }
  )
}

export async function PUT(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { whatsapp_number, reminder_days, timezone } = body as {
    whatsapp_number: string
    reminder_days: number[]
    timezone: string
  }

  const admin = makeSupabaseAdmin()
  const { data, error } = await admin
    .from('user_settings')
    .upsert(
      {
        user_id: user.id,
        whatsapp_number: whatsapp_number || null,
        reminder_days: reminder_days ?? [3, 0],
        timezone: timezone ?? 'America/Los_Angeles',
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
