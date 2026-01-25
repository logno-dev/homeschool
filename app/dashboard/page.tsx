import { getAuthenticatedUser, checkAdminRole } from '@/lib/server-auth'
import { fetchCalendarEvents, getNextUpcomingEvent } from '@/lib/events'
import FeesSummary from '@/app/components/FeesSummary'
import NextEvent from '@/app/components/NextEvent'

export default async function Dashboard() {
  // Server-side authentication and role checking
  const session = await getAuthenticatedUser()
  const isAdmin = await checkAdminRole(session)
  const events = await fetchCalendarEvents()
  const nextEvent = getNextUpcomingEvent(events)
  const userName = [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || session.user.email

  const primaryActions = [
    {
      title: 'Class Registration',
      description: 'Claim class spots and manage waitlists for this session.',
      href: '/registration',
      tone: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      title: 'Fees & Payments',
      description: 'Review balances, donate, or record deferred payments.',
      href: '/family/payments',
      tone: 'bg-amber-600 hover:bg-amber-700'
    },
    {
      title: 'Family Profile',
      description: 'Update guardians, students, and emergency contacts.',
      href: '/family/profile',
      tone: 'bg-emerald-600 hover:bg-emerald-700'
    },
    {
      title: 'Resources',
      description: 'Scholarships, learning tools, and helpful links.',
      href: '/resources',
      tone: 'bg-slate-800 hover:bg-slate-900'
    }
  ]

  const supportActions = [
    {
      title: 'Teacher Dashboard',
      description: 'Submit teaching requests and review schedules.',
      href: '/teacher'
    },
    {
      title: 'Calendar',
      description: 'See upcoming co-op events and milestones.',
      href: '/calendar'
    }
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-8 text-white">
          <div className="relative z-10">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">DVCLC Dashboard</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-semibold">Welcome back, {userName}</h1>
            <p className="mt-3 text-slate-200 max-w-2xl">
              Stay on top of registration windows, volunteer commitments, and payments. Use the shortcuts below to jump into today’s most common tasks.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/registration"
                className="bg-white/90 !text-slate-900 px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-white border border-white/60 shadow-sm"
              >
                Open Registration
              </a>
              <a
                href="/family/payments"
                className="border border-slate-400 text-slate-100 px-5 py-2.5 rounded-md text-sm font-semibold hover:border-white"
              >
                View Payments
              </a>
            </div>
          </div>
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-slate-600/30 blur-2xl" />
          <div className="absolute -bottom-20 right-16 h-56 w-56 rounded-full bg-slate-500/20 blur-2xl" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-6 sm:grid-cols-2">
            {primaryActions.map((action) => (
              <div key={action.title} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">{action.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{action.description}</p>
                <a
                  href={action.href}
                  className={`mt-4 inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white rounded-md ${action.tone}`}
                >
                  Go to {action.title}
                </a>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Fees Snapshot</h3>
              <FeesSummary />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Event</h3>
              <NextEvent nextEvent={nextEvent} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {supportActions.map((action) => (
            <div key={action.title} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{action.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{action.description}</p>
              <a
                href={action.href}
                className="mt-4 inline-flex items-center text-sm font-semibold text-slate-900 hover:text-slate-700"
              >
                Visit {action.title}
                <span className="ml-2">→</span>
              </a>
            </div>
          ))}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-purple-200 p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-purple-500">Admin</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">Administration Console</h3>
              <p className="mt-2 text-sm text-slate-600">
                Review registrations, manage volunteers, and oversee reporting.
              </p>
              <a
                href="/admin"
                className="mt-4 inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700"
              >
                Open Admin Panel
              </a>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
