'use client'

import React from 'react'

export interface UserSessionData {
  userId: string
  email: string
  name: string
  role: string
  familyId: string | null
  isMainContact: boolean
  hasTeacherRole: boolean
  familyName: string | null
  annualFeePaid: boolean
  lastUpdated: number
}

const SESSION_KEY = 'dvclc_user_session'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

class UserSessionManager {
  private static instance: UserSessionManager
  private cachedData: UserSessionData | null = null

  private constructor() {}

  static getInstance(): UserSessionManager {
    if (!UserSessionManager.instance) {
      UserSessionManager.instance = new UserSessionManager()
    }
    return UserSessionManager.instance
  }

  // Store user session data
  setUserData(data: Omit<UserSessionData, 'lastUpdated'>): void {
    if (typeof window === 'undefined') return

    const sessionData: UserSessionData = {
      ...data,
      lastUpdated: Date.now()
    }

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
      this.cachedData = sessionData
    } catch (error) {
      console.warn('Failed to store user session data:', error)
    }
  }

  // Get user session data from cache or storage
  getUserData(): UserSessionData | null {
    if (typeof window === 'undefined') return null

    // Return cached data if available and fresh
    if (this.cachedData && this.isDataFresh(this.cachedData)) {
      return this.cachedData
    }

    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (!stored) return null

      const data: UserSessionData = JSON.parse(stored)
      
      // Check if data is still fresh
      if (this.isDataFresh(data)) {
        this.cachedData = data
        return data
      } else {
        // Data is stale, remove it
        this.clearUserData()
        return null
      }
    } catch (error) {
      console.warn('Failed to retrieve user session data:', error)
      this.clearUserData()
      return null
    }
  }

  // Clear user session data
  clearUserData(): void {
    if (typeof window === 'undefined') return

    try {
      sessionStorage.removeItem(SESSION_KEY)
      this.cachedData = null
    } catch (error) {
      console.warn('Failed to clear user session data:', error)
    }
  }

  // Check if cached data is still fresh
  private isDataFresh(data: UserSessionData): boolean {
    return Date.now() - data.lastUpdated < CACHE_DURATION
  }

  // Force refresh of user data
  async refreshUserData(): Promise<UserSessionData | null> {
    if (typeof window === 'undefined') return null

    try {
      const response = await fetch('/api/user/session-data')
      if (!response.ok) {
        throw new Error('Failed to fetch user data')
      }

      const userData = await response.json()
      this.setUserData(userData)
      return this.getUserData()
    } catch (error) {
      console.error('Failed to refresh user data:', error)
      return null
    }
  }
}

// Export singleton instance
export const userSession = UserSessionManager.getInstance()

// Helper functions for easy access to user data
export function getUserRole(): string | null {
  const data = userSession.getUserData()
  return data?.role || null
}

export function getUserFamilyId(): string | null {
  const data = userSession.getUserData()
  return data?.familyId || null
}

export function isUserAdmin(): boolean {
  const role = getUserRole()
  return role === 'admin' || role === 'moderator'
}

export function isUserTeacher(): boolean {
  const data = userSession.getUserData()
  return data?.hasTeacherRole || false
}

export function isMainContact(): boolean {
  const data = userSession.getUserData()
  return data?.isMainContact || false
}

export function hasAnnualFeePaid(): boolean {
  const data = userSession.getUserData()
  return data?.annualFeePaid || false
}

export function getUserName(): string | null {
  const data = userSession.getUserData()
  return data?.name || null
}

export function getUserEmail(): string | null {
  const data = userSession.getUserData()
  return data?.email || null
}

export function getFamilyName(): string | null {
  const data = userSession.getUserData()
  return data?.familyName || null
}

// Hook for React components to get user data with automatic refresh
export function useUserSession() {
  const [userData, setUserData] = React.useState<UserSessionData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadUserData = async () => {
      let data = userSession.getUserData()
      
      // If no cached data, try to refresh
      if (!data) {
        data = await userSession.refreshUserData()
      }
      
      setUserData(data)
      setLoading(false)
    }

    loadUserData()
  }, [])

  const refreshData = async () => {
    setLoading(true)
    const data = await userSession.refreshUserData()
    setUserData(data)
    setLoading(false)
  }

  return {
    userData,
    loading,
    refreshData,
    isAdmin: userData?.role === 'admin' || userData?.role === 'moderator',
    isTeacher: userData?.hasTeacherRole || false,
    isMainContact: userData?.isMainContact || false,
    hasAnnualFeePaid: userData?.annualFeePaid || false
  }
}

