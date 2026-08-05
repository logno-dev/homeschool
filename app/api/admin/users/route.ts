import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { authAccounts, guardians, sessions, familySessionFees, users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10))
    const roleFilter = searchParams.get('role')
    const searchTerm = (searchParams.get('search') || '').trim().toLowerCase()
    const accountStatusFilter = searchParams.get('status') || 'all'
    const paymentStatusFilter = searchParams.get('paymentStatus') || 'all'
    const sessionFilter = searchParams.get('sessionId') || 'all'
    const isExport = searchParams.get('export') === '1' || searchParams.get('export') === 'true'
    const requestedLimit = isExport ? Number.MAX_SAFE_INTEGER : limit

    const now = new Date()

    const feesByFamily = new Map<string, {
      sessions: Array<{ id: string; name: string; startDate: string | null; endDate: string | null }>
      latestSession: {
        id: string
        name: string
        endDate: string | null
      } | null
      latestSessionDate: number | null
      totalOutstanding: number
      hasDelinquent: boolean
    }>()

    const familyFees = await db
      .select({
        familyId: familySessionFees.familyId,
        sessionId: familySessionFees.sessionId,
        sessionName: sessions.name,
        sessionStartDate: sessions.startDate,
        sessionEndDate: sessions.endDate,
        totalFee: familySessionFees.totalFee,
        paidAmount: familySessionFees.paidAmount,
        status: familySessionFees.status,
        dueDate: familySessionFees.dueDate
      })
      .from(familySessionFees)
      .leftJoin(sessions, eq(familySessionFees.sessionId, sessions.id))

    for (const fee of familyFees) {
      if (!fee.familyId || !fee.sessionId || !fee.sessionName) {
        continue
      }

      const summary = feesByFamily.get(fee.familyId) || {
        sessions: [],
        latestSession: null as {
          id: string
          name: string
          endDate: string | null
        } | null,
        latestSessionDate: null,
        totalOutstanding: 0,
        hasDelinquent: false
      }

      if (!summary.sessions.some((session) => session.id === fee.sessionId)) {
        summary.sessions.push({
          id: fee.sessionId,
          name: fee.sessionName,
          endDate: fee.sessionEndDate || null,
          startDate: fee.sessionStartDate || null
        })
      }

      const candidateLatestDate = fee.sessionEndDate
        ? new Date(fee.sessionEndDate).getTime()
        : fee.dueDate
          ? new Date(fee.dueDate).getTime()
          : NaN

      const currentLatestDate = summary.latestSessionDate ?? NaN

      if (!summary.latestSession) {
        summary.latestSession = {
          id: fee.sessionId,
          name: fee.sessionName,
          endDate: fee.sessionEndDate || null
        }
        summary.latestSessionDate = Number.isNaN(candidateLatestDate) ? null : candidateLatestDate
      } else if (!Number.isNaN(candidateLatestDate) && (Number.isNaN(currentLatestDate) || candidateLatestDate > currentLatestDate)) {
        summary.latestSession = {
          id: fee.sessionId,
          name: fee.sessionName,
          endDate: fee.sessionEndDate || null
        }
        summary.latestSessionDate = Number.isNaN(candidateLatestDate) ? null : candidateLatestDate
      }

      const totalFee = Number(fee.totalFee || 0)
      const paidAmount = Number(fee.paidAmount || 0)
      const remaining = Math.max(0, totalFee - paidAmount)
      summary.totalOutstanding += remaining

      const isOverdueByStatus = fee.status === 'overdue'
      const parsedDueDate = fee.dueDate ? new Date(fee.dueDate) : null
      const isOverdueByDate = remaining > 0 && parsedDueDate ? parsedDueDate.getTime() < now.getTime() : false

      if (isOverdueByStatus || isOverdueByDate) {
        summary.hasDelinquent = true
      }

      feesByFamily.set(fee.familyId, summary)
    }

    const allUsers = await db.select().from(users)
    const allAccounts = await db.select().from(authAccounts)
    const allGuardians = await db.select().from(guardians)

    const accountByUserId = new Map(allAccounts.map((account) => [account.userId, account]))
    const guardianById = new Map(allGuardians.map((guardian) => [guardian.id, guardian]))

    const combined = allUsers
      .map((user) => {
        const guardian = guardianById.get(user.id)
        const account = accountByUserId.get(user.id)
        const role = user.role || 'user'

        const familyId = guardian?.familyId || user.familyId || null
        const paymentInfo = familyId ? feesByFamily.get(familyId) : null
        const paymentStatus = paymentInfo
          ? paymentInfo.hasDelinquent
            ? 'delinquent'
            : paymentInfo.totalOutstanding > 0
              ? 'outstanding'
              : 'paid'
          : 'no_fees'
        const enrolledSessions = paymentInfo ? paymentInfo.sessions : []
        const latestSession = paymentInfo ? paymentInfo.latestSession : null

        return {
          id: user.id,
          userId: user.id,
          email: guardian?.email || account?.email || user.email,
          firstName: guardian?.firstName || user.firstName,
          lastName: guardian?.lastName || user.lastName,
          role,
          status: account ? (account.isActive ? 'active' : 'inactive') : 'inactive',
          familyId: guardian?.familyId || user.familyId,
          enrolledSessions,
          latestSession,
          paymentStatus,
          paymentTotalOutstanding: paymentInfo ? paymentInfo.totalOutstanding : 0
        }
      })
      .filter((user) => {
        const matchesSearch = !searchTerm
          || `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(searchTerm)

        const matchesRole = roleFilter ? user.role === roleFilter : true
        const matchesAccountStatus = accountStatusFilter === 'all' ? true : user.status === accountStatusFilter

        const matchesSession = sessionFilter === 'all'
          ? true
          : user.enrolledSessions.some((session) => session.id === sessionFilter)

        const matchesPaymentStatus = paymentStatusFilter === 'all'
          ? true
          : user.paymentStatus === paymentStatusFilter

        return matchesSearch && matchesRole && matchesAccountStatus && matchesSession && matchesPaymentStatus
      })

    const sortedCombined = combined.sort((a, b) => {
      const aName = `${a.firstName} ${a.lastName}`.trim().toLowerCase()
      const bName = `${b.firstName} ${b.lastName}`.trim().toLowerCase()

      if (aName === bName) {
        return a.email.toLowerCase().localeCompare(b.email.toLowerCase())
      }

      return aName.localeCompare(bName)
    })

    const totalCount = sortedCombined.length

    const totalPages = isExport ? 1 : Math.max(1, Math.ceil(totalCount / requestedLimit))
    const offset = (page - 1) * requestedLimit
    const paged = sortedCombined.slice(offset, offset + requestedLimit)

    return NextResponse.json({
      users: paged,
      pagination: {
        page,
        limit: requestedLimit,
        totalCount,
        totalPages,
        hasNext: !isExport && page < totalPages,
        hasPrev: page > 1
      },
      exportMode: isExport
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
