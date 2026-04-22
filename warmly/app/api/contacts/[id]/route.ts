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

interface Params {
  params: { id: string }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = makeSupabaseAdmin()
  const { data, error } = await admin
    .from('people')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: Params) {
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

  // Verify ownership
  const { data: existing } = await admin
    .from('people')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('people')
    .update({
      name,
      relationship,
      birthday: birthday || null,
      anniversary: anniversary || null,
      phone: phone || null,
      notes: notes || null,
    })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = makeSupabaseAdmin()

  // Verify ownership
  const { data: existing } = await admin
    .from('people')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('people')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
