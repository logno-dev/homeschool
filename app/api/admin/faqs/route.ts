import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { faqs } from '@/lib/schema'

const VISIBILITIES = new Set(['public', 'private'])

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const records = await db.select().from(faqs).orderBy(asc(faqs.visibility), asc(faqs.orderIndex), asc(faqs.createdAt))
    return NextResponse.json({ faqs: records })
  } catch (error) {
    console.error('Error loading FAQs:', error)
    return NextResponse.json({ error: 'Failed to load FAQs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json()
    const question = String(body.question || '').trim()
    const answer = String(body.answer || '').trim()
    const visibility = String(body.visibility || 'public')
    const orderIndex = Number.isFinite(Number(body.orderIndex)) ? Number(body.orderIndex) : 0

    if (!question || !answer || !VISIBILITIES.has(visibility)) {
      return NextResponse.json({ error: 'Question, answer, and valid visibility are required' }, { status: 400 })
    }

    const [faq] = await db.insert(faqs).values({
      id: randomUUID(),
      question,
      answer,
      visibility,
      orderIndex,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning()

    return NextResponse.json({ faq }, { status: 201 })
  } catch (error) {
    console.error('Error creating FAQ:', error)
    return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 })
  }
}
