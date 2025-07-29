'use client'

import { SessionProvider } from 'next-auth/react'
import { ToastProvider } from './components/ToastContainer'
import { RegistrationProvider } from './components/RegistrationContext'
import UserSessionProvider from './components/UserSessionProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider 
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true}
    >
      <UserSessionProvider>
        <ToastProvider>
          <RegistrationProvider>
            {children}
          </RegistrationProvider>
        </ToastProvider>
      </UserSessionProvider>
    </SessionProvider>
  )
}