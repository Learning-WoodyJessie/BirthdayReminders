import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET() {
  const admin = getAdmin()
  const { data, error } = await admin
    .from('people')
    .select('*')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'Name and relationship are required' }, { status: 400 })
  }

  const admin = getAdmin()
  const { data, error } = await admin
    .from('people')
    .insert({
      name,
      relationship,
      birthday: birthday || null,
      anniversary: anniversary || null,
      phone: phone || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
