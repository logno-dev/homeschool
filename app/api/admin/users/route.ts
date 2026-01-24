import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getUsers } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    // Get query parameters from the request
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '50' // Get more users by default
    const role = searchParams.get('role') // Optional role filter

    const validRoles = ['user', 'admin', 'moderator', 'member']
    const limitValue = Math.max(1, parseInt(limit, 10))
    const pageValue = Math.max(1, parseInt(page, 10))

    const allUsers = await getUsers()
    const filteredUsers = role && validRoles.includes(role)
      ? allUsers.filter((user) => user.role === role)
      : allUsers

    const totalCount = filteredUsers.length
    const totalPages = Math.max(1, Math.ceil(totalCount / limitValue))
    const offset = (pageValue - 1) * limitValue
    const pagedUsers = filteredUsers.slice(offset, offset + limitValue)

    const pagination = {
      page: pageValue,
      limit: limitValue,
      totalCount,
      totalPages,
      hasNext: pageValue < totalPages,
      hasPrev: pageValue > 1
    }
    return NextResponse.json({ 
      users: pagedUsers,
      pagination
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
