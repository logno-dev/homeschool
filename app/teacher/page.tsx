'use client'

import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useUserSession } from '@/lib/user-session'
import ClassTeachingRequests from '@/app/components/ClassTeachingRequests'
import TeacherScheduleReview from '@/app/components/TeacherScheduleReview'
import TeacherReimbursementClaims from '@/app/components/TeacherReimbursementClaims'

export default function TeacherDashboard() {
  const { user, loading } = useAuth()
  const { loading: userLoading, isTeacher } = useUserSession()
  const router = useRouter()
  const [requestsVisible, setRequestsVisible] = useState<boolean | null>(null)
  const [teachingVisible, setTeachingVisible] = useState<boolean | null>(null)
  const [reimbursementsVisible, setReimbursementsVisible] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'current' | 'upcoming' | 'reimbursements'>('current')

  useEffect(() => {
    if (loading || userLoading) return

    if (!user) {
      router.push('/signin')
      return
    }
  }, [user, loading, userLoading, router])

  useEffect(() => {
    const currentAvailable = isTeacher && teachingVisible !== false
    const upcomingAvailable = requestsVisible !== false
    const reimbursementsAvailable = reimbursementsVisible !== false
    const activeAvailable = activeTab === 'current' ? currentAvailable : activeTab === 'upcoming' ? upcomingAvailable : reimbursementsAvailable
    if (!activeAvailable) {
      if (currentAvailable) setActiveTab('current')
      else if (upcomingAvailable) setActiveTab('upcoming')
      else if (reimbursementsAvailable) setActiveTab('reimbursements')
    }
  }, [activeTab, isTeacher, requestsVisible, teachingVisible, reimbursementsVisible])

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const dashboardIsEmpty = requestsVisible === false && (!isTeacher || teachingVisible === false) && reimbursementsVisible === false
  const tabs = [
    { id: 'current' as const, label: 'Current Teaching', visible: isTeacher && teachingVisible !== false },
    { id: 'upcoming' as const, label: 'Upcoming Classes', visible: requestsVisible !== false },
    { id: 'reimbursements' as const, label: 'Reimbursements', visible: reimbursementsVisible !== false },
  ].filter((tab) => tab.visible)

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="space-y-12 px-4 py-6 sm:px-0">
          <header>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Teaching</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Teacher Dashboard</h1>
            <p className="mt-2 text-slate-600">Manage the classes you are teaching now, then plan for upcoming sessions.</p>
          </header>

          {!dashboardIsEmpty && <nav role="tablist" aria-label="Teacher dashboard sections" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {tabs.map((tab) => <button key={tab.id} id={`teacher-tab-${tab.id}`} role="tab" type="button" aria-selected={activeTab === tab.id} aria-controls={`teacher-panel-${tab.id}`} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>{tab.label}</button>)}
          </nav>}

          <section id="teacher-panel-current" role="tabpanel" aria-labelledby="teacher-tab-current" className={!dashboardIsEmpty && activeTab === 'current' && isTeacher && teachingVisible !== false ? 'space-y-6' : 'hidden'}>
            <div className="rounded-2xl border border-slate-200 bg-slate-100/60 p-4 sm:p-6">
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current sessions</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">My active teaching</h2>
                <p className="mt-1 text-sm text-slate-600">Access current schedules, class rosters, class hubs, and schedule feedback.</p>
              </div>
              {isTeacher && <TeacherScheduleReview onVisibilityChange={setTeachingVisible} />}
            </div>
          </section>

          <section id="teacher-panel-upcoming" role="tabpanel" aria-labelledby="teacher-tab-upcoming" className={!dashboardIsEmpty && activeTab === 'upcoming' && requestsVisible !== false ? 'space-y-6' : 'hidden'}>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-6">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Upcoming sessions</p>
                <h2 className="mt-1 text-2xl font-bold text-blue-950">Plan future classes</h2>
                <p className="mt-1 text-sm text-blue-800">Review teaching needs and submit or edit proposals for the next session.</p>
              </div>
              <ClassTeachingRequests openOnly onVisibilityChange={setRequestsVisible} />
            </div>
          </section>

          <section id="teacher-panel-reimbursements" role="tabpanel" aria-labelledby="teacher-tab-reimbursements" className={!dashboardIsEmpty && activeTab === 'reimbursements' && reimbursementsVisible !== false ? '' : 'hidden'}>
            <TeacherReimbursementClaims onVisibilityChange={setReimbursementsVisible} />
          </section>
          {dashboardIsEmpty && <section className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-10 text-center shadow-sm"><h1 className="text-xl font-semibold text-blue-950">No teaching actions right now</h1><p className="mx-auto mt-2 max-w-xl text-blue-800">Come back to submit a teaching request for the next session! Once a schedule is ready, your classes and rosters will appear here.</p></section>}
        </div>
      </main>
    </div>
  )
}
