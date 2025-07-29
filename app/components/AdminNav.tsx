'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AdminNavProps {
  userName: string
  activeTab: 'users' | 'sessions' | 'class-requests' | 'classrooms' | 'volunteer-jobs' | 'registration-overrides'
}

export default function AdminNav({ userName, activeTab }: AdminNavProps) {
  const router = useRouter()

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-semibold text-gray-900">
              Admin Panel
            </h1>
            <div className="flex space-x-4">
              <Link
                href="/admin/users"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'users'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                User Management
              </Link>
              <Link
                href="/admin/sessions"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'sessions'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Session Management
              </Link>
              <Link
                href="/admin/class-requests"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'class-requests'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Class Requests
              </Link>
              <Link
                href="/admin/classrooms"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'classrooms'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Classrooms
              </Link>
              <Link
                href="/admin/volunteer-jobs"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'volunteer-jobs'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Volunteer Jobs
              </Link>
              <Link
                href="/admin/registration-overrides"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'registration-overrides'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Registration Overrides
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            >
              Back to Dashboard
            </button>
            <span className="text-gray-700">
              {userName}
            </span>
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