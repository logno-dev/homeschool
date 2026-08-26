'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { ADMIN_MODULES } from '@/lib/admin-access'
import { isUserAdmin, userSession } from '@/lib/user-session'

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/signin')
      return
    }

    const redirectToModule = async () => {
      if (isUserAdmin()) { router.push('/admin/users'); return }
      const data = userSession.getUserData() || await userSession.refreshUserData()
      const module = ADMIN_MODULES.find((item) => data?.adminModules?.includes(item.key))
      router.push(module ? `/admin/${module.key === 'class-requests' ? 'classes' : module.key}` : '/dashboard')
    }
    redirectToModule()
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return null
}
