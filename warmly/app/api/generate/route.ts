import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { person_id, occasion } = await req.json()
  if (!person_id || !occasion) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Fetch the contact (must belong to this user)
  const { data: person, error: personErr } = await supabase
    .from('people')
    .select('*')
    .eq('id', person_id)
    .eq('user_id', user.id)
    .single()

  if (personErr || !person) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  // Build prompt — same style as /api/regenerate
  // Determine tone based on relationship (mirror Python router logic)
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

  // Insert into reminders table so mark-sent write-back works exactly the same way
  const token = crypto.randomUUID()
  await supabase.from('reminders').insert({
    token,
    person_name: person.name,
    relationship: person.relationship,
    occasion,
    notes: person.notes ?? '',
    message,
    phone: person.phone ?? null,
    user_id: user.id,
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
