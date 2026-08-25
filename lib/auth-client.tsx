'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

type AuthUser = {
  id: string
  email: string
  firstName: string
  lastName: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  requiresAcknowledgement: boolean
  refresh: () => Promise<void>
  signOut: (options?: { returnTo?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchSession() {
  const response = await fetch('/api/auth/session', { cache: 'no-store' })
  if (!response.ok) {
    return { user: null, requiresAcknowledgement: false }
  }

  const payload = await response.json()
  return {
    user: payload.user as AuthUser | null,
    requiresAcknowledgement: Boolean(payload.requiresAcknowledgement)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false)
  const pathname = usePathname()

  const refresh = useCallback(async () => {
    try {
      const nextSession = await fetchSession()
      setUser(nextSession.user)
      setRequiresAcknowledgement(nextSession.requiresAcknowledgement)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!loading && user && requiresAcknowledgement && pathname !== '/account/acknowledgements') {
      window.location.assign('/account/acknowledgements')
    }
  }, [loading, pathname, requiresAcknowledgement, user])

  const signOut = useCallback(async (options?: { returnTo?: string }) => {
    await fetch('/api/auth/signout', { method: 'POST' })
    setUser(null)
    setRequiresAcknowledgement(false)
    if (options?.returnTo) {
      window.location.assign(options.returnTo)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      requiresAcknowledgement,
      refresh,
      signOut
    }),
    [loading, refresh, requiresAcknowledgement, signOut, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
