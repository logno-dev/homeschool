'use client'

import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { getReturnToUrl } from '@/lib/client-env'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isUserAdmin, userSession } from '@/lib/user-session'

export default function TopBar() {
  const { user, signOut } = useAuth()
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
      setShowAdminLinks(isUserAdmin())
      return
    }

    let isActive = true
    userSession.refreshUserData().then(() => {
      if (isActive) {
        setShowAdminLinks(isUserAdmin())
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
    { label: 'Family Profile', href: '/family/profile' },
    { label: 'Teacher Dashboard', href: '/teacher' },
    { label: 'Calendar', href: '/calendar' },
    ...(showAdminLinks ? [{ label: 'Admin Panel', href: '/admin' }] : [])
  ]

  return (
    <nav className="bg-white shadow">
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
            <a href="/dashboard" className="text-lg font-semibold text-gray-900 whitespace-nowrap">
              DVCLC
            </a>
            <div className="hidden sm:flex items-center gap-2">
              {mainNav.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
              className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap"
            >
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Out</span>
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
  )
}
