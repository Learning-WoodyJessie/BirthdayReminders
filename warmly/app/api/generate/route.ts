import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { person_id, occasion } = await req.json()
  if (!person_id || !occasion) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const admin = getAdmin()
  const { data: person, error: personErr } = await admin
    .from('people')
    .select('*')
    .eq('id', person_id)
    .single()

  if (personErr || !person) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const closeRelationships = ['mother','father','sister','brother','best friend','partner','spouse','husband','wife','daughter','son','grandmother','grandfather']
  const tone = closeRelationships.includes((person.relationship ?? '').toLowerCase())
    ? 'warm and personal'
    : 'friendly and professional'

  const prompt = `You are helping someone send a heartfelt WhatsApp message.

Person: ${person.name}
Relationship: ${person.relationship}
Occasion: ${occasion}
Notes: ${person.notes || 'none provided'}
Tone: Make it ${tone}

Write a warm, personal WhatsApp message (2-4 sentences).
Address them by first name. Sound human, not corporate. No hashtags.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const json = await res.json()
  const message = json.choices?.[0]?.message?.content?.trim() ?? ''
  if (!message) return NextResponse.json({ error: 'Generation failed' }, { status: 500 })

  const token = crypto.randomUUID()
  await admin.from('reminders').insert({
    token,
    person_name: person.name,
    relationship: person.relationship,
    occasion,
    notes: person.notes ?? '',
    message,
    phone: person.phone ?? null,
  })

  return NextResponse.json({
    token,
    message,
    person_name: person.name,
    relationship: person.relationship,
    occasion,
    notes: person.notes ?? '',
    phone: person.phone ?? null,
  })
}
