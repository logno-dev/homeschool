import { getAuthenticatedUser, checkAdminRole } from '@/lib/server-auth'
import { redirect } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import EventManagement from '@/app/components/EventManagement'

export default async function EventsAdminPage() {
  const session = await getAuthenticatedUser()
  const isAdmin = await checkAdminRole(session.user.id)
  
  if (!isAdmin) {
    redirect('/dashboard')
  }

  return (
    <AdminLayout userName={session.user.name || 'Admin'} activeTab="events">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage calendar events for the cooperative
          </p>
        </div>
        
        <EventManagement />
      </div>
    </AdminLayout>
  )
}