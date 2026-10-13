import { randomUUID } from 'crypto'
import { del, put } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classHubAttachments, classHubPosts } from '@/lib/schema'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getClassHubAccess } from '@/lib/class-hub-access'
import { validateClassHubFile } from '@/lib/class-hub-files'

export async function POST(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { scheduleId } = await params
  const access = await getClassHubAccess(auth.session.user.id, scheduleId)
  if (!access?.canManage) return NextResponse.json({ error: 'Only assigned teachers can upload class files' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file')
  const postId = String(formData.get('postId') || '')
  if (!(file instanceof File) || !postId) return NextResponse.json({ error: 'Choose a file and post' }, { status: 400 })
  const [post] = await db.select({ id: classHubPosts.id }).from(classHubPosts).where(and(eq(classHubPosts.id, postId), eq(classHubPosts.scheduleId, scheduleId))).limit(1)
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  let extension: string
  try { extension = validateClassHubFile(file, bytes) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid file' }, { status: 400 }) }
  const id = randomUUID()
  const blob = await put(`class-hub/${scheduleId}/${postId}/${id}.${extension}`, Buffer.from(bytes), { access: 'private', contentType: file.type, addRandomSuffix: false })
  try {
    const [attachment] = await db.insert(classHubAttachments).values({ id, postId, uploadedBy: auth.session.user.id, filename: file.name.slice(0, 255), pathname: blob.pathname, contentType: file.type, size: file.size }).returning()
    return NextResponse.json({ attachment: { ...attachment, pathname: undefined } }, { status: 201 })
  } catch (error) {
    await del(blob.pathname).catch(() => undefined)
    throw error
  }
}
