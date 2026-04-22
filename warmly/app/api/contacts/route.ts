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
    .from('people')
    .select('*')
    .eq('user_id', user.id)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
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

  const { name, relationship, birthday, anniversary, phone, notes } = body as {
    name: string
    relationship: string
    birthday: string | null
    anniversary: string | null
    phone: string | null
    notes: string | null
  }

  if (!name || !relationship) {
    return NextResponse.json(
      { error: 'Name and relationship are required' },
      { status: 400 }
    )
  }

  const admin = makeSupabaseAdmin()
  const { data, error } = await admin
    .from('people')
    .insert({
      user_id: user.id,
      name,
      relationship,
      birthday: birthday || null,
      anniversary: anniversary || null,
      phone: phone || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
