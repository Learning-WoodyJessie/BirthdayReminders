import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Not supported' }, { status: 405 })
}
export async function PATCH() {
  return NextResponse.json({ error: 'Editing contacts is not supported' }, { status: 405 })
}
export async function DELETE() {
  return NextResponse.json({ error: 'Deleting contacts is not supported' }, { status: 405 })
}
