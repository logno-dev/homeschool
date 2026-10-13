import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classHubFeedbackResponses, classHubPosts } from '@/lib/schema'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getClassHubAccess } from '@/lib/class-hub-access'
import { cleanClassHubText } from '@/lib/class-hub-content'

export async function POST(request: Request, { params }: { params: Promise<{ scheduleId: string; postId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { scheduleId, postId } = await params
  const access = await getClassHubAccess(auth.session.user.id, scheduleId)
  if (!access?.isFamily || !access.familyId) return NextResponse.json({ error: 'Only enrolled families can respond' }, { status: 403 })
  const [post] = await db.select({ id: classHubPosts.id }).from(classHubPosts).where(and(eq(classHubPosts.id, postId), eq(classHubPosts.scheduleId, scheduleId), eq(classHubPosts.type, 'feedback'))).limit(1)
  if (!post) return NextResponse.json({ error: 'Feedback request not found' }, { status: 404 })
  const body = cleanClassHubText((await request.json()).body, 5000)
  if (!body) return NextResponse.json({ error: 'Enter a response' }, { status: 400 })
  const now = new Date().toISOString()
  const [response] = await db.insert(classHubFeedbackResponses).values({ id: randomUUID(), postId, familyId: access.familyId, authorUserId: auth.session.user.id, body, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: [classHubFeedbackResponses.postId, classHubFeedbackResponses.familyId], set: { body, authorUserId: auth.session.user.id, updatedAt: now } }).returning()
  return NextResponse.json({ response })
}
