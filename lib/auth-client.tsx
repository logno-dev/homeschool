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
  isEmulating: boolean
  exitEmulation: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchSession() {
  const emulationToken = typeof window !== 'undefined' ? sessionStorage.getItem('dvclc_emulation_token') : null
  const response = await fetch('/api/auth/session', {
    cache: 'no-store',
    headers: emulationToken ? { 'x-dvclc-emulation-token': emulationToken } : undefined
  })
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
  const [isEmulating, setIsEmulating] = useState(false)
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
    const token = sessionStorage.getItem('dvclc_emulation_token')
    setIsEmulating(Boolean(token))
    if (!token) return

    const originalFetch = window.fetch
    window.fetch = (input, init = {}) => {
      const headers = new Headers(init.headers || {})
      headers.set('x-dvclc-emulation-token', token)
      const requestInput = typeof input === 'string' && input.startsWith('/') && !input.startsWith('/emulate') && !input.startsWith('/_next')
        ? `/emulate${input}`
        : input
      return originalFetch(requestInput, { ...init, headers })
    }

    const rewritePath = (value: string | URL | null | undefined) => {
      if (!value) return value
      const path = String(value)
      return path.startsWith('/') && !path.startsWith('/emulate') && !path.startsWith('/_next') ? `/emulate${path}` : value
    }
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState
    history.pushState = (state, unused, url) => originalPushState.call(history, state, unused, rewritePath(url))
    history.replaceState = (state, unused, url) => originalReplaceState.call(history, state, unused, rewritePath(url))
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a')
      if (!anchor || event.defaultPrevented || anchor.target === '_blank') return
      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/') || href.startsWith('/emulate') || href.startsWith('/_next')) return
      event.preventDefault()
      window.location.assign(`/emulate${href}`)
    }
    document.addEventListener('click', handleClick)

    return () => {
      window.fetch = originalFetch
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
      document.removeEventListener('click', handleClick)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!loading && user && requiresAcknowledgement && pathname !== '/account/acknowledgements') {
      window.location.assign(isEmulating ? '/emulate/account/acknowledgements' : '/account/acknowledgements')
    }
  }, [isEmulating, loading, pathname, requiresAcknowledgement, user])

  const signOut = useCallback(async (options?: { returnTo?: string }) => {
    await fetch('/api/auth/signout', { method: 'POST' })
    setUser(null)
    setRequiresAcknowledgement(false)
    if (options?.returnTo) {
      window.location.assign(options.returnTo)
    }
  }, [])

  const exitEmulation = useCallback(() => {
    sessionStorage.removeItem('dvclc_emulation_token')
    document.cookie = 'dvclc_emulation_token=; Path=/emulate; Max-Age=0; SameSite=Lax'
    setIsEmulating(false)
    window.location.assign('/admin/users')
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      requiresAcknowledgement,
      refresh,
      signOut,
      isEmulating,
      exitEmulation
    }),
    [exitEmulation, isEmulating, loading, refresh, requiresAcknowledgement, signOut, user]
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
