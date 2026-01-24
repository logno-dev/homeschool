'use client'

import React, { useEffect } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { userSession } from '@/lib/user-session'

interface UserSessionProviderProps {
  children: React.ReactNode
}

export default function UserSessionProvider({ children }: UserSessionProviderProps) {
  const { user, loading } = useAuth()

  useEffect(() => {
    const initializeUserSession = async () => {
      if (!loading && user) {
        // Check if we already have fresh cached data
        const cachedData = userSession.getUserData()
        if (cachedData) {
          return // Data is already cached and fresh
        }

        // Fetch and cache user session data
        try {
          await userSession.refreshUserData()
        } catch (error) {
          console.error('Failed to initialize user session:', error)
        }
      } else if (!loading && !user) {
        // Clear cached data when user logs out
        userSession.clearUserData()
      }
    }

    initializeUserSession()
  }, [user, loading])

  return <>{children}</>
}
