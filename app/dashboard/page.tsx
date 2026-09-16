import { getAuthenticatedUser, checkAdminRole } from '@/lib/server-auth'
import { fetchCalendarEvents, getNextUpcomingEvent } from '@/lib/events'
import FeesSummary from '@/app/components/FeesSummary'
import NextEvent from '@/app/components/NextEvent'
import Link from 'next/link'
import { getActiveSession } from '@/lib/database'
import { getRegistrationStatus } from '@/lib/registration-status'
import { db } from '@/lib/db'
import { classTeachingRequests, schedules } from '@/lib/schema'
import { and, eq, inArray, or } from 'drizzle-orm'

export default async function Dashboard() {
  // Server-side authentication and role checking
  const session = await getAuthenticatedUser()
  const [isAdmin, events, activeSession] = await Promise.all([
    checkAdminRole(session),
    fetchCalendarEvents(session.user.id),
    getActiveSession()
  ])
  const nextEvent = await getNextUpcomingEvent(events)
  const userName = [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || session.user.email
  const [registrationStatus, teachingClasses] = activeSession
    ? await Promise.all([
        getRegistrationStatus(activeSession.id, session.user.id),
        db
          .select({ id: schedules.id })
          .from(schedules)
          .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
          .where(and(
            eq(schedules.sessionId, activeSession.id),
            inArray(schedules.status, ['submitted', 'published']),
            or(eq(classTeachingRequests.guardianId, session.user.id), eq(classTeachingRequests.coTeacherId, session.user.id))
          ))
          .limit(1)
      ])
    : [null, []]
  const registrationComplete = registrationStatus?.registrationState === 'completed'
  const isTeachingCurrentSession = teachingClasses.length > 0
  const registrationHref = registrationComplete && activeSession ? `/schedule?sessionId=${activeSession.id}` : '/registration'

  const primaryActions = [
    {
      title: registrationComplete ? 'Class Schedule' : 'Class Registration',
      description: registrationComplete
        ? `Your registration for ${activeSession?.name || 'the active session'} is complete. Review your family schedule.`
        : 'Claim class spots and manage waitlists for this session.',
      href: registrationHref,
      cta: registrationComplete ? 'View Schedule' : 'Go to Registration',
      tone: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      title: 'Fees & Payments',
      description: 'Review balances, donate, or record deferred payments.',
      href: '/family/payments',
      cta: 'Go to Fees & Payments',
      tone: 'bg-amber-600 hover:bg-amber-700'
    },
    {
      title: 'Family Profile',
      description: 'Update guardians, students, and emergency contacts.',
      href: '/family/profile',
      cta: 'Go to Family Profile',
      tone: 'bg-emerald-600 hover:bg-emerald-700'
    },
    {
      title: 'Resources',
      description: 'Scholarships, learning tools, and helpful links.',
      href: '/resources',
      cta: 'Go to Resources',
      tone: 'bg-slate-800 hover:bg-slate-900'
    }
  ]

  const supportActions = [
    ...(!isTeachingCurrentSession ? [{
      title: 'Teacher Dashboard',
      description: 'Submit teaching requests and review schedules.',
      href: '/teacher'
    }] : []),
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
              <Link
                href={registrationHref}
                className="bg-white/90 !text-slate-900 px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-white border border-white/60 shadow-sm"
              >
                {registrationComplete ? 'View Schedule' : 'Open Registration'}
              </Link>
              <Link
                href="/family/payments"
                className="border border-slate-400 text-slate-100 px-5 py-2.5 rounded-md text-sm font-semibold hover:border-white"
              >
                View Payments
              </Link>
            </div>
          </div>
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-slate-600/30 blur-2xl" />
          <div className="absolute -bottom-20 right-16 h-56 w-56 rounded-full bg-slate-500/20 blur-2xl" />
        </section>

        {isTeachingCurrentSession && (
          <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-700 to-violet-700 p-6 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Teaching {activeSession?.name}</p>
              <h2 className="mt-2 text-2xl font-semibold">Your class dashboard is ready</h2>
              <p className="mt-2 max-w-2xl text-sm text-indigo-100">
                Review your class schedule, roster, student needs, and teaching details for the current session.
              </p>
            </div>
            <Link
              href="/teacher"
              className="mt-5 inline-flex w-full shrink-0 items-center justify-center rounded-md bg-white px-6 py-3 text-base font-bold !text-indigo-700 shadow-md hover:bg-indigo-50 sm:mt-0 sm:w-auto"
            >
              Open Teacher Dashboard
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-6 sm:grid-cols-2">
            {primaryActions.map((action) => (
              <div key={action.title} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">{action.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{action.description}</p>
                <Link
                  href={action.href}
                  className={`mt-4 inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white rounded-md ${action.tone}`}
                >
                  {action.cta}
                </Link>
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
              <Link
                href={action.href}
                className="mt-4 inline-flex items-center text-sm font-semibold text-slate-900 hover:text-slate-700"
              >
                Visit {action.title}
                <span className="ml-2">→</span>
              </Link>
            </div>
          ))}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-purple-200 p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-purple-500">Admin</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">Administration Console</h3>
              <p className="mt-2 text-sm text-slate-600">
                Review registrations, manage volunteers, and oversee reporting.
              </p>
              <Link
                href="/admin"
                className="mt-4 inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700"
              >
                Open Admin Panel
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
