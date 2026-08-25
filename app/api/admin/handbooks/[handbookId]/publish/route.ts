import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { handbooks } from '@/lib/schema'
import { setGlobalSetting } from '@/lib/database'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handbookId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { handbookId } = await params
    const [handbook] = await db.select().from(handbooks).where(eq(handbooks.id, handbookId)).limit(1)
    if (!handbook) {
      return NextResponse.json({ error: 'Handbook not found' }, { status: 404 })
    }

    await db.transaction(async (tx) => {
      await tx.update(handbooks).set({ isActive: false }).where(eq(handbooks.isActive, true))
      await tx.update(handbooks).set({ isActive: true }).where(eq(handbooks.id, handbookId))
    })
    await Promise.all([
      setGlobalSetting('handbook_url', handbook.blobUrl),
      setGlobalSetting('handbook_version', handbook.version)
    ])

    return NextResponse.json({ success: true, handbookId })
  } catch (error) {
    console.error('Error publishing handbook:', error)
    return NextResponse.json({ error: 'Failed to publish handbook' }, { status: 500 })
  }
}
