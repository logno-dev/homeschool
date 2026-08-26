'use client'

import { useAuth } from '@/lib/auth-client'
import { getReturnToUrl } from '@/lib/client-env'
import { useRouter } from 'next/navigation'

interface FamilyNavProps {
  familyName?: string
}

export default function FamilyNav({ familyName }: FamilyNavProps) {
  const router = useRouter()
  const { signOut } = useAuth()

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              {familyName || 'Family Profile'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                void signOut({ returnTo: getReturnToUrl() })
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
