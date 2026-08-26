import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { faqs } from '@/lib/schema'

const VISIBILITIES = new Set(['public', 'private'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ faqId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { faqId } = await params
    const body = await request.json()
    const question = String(body.question || '').trim()
    const answer = String(body.answer || '').trim()
    const visibility = String(body.visibility || '')
    const orderIndex = Number.isFinite(Number(body.orderIndex)) ? Number(body.orderIndex) : 0

    if (!question || !answer || !VISIBILITIES.has(visibility)) {
      return NextResponse.json({ error: 'Question, answer, and valid visibility are required' }, { status: 400 })
    }

    const [faq] = await db.update(faqs).set({
      question,
      answer,
      visibility,
      orderIndex,
      updatedAt: new Date().toISOString()
    }).where(eq(faqs.id, faqId)).returning()

    if (!faq) return NextResponse.json({ error: 'FAQ not found' }, { status: 404 })
    return NextResponse.json({ faq })
  } catch (error) {
    console.error('Error updating FAQ:', error)
    return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ faqId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { faqId } = await params
    const deleted = await db.delete(faqs).where(eq(faqs.id, faqId)).returning({ id: faqs.id })
    if (!deleted.length) return NextResponse.json({ error: 'FAQ not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting FAQ:', error)
    return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 })
  }
}
