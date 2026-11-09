import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classrooms, sessionClassrooms } from '@/lib/schema'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('classrooms')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { order } = await request.json()
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: 'Order payload is required' }, { status: 400 })
    }

    const updates = order.map((item: { id: string; orderIndex: number }) => ({
      id: item.id,
      orderIndex: item.orderIndex
    }))

    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(classrooms)
          .set({ orderIndex: update.orderIndex, updatedAt: new Date().toISOString() })
          .where(eq(classrooms.id, update.id))
      }
    })

    if (updates.length > 0) {
      await db.transaction(async (tx) => {
        for (const update of updates) {
          await tx
            .update(sessionClassrooms)
            .set({ orderIndex: update.orderIndex, updatedAt: new Date().toISOString() })
            .where(eq(sessionClassrooms.classroomId, update.id))
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating classroom order:', error)
    return NextResponse.json({ error: 'Failed to update classroom order' }, { status: 500 })
  }
}
