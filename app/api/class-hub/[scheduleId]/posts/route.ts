import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classHubPosts } from '@/lib/schema'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getClassHubAccess } from '@/lib/class-hub-access'
import { cleanClassHubText, sanitizeClassHubHtml } from '@/lib/class-hub-content'

export async function POST(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { scheduleId } = await params
  const access = await getClassHubAccess(auth.session.user.id, scheduleId)
  if (!access?.canManage) return NextResponse.json({ error: 'Only assigned teachers can publish to this class' }, { status: 403 })

  const body = await request.json()
  const type = ['note', 'resource', 'feedback'].includes(body.type) ? body.type : 'note'
  const title = cleanClassHubText(body.title, 160)
  const bodyHtml = sanitizeClassHubHtml(body.bodyHtml).slice(0, 50000)
  if (!title || !bodyHtml) return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
  const now = new Date().toISOString()
  const [post] = await db.insert(classHubPosts).values({ id: randomUUID(), scheduleId, authorUserId: auth.session.user.id, type, title, bodyHtml, publishedAt: now, createdAt: now, updatedAt: now }).returning()
  return NextResponse.json({ post }, { status: 201 })
}
