import { randomUUID } from 'crypto'
import { asc, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classCategories } from '@/lib/schema'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

export async function GET() {
  const auth = await getAuthenticatedAdmin('class-requests')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const categories = await db.select().from(classCategories).orderBy(asc(classCategories.orderIndex), asc(classCategories.name))
  return NextResponse.json({ categories })
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedAdmin('class-requests')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json()
  const name = String(body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 })

  const [existing] = await db.select({ id: classCategories.id }).from(classCategories).where(eq(classCategories.name, name)).limit(1)
  if (existing) return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 })

  const now = new Date().toISOString()
  const [lastCategory] = await db.select({ orderIndex: classCategories.orderIndex }).from(classCategories).orderBy(desc(classCategories.orderIndex)).limit(1)
  const [category] = await db.insert(classCategories).values({ id: randomUUID(), name, isActive: true, orderIndex: (lastCategory?.orderIndex ?? -1) + 1, createdAt: now, updatedAt: now }).returning()
  return NextResponse.json({ category }, { status: 201 })
}
