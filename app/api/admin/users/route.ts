import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { authAccounts, guardians, users } from '@/lib/schema'

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

        return {
          id: user.id,
          userId: user.id,
          email: guardian?.email || account?.email || user.email,
          firstName: guardian?.firstName || user.firstName,
          lastName: guardian?.lastName || user.lastName,
          role,
          status: account ? (account.isActive ? 'active' : 'inactive') : 'inactive'
        }
      })
      .filter((user) => !roleFilter || user.role === roleFilter)

    const totalCount = combined.length
    const totalPages = Math.max(1, Math.ceil(totalCount / limit))
    const offset = (page - 1) * limit
    const paged = combined.slice(offset, offset + limit)

    return NextResponse.json({
      users: paged,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
