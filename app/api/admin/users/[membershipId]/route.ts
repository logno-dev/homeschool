import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { membershipId } = await params
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership id is required' }, { status: 400 })
    }

    const { WorkOS } = await import('@workos-inc/node') as unknown as {
      WorkOS: new (apiKey: string) => {
        userManagement: {
          deactivateOrganizationMembership: (id: string) => Promise<void>
        }
      }
    }

    const workos = new WorkOS(process.env.WORKOS_API_KEY || '')
    await workos.userManagement.deactivateOrganizationMembership(membershipId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating WorkOS membership:', error)
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 })
  }
}
