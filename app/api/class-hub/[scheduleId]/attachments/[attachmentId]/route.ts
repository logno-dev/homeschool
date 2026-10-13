import { get } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classHubAttachments, classHubPosts } from '@/lib/schema'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getClassHubAccess } from '@/lib/class-hub-access'

export async function GET(_request: Request, { params }: { params: Promise<{ scheduleId: string; attachmentId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { scheduleId, attachmentId } = await params
  const access = await getClassHubAccess(auth.session.user.id, scheduleId)
  if (!access?.canView) return NextResponse.json({ error: 'You do not have access to this file' }, { status: 403 })
  const [attachment] = await db.select({ filename: classHubAttachments.filename, pathname: classHubAttachments.pathname, contentType: classHubAttachments.contentType }).from(classHubAttachments).innerJoin(classHubPosts, eq(classHubAttachments.postId, classHubPosts.id)).where(and(eq(classHubAttachments.id, attachmentId), eq(classHubPosts.scheduleId, scheduleId))).limit(1)
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  const blob = await get(attachment.pathname, { access: 'private' })
  if (!blob || blob.statusCode === 304 || !blob.stream) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  const safeFilename = attachment.filename.replace(/["\r\n]/g, '_')
  return new Response(blob.stream, { headers: { 'Content-Type': attachment.contentType, 'Content-Disposition': `attachment; filename="${safeFilename}"`, 'Cache-Control': 'private, no-store' } })
}
