import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { scholarshipFundTransactions, guardians, families } from '@/lib/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const balanceResult = await db
      .select({
        balance: sql<number>`COALESCE(SUM(${scholarshipFundTransactions.amount}), 0)`
      })
      .from(scholarshipFundTransactions)

    const transactions = await db
      .select({
        id: scholarshipFundTransactions.id,
        amount: scholarshipFundTransactions.amount,
        transactionType: scholarshipFundTransactions.transactionType,
        source: scholarshipFundTransactions.source,
        notes: scholarshipFundTransactions.notes,
        createdAt: scholarshipFundTransactions.createdAt,
        familyName: families.name,
        createdByFirstName: guardians.firstName,
        createdByLastName: guardians.lastName
      })
      .from(scholarshipFundTransactions)
      .leftJoin(families, eq(scholarshipFundTransactions.familyId, families.id))
      .leftJoin(guardians, eq(scholarshipFundTransactions.createdBy, guardians.id))
      .orderBy(desc(scholarshipFundTransactions.createdAt))

    return NextResponse.json({
      balance: balanceResult[0]?.balance || 0,
      transactions
    })
  } catch (error) {
    console.error('Error fetching scholarship fund data:', error)
    return NextResponse.json({ error: 'Failed to fetch scholarship fund data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { amount, notes } = await request.json()
    const donationAmount = Number(amount)

    if (!donationAmount || donationAmount <= 0) {
      return NextResponse.json({ error: 'Donation amount must be greater than 0.' }, { status: 400 })
    }

    await db.insert(scholarshipFundTransactions).values({
      id: randomUUID(),
      amount: donationAmount,
      transactionType: 'donation',
      source: 'cash',
      notes: notes?.trim() || 'Admin cash donation',
      createdBy: auth.session.user.id,
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error creating scholarship donation:', error)
    return NextResponse.json({ error: 'Failed to create donation' }, { status: 500 })
  }
}
