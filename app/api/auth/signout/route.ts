import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { clearSessionCookie, deleteSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth-server'

export async function POST() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    await deleteSessionByToken(token)
  }

  const response = NextResponse.json({ message: 'Signed out' })
  clearSessionCookie(response)
  return response
}
