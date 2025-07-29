'use client'

import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface PageNavProps {
  title: string
  showDashboardLink?: boolean
  dashboardLinkText?: string
  showSignOut?: boolean
}

export default function PageNav({ 
  title, 
  showDashboardLink = true, 
  dashboardLinkText = "Back to Dashboard",
  showSignOut = true 
}: PageNavProps) {
  const { data: session } = useSession()
  const router = useRouter()

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              {title}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {showDashboardLink && (
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                {dashboardLinkText}
              </button>
            )}
            {session?.user?.name && (
              <span className="text-gray-700">
                {session.user.name}
              </span>
            )}
            {showSignOut && (
              <button
                onClick={() => signOut({ callbackUrl: '/', redirect: true })}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}