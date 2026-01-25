import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { teacherReimbursements, classTeachingRequests, sessions, guardians } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const reimbursements = await db
      .select({
        id: teacherReimbursements.id,
        sessionId: teacherReimbursements.sessionId,
        sessionName: sessions.name,
        classTeachingRequestId: teacherReimbursements.classTeachingRequestId,
        className: classTeachingRequests.className,
        guardianId: teacherReimbursements.guardianId,
        teacherFirstName: guardians.firstName,
        teacherLastName: guardians.lastName,
        amount: teacherReimbursements.amount,
        status: teacherReimbursements.status,
        paidDate: teacherReimbursements.paidDate,
        notes: teacherReimbursements.notes,
        createdAt: teacherReimbursements.createdAt
      })
      .from(teacherReimbursements)
      .leftJoin(classTeachingRequests, eq(teacherReimbursements.classTeachingRequestId, classTeachingRequests.id))
      .leftJoin(sessions, eq(teacherReimbursements.sessionId, sessions.id))
      .leftJoin(guardians, eq(teacherReimbursements.guardianId, guardians.id))
      .orderBy(desc(teacherReimbursements.createdAt))

    return NextResponse.json({ reimbursements })
  } catch (error) {
    console.error('Error fetching reimbursements:', error)
    return NextResponse.json({ error: 'Failed to fetch reimbursements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { sessionId, classTeachingRequestId, guardianId, amount, notes } = await request.json()

    if (!sessionId || !classTeachingRequestId || !guardianId || !amount) {
      return NextResponse.json({ error: 'Session, class, teacher, and amount are required' }, { status: 400 })
    }

    const reimbursementId = randomUUID()
    await db.insert(teacherReimbursements).values({
      id: reimbursementId,
      sessionId,
      classTeachingRequestId,
      guardianId,
      amount,
      notes: notes?.trim() || null
    })

    return NextResponse.json({ success: true, id: reimbursementId })
  } catch (error) {
    console.error('Error creating reimbursement:', error)
    return NextResponse.json({ error: 'Failed to create reimbursement' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id, status, paidDate } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'Reimbursement id and status are required' }, { status: 400 })
    }

    await db
      .update(teacherReimbursements)
      .set({
        status,
        paidDate: paidDate || null,
        updatedAt: new Date().toISOString()
      })
      .where(eq(teacherReimbursements.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating reimbursement:', error)
    return NextResponse.json({ error: 'Failed to update reimbursement' }, { status: 500 })
  }
}
