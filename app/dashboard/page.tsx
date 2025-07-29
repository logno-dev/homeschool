import { getAuthenticatedUser, checkAdminRole } from '@/lib/server-auth'
import DashboardButtons from '@/app/components/DashboardButtons'

export default async function Dashboard() {
  // Server-side authentication and role checking
  const session = await getAuthenticatedUser()
  const isAdmin = await checkAdminRole(session.user.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg min-h-96 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Homeschool Cooperative Management
            </h2>
            <p className="text-gray-600 mb-6">
              Welcome to your dashboard! Here you can manage students, teachers, classes, and activities.
            </p>
            
            <DashboardButtons isAdmin={isAdmin} />
          </div>
        </div>
      </main>
    </div>
  )
}