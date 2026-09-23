'use client'

import { useAuth } from '@/lib/auth-client'
import { getReturnToUrl } from '@/lib/client-env'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { isUserAdmin, userSession } from '@/lib/user-session'
import BrandLogo from './BrandLogo'
import Link from 'next/link'

export default function TopBar() {
  const { user, signOut, isEmulating, exitEmulation } = useAuth()
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showAdminLinks, setShowAdminLinks] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLElement>(null)

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

  useEffect(() => {
    if (!user) {
      setCartCount(0)
      return
    }

    let isActive = true
    const refreshCart = () => {
      fetch('/api/registration/cart', { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : { totalItems: 0 })
        .then((cart) => {
          if (isActive) setCartCount(Number(cart.totalItems) || 0)
        })
        .catch(() => {
          if (isActive) setCartCount(0)
        })
    }

    refreshCart()
    window.addEventListener('registration-cart-updated', refreshCart)
    window.addEventListener('focus', refreshCart)
    return () => {
      isActive = false
      window.removeEventListener('registration-cart-updated', refreshCart)
      window.removeEventListener('focus', refreshCart)
    }
  }, [pathname, user])

  useEffect(() => {
    if (!showMore) return
    const handleOutsideClick = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) setShowMore(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showMore])

  useEffect(() => {
    if (!showMenu) return
    const handleOutsidePress = (event: PointerEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) setShowMenu(false)
    }
    document.addEventListener('pointerdown', handleOutsidePress)
    return () => document.removeEventListener('pointerdown', handleOutsidePress)
  }, [showMenu])

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
      <div className="print:hidden bg-amber-100 border-b border-amber-200 px-4 py-2 text-sm text-amber-900 flex items-center justify-between gap-3">
        <span>Emulating this user. Your admin session is preserved in its original tab.</span>
        <button onClick={exitEmulation} className="font-semibold underline whitespace-nowrap">Exit emulation</button>
      </div>
    )}
    <nav ref={mobileMenuRef} className="print:hidden sticky top-0 z-50 bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 min-w-0 sm:gap-4">
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              className="lg:hidden p-2 rounded-md border border-gray-200 text-gray-600"
              aria-label="Toggle navigation"
              aria-expanded={showMenu}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" onClick={() => setShowMenu(false)} className="shrink-0">
              <BrandLogo variant="horizontal" width={150} className="h-auto w-[120px] sm:w-[150px]" alt="DVCLC home" />
            </Link>
            <div className="hidden lg:flex items-center gap-2">
              {mainNav.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <div ref={moreMenuRef} className="relative">
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
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setShowMore(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/cart" aria-label={`Registration cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`} title="Registration cart" className={`relative rounded-md p-2 ${pathname === '/cart' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l2 12h10l3-8H6m2 12a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" /></svg>
              {cartCount > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1 text-[11px] font-bold leading-none text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
            </Link>
            {userName && (
              <span className="hidden max-w-40 truncate text-sm text-gray-600 xl:inline">
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
        <div className="lg:hidden border-t border-gray-200 px-4 pb-4">
          <div className="grid gap-2 pt-3">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMenu(false)}
                className="px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100"
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-gray-200 pt-2 mt-2">
              {moreNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMenu(false)}
                  className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
    </>
  )
}
