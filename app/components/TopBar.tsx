'use client'

import { useAuth } from '@/lib/auth-client'
import { getReturnToUrl } from '@/lib/client-env'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isUserAdmin, userSession } from '@/lib/user-session'
import BrandLogo from './BrandLogo'

export default function TopBar() {
  const { user, signOut, isEmulating, exitEmulation } = useAuth()
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showAdminLinks, setShowAdminLinks] = useState(false)

  const userName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    : ''

  useEffect(() => {
    if (!user) return
    const cached = userSession.getUserData()
    if (cached) {
       setShowAdminLinks(isUserAdmin() || Boolean(cached.adminModules?.length))
      return
    }

    let isActive = true
    userSession.refreshUserData().then((userData) => {
      if (isActive) {
         setShowAdminLinks(isUserAdmin() || Boolean(userData?.adminModules?.length))
      }
    })
    return () => {
      isActive = false
    }
  }, [user])

  // Don't show the top bar on auth pages or if no session
  if (!user || pathname === '/signin' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password') {
    return null
  }

  const mainNav = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Registration', href: '/registration' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Payments', href: '/family/payments' },
    { label: 'Resources', href: '/resources' }
  ]

  const moreNav = [
    { label: 'Account Settings', href: '/account' },
    { label: 'Family Profile', href: '/family/profile' },
    { label: 'Teacher Dashboard', href: '/teacher' },
    { label: 'Calendar', href: '/calendar' },
    ...(showAdminLinks ? [{ label: 'Admin Panel', href: '/admin' }] : [])
  ]

  return (
    <>
    {isEmulating && (
      <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-sm text-amber-900 flex items-center justify-between gap-3">
        <span>Emulating this user. Your admin session is preserved in its original tab.</span>
        <button onClick={exitEmulation} className="font-semibold underline whitespace-nowrap">Exit emulation</button>
      </div>
    )}
    <nav className="sticky top-0 z-50 bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              className="sm:hidden p-2 rounded-md border border-gray-200 text-gray-600"
              aria-label="Toggle navigation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <a href="/" className="shrink-0">
              <BrandLogo variant="horizontal" width={150} alt="DVCLC home" />
            </a>
            <div className="hidden sm:flex items-center gap-2">
              {mainNav.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                  >
                    {item.label}
                  </a>
                )
              })}
              <div className="relative">
                <button
                  onClick={() => setShowMore((prev) => !prev)}
                  className="px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  More
                </button>
                {showMore && (
                  <div className="absolute left-0 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg z-50">
                    <div className="py-2">
                      {moreNav.map((item) => (
                        <a
                          key={item.href}
                          href={item.href}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {item.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userName && (
              <span className="text-gray-600 text-xs sm:text-sm truncate max-w-24 sm:max-w-none">
                {userName}
              </span>
            )}
            <button
              onClick={() => {
                void signOut({ returnTo: getReturnToUrl() })
              }}
              aria-label="Sign out"
              title="Sign out"
              className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-md"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {showMenu && (
        <div className="sm:hidden border-t border-gray-200 px-4 pb-4">
          <div className="grid gap-2 pt-3">
            {mainNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100"
              >
                {item.label}
              </a>
            ))}
            <div className="border-t border-gray-200 pt-2 mt-2">
              {moreNav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
    </>
  )
}
