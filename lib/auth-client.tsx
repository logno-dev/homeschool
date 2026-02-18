'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type AuthUser = {
  id: string
  email: string
  firstName: string
  lastName: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: (options?: { returnTo?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchSession() {
  const response = await fetch('/api/auth/session', { cache: 'no-store' })
  if (!response.ok) {
    return null
  }

  const payload = await response.json()
  return payload.user as AuthUser | null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const nextUser = await fetchSession()
      setUser(nextUser)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signOut = useCallback(async (options?: { returnTo?: string }) => {
    await fetch('/api/auth/signout', { method: 'POST' })
    setUser(null)
    if (options?.returnTo) {
      window.location.assign(options.returnTo)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      signOut
    }),
    [loading, refresh, signOut, user]
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
