'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AdminNavProps {
  userName: string
  activeTab: 'users' | 'sessions' | 'class-requests' | 'classrooms' | 'volunteer-jobs' | 'registration-overrides'
}

export default function AdminNav({ userName, activeTab }: AdminNavProps) {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: '/admin/users', label: 'User Management', key: 'users' },
    { href: '/admin/sessions', label: 'Session Management', key: 'sessions' },
    { href: '/admin/class-requests', label: 'Class Requests', key: 'class-requests' },
    { href: '/admin/classrooms', label: 'Classrooms', key: 'classrooms' },
    { href: '/admin/volunteer-jobs', label: 'Volunteer Jobs', key: 'volunteer-jobs' },
    { href: '/admin/registration-overrides', label: 'Registration Overrides', key: 'registration-overrides' }
  ]

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Title and Desktop Navigation */}
          <div className="flex items-center">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mr-4 lg:mr-8">
              Admin Panel
            </h1>
            
            {/* Desktop Navigation - Hidden on mobile */}
            <div className="hidden lg:flex space-x-1 xl:space-x-4">
              {navLinks.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className={`px-2 xl:px-3 py-2 rounded-md text-xs xl:text-sm font-medium whitespace-nowrap ${
                    activeTab === link.key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right side - User info and actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Desktop user info and buttons */}
            <div className="hidden sm:flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </button>
              <span className="text-gray-700 text-sm">
                {userName}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/', redirect: true })}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>

            {/* Mobile hamburger button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              <svg
                className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {/* Close icon */}
              <svg
                className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu - Hidden by default */}
        <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} lg:hidden border-t border-gray-200`}>
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  activeTab === link.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          
          {/* Mobile user actions */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-2 space-y-1">
              <div className="px-3 py-2 text-base font-medium text-gray-700">
                {userName}
              </div>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  router.push('/dashboard')
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/', redirect: true })}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}