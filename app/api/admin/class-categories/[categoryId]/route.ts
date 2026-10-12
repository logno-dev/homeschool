import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classCategories } from '@/lib/schema'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const auth = await getAuthenticatedAdmin('class-requests')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { categoryId } = await params
  const body = await request.json()
  const updates: Partial<typeof classCategories.$inferInsert> = { updatedAt: new Date().toISOString() }
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    updates.name = name
  }
  if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive)
  if (body.orderIndex !== undefined && Number.isFinite(Number(body.orderIndex))) updates.orderIndex = Number(body.orderIndex)

  try {
    const [category] = await db.update(classCategories).set(updates).where(eq(classCategories.id, categoryId)).returning()
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    return NextResponse.json({ category })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 })
    throw error
  }
}
