import { getAuthenticatedUser, fetchFamilyData } from '@/lib/server-auth'
import FamilyActions from '@/app/components/FamilyActions'
import FamilyRegistrationOptions from '@/app/components/FamilyRegistrationOptions'
import FamilyProfileClient from '../../components/FamilyProfileClient'
import GuardianList from '../../components/GuardianList'
import { getGlobalSetting } from '@/lib/database'
import { getAppTimezone } from '@/lib/app-time'

export default async function FamilyProfilePage() {
  // Server-side authentication and data fetching
  const session = await getAuthenticatedUser()
  const familyData = await fetchFamilyData(session.user.id)

  // If user doesn't have a family, show options to register or join
  if (!familyData?.family) {
    return (
      <div className="min-h-screen bg-gray-50">
        <FamilyRegistrationOptions />
      </div>
    )
  }

  const { family, guardians, children } = familyData
  const gradeIncrementDate = await getGlobalSetting('grade_increment_date')
  const appTimezone = await getAppTimezone()

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Family Information with Interactive Elements */}
            <FamilyActions family={family} />

            {/* Guardians */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Guardians</h2>
               <GuardianList guardians={guardians} currentUserId={session.user.id} />
            </div>

            {/* Children - handled by client component */}
            <FamilyProfileClient
              family={family}
              guardians={guardians}
              children={children}
              gradeIncrementDate={gradeIncrementDate}
              appTimezone={appTimezone}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
