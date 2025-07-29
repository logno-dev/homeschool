'use client'

import React, { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { userSession } from '@/lib/user-session'

interface UserSessionProviderProps {
  children: React.ReactNode
}

export default function UserSessionProvider({ children }: UserSessionProviderProps) {
  const { data: session, status } = useSession()

  useEffect(() => {
    const initializeUserSession = async () => {
      if (status === 'authenticated' && session?.user) {
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
      } else if (status === 'unauthenticated') {
        // Clear cached data when user logs out
        userSession.clearUserData()
      }
    }

    initializeUserSession()
  }, [session, status])

  return <>{children}</>
}