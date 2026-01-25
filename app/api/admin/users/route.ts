import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

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

    const validRoles = ['org-user', 'org-staff', 'org-admin', 'user', 'staff', 'admin']
    const limitValue = Math.max(1, parseInt(limit, 10))
    const pageValue = Math.max(1, parseInt(page, 10))

    const { WorkOS } = await import('@workos-inc/node') as unknown as {
      WorkOS: new (apiKey: string) => {
        userManagement: {
          listOrganizationMemberships: (params: { organizationId: string; limit: number; offset: number }) => Promise<{
            data: Array<{ id: string; role: string; status?: string; userId?: string; user: { email?: string; firstName?: string | null; lastName?: string | null } }>;
            listMetadata?: { total?: number };
          }>
          getUser: (id: string) => Promise<{ id: string; email: string; firstName?: string | null; lastName?: string | null }>
        }
      }
    }
    const workos = new WorkOS(process.env.WORKOS_API_KEY || '')
    const organizationId = (
      auth.session as {
        organizationId?: string
        orgId?: string
        organization?: { id?: string }
        user?: { organizationId?: string; orgId?: string; organization?: { id?: string } }
      }
    ).organizationId
      ?? (auth.session as { orgId?: string }).orgId
      ?? (auth.session as { organization?: { id?: string } }).organization?.id
      ?? (auth.session as { user?: { organizationId?: string } }).user?.organizationId
      ?? (auth.session as { user?: { orgId?: string } }).user?.orgId
      ?? (auth.session as { user?: { organization?: { id?: string } } }).user?.organization?.id

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const memberships = await workos.userManagement.listOrganizationMemberships({
      organizationId,
      limit: Math.max(100, limitValue),
      offset: 0
    })

    const getRoleSlug = (value: unknown) => {
      if (typeof value === 'string') return value
      if (value && typeof value === 'object' && 'slug' in value) {
        const slug = (value as { slug?: string }).slug
        return typeof slug === 'string' ? slug : ''
      }
      return ''
    }

    const filteredMemberships = role && validRoles.includes(role)
      ? memberships.data.filter((membership: { role: unknown }) => getRoleSlug(membership.role) === role)
      : memberships.data

    const totalCount = filteredMemberships.length
    const totalPages = Math.max(1, Math.ceil(totalCount / limitValue))
    const offset = (pageValue - 1) * limitValue
    const pagedUsers = await Promise.all(
      filteredMemberships.slice(offset, offset + limitValue).map(async (membership: {
        id: string
        role: unknown
        status?: string
        userId?: string
        user?: { id?: string; email?: string; firstName?: string | null; lastName?: string | null }
      }) => {
        const membershipUserId = membership.userId || membership.user?.id
        let userRecord = membership.user

        if ((!userRecord || !userRecord.email) && membershipUserId) {
          const fetched = await workos.userManagement.getUser(membershipUserId)
          userRecord = {
            id: fetched.id,
            email: fetched.email,
            firstName: fetched.firstName,
            lastName: fetched.lastName
          }
        }

        return {
          id: membership.id,
          userId: membershipUserId,
          email: userRecord?.email || '',
          firstName: userRecord?.firstName || '',
          lastName: userRecord?.lastName || '',
          role: getRoleSlug(membership.role),
          status: membership.status
        }
      })
    )

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
