import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { person_name, occasion, relationship } = await req.json()

  const occasionWord = occasion === 'birthday' ? 'birthday' : 'anniversary'
  const prompt = `A warm, cheerful ${occasionWord} illustration for ${person_name} (${relationship}).
Vibrant celebration scene with balloons, confetti, flowers, and a festive cake.
Bright warm colours, joyful mood, no text or letters in the image, cartoon style.`

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    }),
  })

  const json = await res.json()
  if (!res.ok) {
    return NextResponse.json(
      { error: json.error?.message ?? 'Image generation failed' },
      { status: 500 }
    )
  }

  const url = json.data?.[0]?.url ?? ''
  return NextResponse.json({ url })
}
