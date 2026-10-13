import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classHubAttachments, classHubFeedbackResponses, classHubMessages, classHubPosts, classHubThreads, families, users } from '@/lib/schema'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getClassHubAccess } from '@/lib/class-hub-access'

export async function GET(_request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { scheduleId } = await params
  const access = await getClassHubAccess(auth.session.user.id, scheduleId)
  if (!access?.canView) return NextResponse.json({ error: 'You do not have access to this class hub' }, { status: 403 })

  const responseScope = access.canManage ? eq(classHubPosts.scheduleId, scheduleId) : and(eq(classHubPosts.scheduleId, scheduleId), eq(classHubFeedbackResponses.familyId, access.familyId || ''))
  const threadScope = access.canManage ? eq(classHubThreads.scheduleId, scheduleId) : and(eq(classHubThreads.scheduleId, scheduleId), eq(classHubThreads.familyId, access.familyId || ''))
  const [posts, attachments, allResponses, allThreads] = await Promise.all([
    db.select().from(classHubPosts).where(and(eq(classHubPosts.scheduleId, scheduleId), isNull(classHubPosts.archivedAt))).orderBy(desc(classHubPosts.publishedAt)),
    db.select().from(classHubAttachments).innerJoin(classHubPosts, eq(classHubAttachments.postId, classHubPosts.id)).where(eq(classHubPosts.scheduleId, scheduleId)).then((rows) => rows.map((row) => row.class_hub_attachments)),
    db.select({ response: classHubFeedbackResponses, familyName: families.name }).from(classHubFeedbackResponses).innerJoin(classHubPosts, eq(classHubFeedbackResponses.postId, classHubPosts.id)).innerJoin(families, eq(classHubFeedbackResponses.familyId, families.id)).where(responseScope),
    db.select({ thread: classHubThreads, familyName: families.name }).from(classHubThreads).innerJoin(families, eq(classHubThreads.familyId, families.id)).where(threadScope).orderBy(desc(classHubThreads.updatedAt))
  ])
  const threadIds = allThreads.map(({ thread }) => thread.id)
  const messages = threadIds.length ? await db.select().from(classHubMessages).where(inArray(classHubMessages.threadId, threadIds)).orderBy(asc(classHubMessages.createdAt)) : []
  const authorIds = [...new Set([...posts.map((post) => post.authorUserId), ...messages.map((message) => message.authorUserId)])]
  const authors = authorIds.length ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray(users.id, authorIds)) : []
  const authorNames = new Map(authors.map((author) => [author.id, `${author.firstName} ${author.lastName}`.trim()]))

  return NextResponse.json({
    access: { canManage: access.canManage, isFamily: access.isFamily, familyId: access.familyId },
    classInfo: { scheduleId, className: access.className, gradeRange: access.gradeRange, period: access.period, classroomName: access.classroomName, sessionName: access.sessionName },
    posts: posts.map((post) => ({ ...post, authorName: authorNames.get(post.authorUserId) || 'Teacher', attachments: attachments.filter((attachment) => attachment.postId === post.id).map(({ pathname: _pathname, ...attachment }) => attachment), responses: allResponses.filter(({ response }) => response.postId === post.id).map(({ response, familyName }) => ({ ...response, familyName })) })),
    threads: allThreads.map(({ thread, familyName }) => ({ ...thread, familyName, messages: messages.filter((message) => message.threadId === thread.id).map((message) => ({ ...message, authorName: authorNames.get(message.authorUserId) || 'Class participant', isOwn: message.authorUserId === auth.session.user.id })) }))
  })
}
