'use client'

import { signOut, useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'

export default function TopBar() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  // Don't show the top bar on auth pages or if no session
  if (!session || pathname === '/signin' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password') {
    return null
  }

  // Don't show back to dashboard link on the dashboard itself
  const isDashboard = pathname === '/dashboard'

  // Get page title based on pathname
  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'DVCLC Dashboard'
    if (pathname === '/teacher') return 'Teacher Dashboard'
    if (pathname === '/class-teaching') return 'Class Teaching Registration'
    if (pathname === '/calendar') return 'Calendar'
    if (pathname.startsWith('/family/profile')) return 'Family Profile'
    if (pathname.startsWith('/family/payments')) return 'Family Payments'
    if (pathname.startsWith('/family/')) return 'Family'
    if (pathname.startsWith('/admin')) return 'Admin Panel'
    if (pathname.startsWith('/registration')) return 'Class Registration'
    return 'DVCLC'
  }

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              {getPageTitle()}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {!isDashboard && (
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Back to Dashboard
              </button>
            )}
            {session?.user?.name && (
              <span className="text-gray-700">
                {session.user.name}
              </span>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/', redirect: true })}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}