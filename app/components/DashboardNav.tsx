'use client'

import { signOut } from 'next-auth/react'

interface DashboardNavProps {
  userName: string
}

export default function DashboardNav({ userName }: DashboardNavProps) {
  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              DVCLC Dashboard
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">
              Welcome, {userName}
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