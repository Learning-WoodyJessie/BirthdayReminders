import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { person_name, relationship, occasion, notes, tone } = await req.json()

  const prompt = `You are helping someone send a heartfelt WhatsApp message.

Person: ${person_name}
Relationship: ${relationship}
Occasion: ${occasion}
Notes: ${notes || 'none provided'}
Tone adjustment: Make it ${tone}

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
  return NextResponse.json({ message })
}
