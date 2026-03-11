import { redirect } from 'next/navigation'
import { getUsers } from './database'
import { getCurrentAuthSession, type AppAuthSession } from '@/lib/auth-server'

type AppRole = 'admin' | 'moderator' | 'user'

const ROLE_MAP: Record<string, AppRole> = {
  admin: 'admin',
  moderator: 'moderator',
  staff: 'moderator',
  user: 'user',
  member: 'user'
}

function normalizeRole(role?: string | null): AppRole {
  if (!role) return 'user'
  return ROLE_MAP[role.toLowerCase()] ?? 'user'
}

export async function getAppRole(session: { role?: string; roles?: string[]; user?: { id: string } } | null): Promise<AppRole> {
  if (!session?.user?.id) return 'user'

  try {
    const { getUserById } = await import('./database')
    const user = await getUserById(session.user.id)
    if (user?.role) return normalizeRole(user.role)
  } catch (error) {
    console.error('Error determining user role:', error)
  }

  return 'user'
}

export async function getAuthenticatedUser() {
  const session = await getCurrentAuthSession()
  if (!session?.user?.id) {
    redirect('/signin')
  }
  return session as AppAuthSession
}

export async function checkAdminRole(session: { role?: string; roles?: string[]; user?: { id: string } } | null): Promise<boolean> {
  const role = await getAppRole(session)
  return role === 'admin' || role === 'moderator'
}

export async function checkAdminRoleFromSession(
  session: { role?: string; roles?: string[]; user?: { id: string } } | { user?: null } | null
): Promise<boolean> {
  if (!session || !('user' in session) || !session.user) {
    return false
  }

  return checkAdminRole(session as { role?: string; roles?: string[]; user?: { id: string } })
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
  const session = await getCurrentAuthSession()
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 as const }
  }

  const isAdmin = await checkAdminRole(session)
  if (!isAdmin) {
    return { error: 'Forbidden', status: 403 as const }
  }

  const role = await getAppRole(session)
  return { session, isAdmin: true, role }
}

export async function getAuthenticatedUserSession() {
  const session = await getCurrentAuthSession()
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 as const }
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
    const { getGuardianById, getFamilyById, getGuardiansByFamily, getChildrenByFamily } = await import('./database')

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
