import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { membershipId } = await params
    const { role } = await request.json()

    if (!membershipId || !role) {
      return NextResponse.json({ error: 'Membership id and role are required' }, { status: 400 })
    }

    const { WorkOS } = await import('@workos-inc/node') as unknown as {
      WorkOS: new (apiKey: string) => {
        userManagement: {
          updateOrganizationMembership: (id: string, params: { role: string }) => Promise<void>
        }
      }
    }

    const workos = new WorkOS(process.env.WORKOS_API_KEY || '')
    const updated = await workos.userManagement.updateOrganizationMembership(membershipId, { roleSlug: role })

    return NextResponse.json({ success: true, role, membership: updated })
  } catch (error) {
    console.error('Error updating WorkOS role:', error)
    const message = error instanceof Error ? error.message : 'Failed to update role'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
