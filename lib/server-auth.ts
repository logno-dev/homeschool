import { withAuth } from '@workos-inc/authkit-nextjs'
import { getUsers } from './database'
import { redirect } from 'next/navigation'

type AppRole = 'admin' | 'moderator' | 'user'

const WORKOS_ROLE_MAP: Record<string, AppRole> = {
  'org-admin': 'admin',
  'org-staff': 'moderator',
  'org-user': 'user',
  'admin': 'admin',
  'staff': 'moderator',
  'user': 'user'
}

function normalizeRole(role?: string | null): AppRole {
  if (role === 'admin') return 'admin'
  if (role === 'moderator') return 'moderator'
  return 'user'
}

export function getAppRoleFromSession(session: { role?: string; roles?: string[] } | null): AppRole | null {
  if (!session) return null
  const candidates = [session.role, ...(session.roles ?? [])]
    .filter((role): role is string => typeof role === 'string' && role.length > 0)
    .map((role) => role.toLowerCase().trim())

  for (const candidate of candidates) {
    const mapped = WORKOS_ROLE_MAP[candidate]
    if (mapped === 'admin') return 'admin'
  }

  for (const candidate of candidates) {
    const mapped = WORKOS_ROLE_MAP[candidate]
    if (mapped === 'moderator') return 'moderator'
  }

  for (const candidate of candidates) {
    const mapped = WORKOS_ROLE_MAP[candidate]
    if (mapped === 'user') return 'user'
  }

  return null
}

export async function getAppRole(session: { role?: string; roles?: string[]; user?: { id: string } } | null): Promise<AppRole> {
  const workosRole = getAppRoleFromSession(session)
  if (process.env.NODE_ENV !== 'production') {
    console.log('WorkOS role snapshot:', {
      userId: session?.user?.id,
      role: session?.role,
      roles: session?.roles
    })
  }
  if (workosRole) return workosRole

  if (!session?.user?.id) return 'user'

  try {
    const { getGuardianById, getUserById } = await import('./database')
    const guardian = await getGuardianById(session.user.id)
    if (guardian?.role) return normalizeRole(guardian.role)

    const user = await getUserById(session.user.id)
    if (user?.role) return normalizeRole(user.role)
  } catch (error) {
    console.error('Error determining user role:', error)
  }

  return 'user'
}

export async function getAuthenticatedUser() {
  const session = await withAuth({ ensureSignedIn: true })

  if (!session?.user?.id) {
    redirect('/signin')
  }

  return session
}

export async function checkAdminRole(session: { role?: string; roles?: string[]; user?: { id: string } } | null): Promise<boolean> {
  const role = await getAppRole(session)
  if (process.env.NODE_ENV !== 'production') {
    console.log('Resolved app role:', role)
  }
  return role === 'admin' || role === 'moderator'
}

export async function requireAdminAccess() {
  const session = await getAuthenticatedUser()
  const isAdmin = await checkAdminRole(session)
  
  if (!isAdmin) {
    redirect('/dashboard')
  }
  
  return session
}

export async function getAuthenticatedAdmin() {
  const session = await withAuth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 }
  }

  const isAdmin = await checkAdminRole(session)
  if (!isAdmin) {
    return { error: 'Forbidden', status: 403 }
  }

  const role = await getAppRole(session)
  return { session, isAdmin: true, role }
}

export async function getAuthenticatedUserSession() {
  const session = await withAuth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 }
  }

  return { session }
}

export async function fetchUsersForAdmin() {
  try {
    const users = await getUsers()
    return users
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
}

export async function fetchSessionsForAdmin() {
  try {
    const { getSessions } = await import('./database')
    const sessions = await getSessions()
    return sessions
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return []
  }
}

export async function fetchFamilyData(userId: string) {
  try {
    // Import database functions here to avoid circular dependencies
    const { getGuardianById, getFamilyById, getGuardiansByFamily, getChildrenByFamily } = await import('./database')
    
    // Get the guardian record for the current user (not users table)
    const guardian = await getGuardianById(userId)
    if (!guardian?.familyId) {
      return null
    }

    const [family, guardians, children] = await Promise.all([
      getFamilyById(guardian.familyId),
      getGuardiansByFamily(guardian.familyId),
      getChildrenByFamily(guardian.familyId)
    ])

    return {
      family,
      guardians,
      children
    }
  } catch (error) {
    console.error('Error fetching family data:', error)
    return null
  }
}
