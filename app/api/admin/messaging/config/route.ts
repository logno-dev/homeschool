import { NextResponse } from 'next/server'
import { getGlobalSetting } from '@/lib/database'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

export async function GET() {
  const auth = await getAuthenticatedAdmin('newsletters')
  if ('error' in auth) {
    const userAuth = await getAuthenticatedAdmin('users')
    if ('error' in userAuth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const value = await getGlobalSetting('email_sender_aliases')
  let aliases: string[] = []
  try { aliases = JSON.parse(value || '[]') as string[] } catch { aliases = [] }
  return NextResponse.json({ aliases })
}
