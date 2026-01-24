'use client'

import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components'
import { ToastProvider } from './components/ToastContainer'
import { RegistrationProvider } from './components/RegistrationContext'
import UserSessionProvider from './components/UserSessionProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthKitProvider>
      <UserSessionProvider>
        <ToastProvider>
          <RegistrationProvider>
            {children}
          </RegistrationProvider>
        </ToastProvider>
      </UserSessionProvider>
    </AuthKitProvider>
  )
}
