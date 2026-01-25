'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { useRouter } from 'next/navigation'
import AdminLayout from '../../components/AdminLayout'
import { useToast } from '../../components/ToastContainer'
import type { Session, SessionClassroom, Family, Guardian, Child } from '../../../lib/schema'

interface ScheduleRow {
  scheduleId: string
  classroomId: string
  classroomName: string
  period: string
  className: string
  teacherFirstName: string
  teacherLastName: string
}

interface RosterRow {
  scheduleId: string
  status: string
  child: {
    id: string
    firstName: string
    lastName: string
    grade: string
  }
}

interface ReportData {
  session: Session
  classrooms: SessionClassroom[]
  schedules: ScheduleRow[]
  roster: RosterRow[]
  families: Family[]
  guardians: Guardian[]
  children: Child[]
}

const PERIODS = [
  { id: 'first', name: 'First Period' },
  { id: 'second', name: 'Second Period' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Period' }
]

export default function AdminReportsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showError } = useToast()

  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/signin')
      return
    }

    const loadSessions = async () => {
      try {
        const response = await fetch('/api/admin/sessions')
        if (response.ok) {
          const data = await response.json()
          const loadedSessions: Session[] = data.sessions || []
          setSessions(loadedSessions)
          setSelectedSessionId((current) => {
            if (current) return current
            const activeSession = loadedSessions.find((session) => session.isActive)
            return activeSession?.id || loadedSessions[0]?.id || ''
          })
        }
      } catch (error) {
        showError('Error loading sessions', 'Unable to load sessions')
      }
    }

    loadSessions()
  }, [loading, user, router, showError])

  useEffect(() => {
    if (!selectedSessionId) {
      setIsLoading(false)
      return
    }

    const loadReports = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/admin/reports?sessionId=${selectedSessionId}`)
        if (!response.ok) {
          throw new Error('Failed to load reports')
        }
        const data = await response.json()
        setReportData(data)
      } catch (error) {
        showError('Report error', error instanceof Error ? error.message : 'Unable to load reports')
      } finally {
        setIsLoading(false)
      }
    }

    loadReports()
  }, [selectedSessionId, showError])

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Admin'

  const scheduleByClassroom = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>()
    reportData?.classrooms.forEach((classroom) => map.set(classroom.id, []))
    reportData?.schedules.forEach((schedule) => {
      const list = map.get(schedule.classroomId) || []
      list.push(schedule)
      map.set(schedule.classroomId, list)
    })
    return map
  }, [reportData])

  return (
    <AdminLayout userName={userName} activeTab="reports">
      <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Printable Reports</h1>
              <p className="text-sm text-gray-600">Choose a report, preview it, or print immediately.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>{session.name}</option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading report...</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg divide-y">
              {[
                {
                  id: 'classroom-schedule',
                  title: 'Classroom Schedules',
                  description: 'One printable sheet per classroom with class listings by period.',
                  previewPath: `/admin/reports/classrooms/${selectedSessionId}/print`,
                  printPath: `/admin/reports/classrooms/${selectedSessionId}/print?print=1`
                },
                {
                  id: 'class-attendance',
                  title: 'Class Attendance Sheets',
                  description: 'Roster grids per class with weekly attendance columns.',
                  previewPath: `/admin/reports/attendance/class/${selectedSessionId}/print`,
                  printPath: `/admin/reports/attendance/class/${selectedSessionId}/print?print=1`
                },
                {
                  id: 'overall-attendance',
                  title: 'Overall Attendance Sheet',
                  description: 'All students grouped by family with weekly attendance columns.',
                  previewPath: `/admin/reports/attendance/overall/${selectedSessionId}/print`,
                  printPath: `/admin/reports/attendance/overall/${selectedSessionId}/print?print=1`
                }
              ].map((report) => (
                <div key={report.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{report.title}</h2>
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (!selectedSessionId) return
                        window.location.assign(report.previewPath)
                      }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      disabled={!selectedSessionId}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedSessionId) return
                        window.location.assign(report.printPath)
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
                      disabled={!selectedSessionId}
                    >
                      Print
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AdminLayout>
  )
}
