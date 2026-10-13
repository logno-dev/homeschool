import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { waitlistVacancyFlags } from '@/lib/schema'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ flagId: string }> }) {
  const auth = await getAuthenticatedAdmin('registrations')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { flagId } = await params
  const body = await request.json()
  const status = body.status === 'dismissed' ? 'dismissed' : 'resolved'
  const [updated] = await db.update(waitlistVacancyFlags).set({ status, resolutionNotes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) || null : null, resolvedBy: auth.session.user.id, resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(waitlistVacancyFlags.id, flagId)).returning()
  if (!updated) return NextResponse.json({ error: 'Waitlist follow-up not found' }, { status: 404 })
  return NextResponse.json({ flag: updated })
}
