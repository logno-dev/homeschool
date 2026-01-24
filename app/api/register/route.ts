import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Registration is handled by WorkOS AuthKit.' },
    { status: 410 }
  )
}
