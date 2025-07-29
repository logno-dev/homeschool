import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { getUsers } from './database'
import { redirect } from 'next/navigation'

export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect('/signin')
  }
  
  return session
}

export async function checkAdminRole(userId: string): Promise<boolean> {
  try {
    // Check guardian table first (primary user data)
    const { getGuardianById, getUserById } = await import('./database')
    
    const guardian = await getGuardianById(userId)
    if (guardian && (guardian.role === 'admin' || guardian.role === 'moderator')) {
      return true
    }
    
    // Fallback to users table for backward compatibility
    const user = await getUserById(userId)
    if (user && (user.role === 'admin' || user.role === 'moderator')) {
      return true
    }
    
    return false
  } catch (error) {
    console.error('Error checking admin role:', error)
    return false
  }
}

export async function requireAdminAccess() {
  const session = await getAuthenticatedUser()
  const isAdmin = await checkAdminRole(session.user.id)
  
  if (!isAdmin) {
    redirect('/dashboard')
  }
  
  return session
}

export async function getAuthenticatedAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 }
  }

  const isAdmin = await checkAdminRole(session.user.id)
  if (!isAdmin) {
    return { error: 'Forbidden', status: 403 }
  }

  return { session, isAdmin: true }
}

export async function getAuthenticatedUserSession() {
  const session = await getServerSession(authOptions)
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