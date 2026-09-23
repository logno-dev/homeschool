import Link from 'next/link'
import { getFamilyRegistrationCart } from '@/lib/registration-cart'
import { getAuthenticatedUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

const PERIOD_NAMES: Record<string, string> = {
  first: 'First Hour',
  second: 'Second Hour',
  lunch: 'Lunch',
  third: 'Third Hour',
  non_period: 'General Volunteer'
}

export default async function CartPage() {
  const auth = await getAuthenticatedUser()
  const cart = await getFamilyRegistrationCart(auth.user.id)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Registration</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Your Cart</h1>
          <p className="mt-2 text-gray-600">Reserved selections stay in your cart for up to 24 hours.</p>
        </div>

        {cart.totalItems === 0 ? (
          <section className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l2 12h10l3-8H6m2 12a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" /></svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Your cart is empty</h2>
            <p className="mt-2 text-sm text-gray-600">Choose a registration session to browse classes and volunteer opportunities.</p>
            <Link href="/registration" className="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Go to registration</Link>
          </section>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {cart.totalItems} reserved item{cart.totalItems === 1 ? '' : 's'} across {cart.sessions.length} session{cart.sessions.length === 1 ? '' : 's'}.
            </div>
            {cart.sessions.map((session) => (
              <section key={session.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{session.name}</h2>
                    <p className="text-sm text-gray-600">{session.classes.length + session.volunteerAssignments.length} item{session.classes.length + session.volunteerAssignments.length === 1 ? '' : 's'}</p>
                  </div>
                  <Link href={`/registration/${session.id}#registration-cart`} className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Review and submit</Link>
                </div>
                <div className="grid gap-6 p-5 md:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Classes ({session.classes.length})</h3>
                    {session.classes.length === 0 ? <p className="mt-3 text-sm text-gray-500">No classes reserved.</p> : (
                      <div className="mt-3 divide-y divide-gray-100">
                        {session.classes.map((item) => (
                          <div key={item.id} className="py-3 first:pt-0">
                            <p className="font-medium text-gray-900">{item.className}</p>
                            <p className="mt-1 text-sm text-gray-600">{item.childName} · {PERIOD_NAMES[item.period] || item.period}</p>
                            <p className="text-sm text-gray-500">{item.classroomName}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Volunteer Assignments ({session.volunteerAssignments.length})</h3>
                    {session.volunteerAssignments.length === 0 ? <p className="mt-3 text-sm text-gray-500">No volunteer assignments reserved.</p> : (
                      <div className="mt-3 divide-y divide-gray-100">
                        {session.volunteerAssignments.map((item) => (
                          <div key={item.id} className="py-3 first:pt-0">
                            <p className="font-medium text-gray-900">{item.title}</p>
                            <p className="mt-1 text-sm text-gray-600">{item.guardianName} · {PERIOD_NAMES[item.period] || item.period}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
