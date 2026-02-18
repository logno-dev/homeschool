'use client'

import { ToastProvider } from './components/ToastContainer'
import { RegistrationProvider } from './components/RegistrationContext'
import UserSessionProvider from './components/UserSessionProvider'
import { AuthProvider } from '@/lib/auth-client'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UserSessionProvider>
        <ToastProvider>
          <RegistrationProvider>
            {children}
          </RegistrationProvider>
        </ToastProvider>
      </UserSessionProvider>
    </AuthProvider>
  )
}
