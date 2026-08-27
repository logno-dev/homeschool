import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { authAccounts, users } from '@/lib/schema'
import { sendIndividualEmail } from '@/lib/email'

export async function POST(request: Request) {
  const auth = await getAuthenticatedAdmin('newsletters')
  if ('error' in auth) {
    const userAuth = await getAuthenticatedAdmin('users')
    if ('error' in userAuth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const body = await request.json() as { userId?: string; to?: string; cc?: string; bcc?: string; subject?: string; html?: string; text?: string; senderAlias?: string; replyToAlias?: string }
  let to = String(body.to || '').trim().toLowerCase()
  if (body.userId) {
    const [account] = await db.select({ email: authAccounts.email }).from(authAccounts).innerJoin(users, eq(authAccounts.userId, users.id)).where(eq(users.id, body.userId)).limit(1)
    to = account?.email || to
  }
  const parseRecipients = (value?: string) => String(value || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
  const cc = parseRecipients(body.cc)
  const bcc = parseRecipients(body.bcc)
  if ([...cc, ...bcc].some((email) => !/^\S+@\S+\.\S+$/.test(email))) return NextResponse.json({ error: 'CC and BCC addresses must be valid email addresses' }, { status: 400 })
  if (!to || !/^\S+@\S+\.\S+$/.test(to) || !String(body.subject || '').trim() || !String(body.html || '').trim()) return NextResponse.json({ error: 'Recipient, subject, and message are required' }, { status: 400 })
  try {
    await sendIndividualEmail({ to, cc, bcc, subject: String(body.subject).trim(), html: String(body.html), text: String(body.text || ''), senderAlias: body.senderAlias || undefined, replyToAlias: body.replyToAlias || undefined })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending individual email:', error)
    return NextResponse.json({ error: 'Unable to send email' }, { status: 500 })
  }
}
