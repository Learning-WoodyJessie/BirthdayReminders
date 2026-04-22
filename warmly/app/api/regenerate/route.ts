import { NextRequest, NextResponse } from 'next/server'

// System prompt — sets the model's role, separated from the task
const SYSTEM_PROMPT = `You are a thoughtful personal assistant helping someone send warm, genuine WhatsApp messages to the people they care about.

Your messages feel like they came from the sender — specific, personal, never generic or corporate. You write the way a caring human writes.

Rules you always follow:
- Never mention AI or that this was generated
- Never use filler phrases: "Hope this finds you well", "Wishing you all the best", "May your day be filled with"
- No hashtags, no sign-offs, no quotes around the output
- Output ONLY the message — nothing else`

// Few-shot examples — anchor output quality across relationship types
const FEW_SHOT_EXAMPLES = `[EXAMPLES — study the style, do not copy the content]

Tone: warm and personal | Relationship: sister | Occasion: birthday
"Happy birthday sis! 🎂 Can't believe another year has gone — feels like yesterday we were kids getting in trouble together. Hope today is as brilliant as you are. Love you loads."

Tone: friendly and professional | Relationship: colleague | Occasion: birthday
"Happy birthday Sarah! Hope you're having a wonderful day — you really deserve a proper celebration. Enjoy every minute of it!"

Tone: warmer and more heartfelt | Relationship: best friend | Occasion: birthday
"Happy birthday mate. Honestly one of the people I'm most grateful to have in my corner. Hope today treats you exactly as well as you deserve — which is very, very well."

[END EXAMPLES]`

export async function POST(req: NextRequest) {
  const { person_name, relationship, occasion, notes, tone } = await req.json()

  const userPrompt = `[CONTEXT]
Person:       ${person_name}
Relationship: ${relationship}
Occasion:     ${occasion}
Notes:        ${notes || 'none provided'}
Tone:         Make it ${tone}

${FEW_SHOT_EXAMPLES}

[CHAIN OF THOUGHT — work through this before writing]
1. What does the relationship suggest about the right warmth level?
2. Is there anything specific in the notes worth referencing naturally?
3. How does the requested tone shift change the message?
Now write the message.

[TASK]
Rewrite the message with the tone adjustment applied.
2–4 sentences. Address them by first name. Output ONLY the message.`

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
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
    }),
  })

  const json = await res.json()
  const message = json.choices?.[0]?.message?.content?.trim() ?? ''
  return NextResponse.json({ message })
}
