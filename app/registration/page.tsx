import Link from 'next/link'
import { getActiveSessions } from '@/lib/database'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getRegistrationAccess } from '@/lib/user-groups'
import { getRegistrationStatus } from '@/lib/registration-status'
import { db } from '@/lib/db'
import { sessionFeeConfigs } from '@/lib/schema'
import { inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function RegistrationPage() {
  const auth = await getAuthenticatedUser()
  const activeSessions = await getActiveSessions()
  const feeConfigs = await db.select({ sessionId: sessionFeeConfigs.sessionId, costBreakdown: sessionFeeConfigs.costBreakdown })
    .from(sessionFeeConfigs)
    .where(inArray(sessionFeeConfigs.sessionId, activeSessions.map((session) => session.id)))
  const feeConfigBySession = new Map(feeConfigs.map((config) => [config.sessionId, config]))
  const sessions = await Promise.all(activeSessions.map(async (session) => ({
    session,
    access: await getRegistrationAccess(session.id, auth.user.id),
    registrationStatus: await getRegistrationStatus(session.id, auth.user.id),
    feeConfig: feeConfigBySession.get(session.id) || null
  })))

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Class Registration</h1>
            <p className="text-gray-600 mb-8">
              Select a session below to register your children for classes.
            </p>

            {sessions.length > 0 ? (
              <div className="space-y-4">
                 {sessions.map(({ session, access, registrationStatus, feeConfig }) => {
                   const hasRegistration = Boolean(registrationStatus?.hasRegistrations)
                   return (
                   <div
                    key={session.id}
                    className="border border-gray-200 rounded-lg p-6 hover:border-orange-300 transition-colors"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {session.name}
                        </h3>
                        {feeConfig?.costBreakdown && (
                          <details className="mb-2 text-sm text-gray-600">
                            <summary className="cursor-pointer font-medium text-gray-700">View cost breakdown</summary>
                            <p className="mt-2 whitespace-pre-wrap">{feeConfig.costBreakdown}</p>
                          </details>
                        )}
                          <p className="text-gray-600">{access.isOpen ? 'Registration is currently open for this session.' : access.reason || 'Registration is not currently available for your user groups.'}</p>
                      </div>
                       <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                         <Link
                           href={`/schedule?sessionId=${session.id}`}
                           className="inline-flex w-full sm:w-auto items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-orange-500 px-4 py-2 text-sm min-h-[36px]"
                         >
                           View Schedule
                         </Link>
                         {hasRegistration ? (
                           <Link
                             href={`/registration/${session.id}?modify=1`}
                             className="inline-flex w-full sm:w-auto items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800 focus:ring-orange-500 px-4 py-2 text-sm min-h-[36px]"
                           >
                             Modify Registration
                           </Link>
                         ) : access.isOpen ? (
                           <Link
                             href={`/registration/${session.id}`}
                             className="inline-flex w-full sm:w-auto items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800 focus:ring-orange-500 px-4 py-2 text-sm min-h-[36px]"
                           >
                             Register Now
                           </Link>
                         ) : null}
                       </div>
                     </div>
                   </div>
                   )
                 })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Active Sessions
                </h3>
                <p className="text-gray-600 mb-6">
                  There are currently no active sessions available for registration.
                  Please check back later or contact the administrator.
                </p>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 focus:ring-blue-500 px-4 py-2 text-sm min-h-[36px]"
                >
                  Back to Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
