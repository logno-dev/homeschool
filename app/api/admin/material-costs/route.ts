import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import {
  classMaterialCharges,
  classMaterialPayments,
  classTeachingRequests,
  sessions,
  guardians,
  families
} from '@/lib/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const charges = await db
      .select({
        id: classMaterialCharges.id,
        sessionId: classMaterialCharges.sessionId,
        sessionName: sessions.name,
        classTeachingRequestId: classMaterialCharges.classTeachingRequestId,
        className: classTeachingRequests.className,
        teacherFirstName: guardians.firstName,
        teacherLastName: guardians.lastName,
        amount: classMaterialCharges.amount,
        notes: classMaterialCharges.notes,
        createdAt: classMaterialCharges.createdAt,
        paidAmount: sql<number>`COALESCE(SUM(${classMaterialPayments.amount}), 0)`
      })
      .from(classMaterialCharges)
      .leftJoin(classTeachingRequests, eq(classMaterialCharges.classTeachingRequestId, classTeachingRequests.id))
      .leftJoin(sessions, eq(classMaterialCharges.sessionId, sessions.id))
      .leftJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
      .leftJoin(classMaterialPayments, eq(classMaterialPayments.chargeId, classMaterialCharges.id))
      .groupBy(classMaterialCharges.id)
      .orderBy(desc(classMaterialCharges.createdAt))

    return NextResponse.json({ charges })
  } catch (error) {
    console.error('Error fetching material charges:', error)
    return NextResponse.json({ error: 'Failed to fetch material charges' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { sessionId, classTeachingRequestId, amount, notes } = await request.json()

    if (!sessionId || !classTeachingRequestId || !amount) {
      return NextResponse.json({ error: 'Session, class, and amount are required' }, { status: 400 })
    }

    const chargeId = randomUUID()
    await db.insert(classMaterialCharges).values({
      id: chargeId,
      sessionId,
      classTeachingRequestId,
      amount,
      notes: notes?.trim() || null,
      createdBy: auth.session.user.id
    })

    return NextResponse.json({ success: true, id: chargeId })
  } catch (error) {
    console.error('Error creating material charge:', error)
    return NextResponse.json({ error: 'Failed to create material charge' }, { status: 500 })
  }
}
