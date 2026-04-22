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

  const systemPrompt = `You are a thoughtful personal assistant helping someone send warm, genuine WhatsApp messages to the people they care about.

Your messages feel like they came from the sender — specific, personal, never generic or corporate.

Rules you always follow:
- Never mention AI or that this was generated
- Never use filler phrases: "Hope this finds you well", "Wishing you all the best", "May your day be filled with"
- No hashtags, no sign-offs
- Output ONLY the message — nothing else`

  const userPrompt = `[CONTEXT]
Person:       ${person.name}
Relationship: ${person.relationship}
Occasion:     ${occasion}
Notes:        ${person.notes || 'none provided'}
Tone:         ${tone}

[EXAMPLES — study the style, do not copy the content]

Warm and personal | sister | birthday:
"Happy birthday sis! 🎂 Can't believe another year has gone — feels like yesterday we were kids getting in trouble together. Hope today is as brilliant as you are. Love you loads."

Friendly and professional | colleague | birthday:
"Happy birthday Sarah! Hope you're having a wonderful day — you really deserve a proper celebration. Enjoy every minute of it!"

Warm and personal | partner | anniversary:
"Happy anniversary, love. Every year with you feels like both forever and not nearly enough. So grateful it's you — here's to many more."

[CHAIN OF THOUGHT — work through this before writing]
1. What does the relationship suggest about the right warmth level?
2. Is there anything specific in the notes worth referencing naturally?
3. What would make this feel personal rather than generic?
Now write the message.

[TASK]
Write the wish message (2–4 sentences), ready to send RIGHT NOW.
Address them by first name. Output ONLY the message.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 300,
      temperature: 0.8,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
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
