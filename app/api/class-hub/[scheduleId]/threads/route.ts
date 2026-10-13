import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classHubMessages, classHubThreads } from '@/lib/schema'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getClassHubAccess } from '@/lib/class-hub-access'
import { cleanClassHubText } from '@/lib/class-hub-content'

export async function POST(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { scheduleId } = await params
  const access = await getClassHubAccess(auth.session.user.id, scheduleId)
  if (!access?.isFamily || !access.familyId) return NextResponse.json({ error: 'Only enrolled families can start a question' }, { status: 403 })
  const body = await request.json()
  const subject = cleanClassHubText(body.subject, 160)
  const message = cleanClassHubText(body.message, 5000)
  if (!subject || !message) return NextResponse.json({ error: 'Subject and question are required' }, { status: 400 })
  const now = new Date().toISOString()
  const threadId = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(classHubThreads).values({ id: threadId, scheduleId, familyId: access.familyId!, createdBy: auth.session.user.id, subject, status: 'open', createdAt: now, updatedAt: now })
    await tx.insert(classHubMessages).values({ id: randomUUID(), threadId, authorUserId: auth.session.user.id, body: message, createdAt: now, updatedAt: now })
  })
  return NextResponse.json({ threadId }, { status: 201 })
}
