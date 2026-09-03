'use client'

import { useMemo, useState } from 'react'
import ReadonlyScheduleView from './ReadonlyScheduleView'

interface ScheduleEntry {
  schedule: {
    id: string
    period: string
  }
  classTeachingRequest: {
    className: string
    gradeRange: string
  }
  classroom: {
    id: string
    name: string
    orderIndex?: number
  }
  teacher: {
    firstName: string
    lastName: string
  }
  roster: Array<{
    id: string
    firstName: string
    lastName: string
    grade: string
    status?: string
  }>
}

type ClassRegistrations = Parameters<typeof ReadonlyScheduleView>[0]['classRegistrations']
type VolunteerAssignments = Parameters<typeof ReadonlyScheduleView>[0]['volunteerAssignments']

interface ScheduleViewerProps {
  sessionName: string
  sessionId: string
  schedules: ScheduleEntry[]
  classRegistrations: ClassRegistrations
  volunteerAssignments: VolunteerAssignments
}

const PERIODS = [
  { id: 'first', name: 'First Hour' },
  { id: 'second', name: 'Second Hour' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Hour' }
]

export default function ScheduleViewer({
  sessionName,
  sessionId,
  schedules,
  classRegistrations,
  volunteerAssignments
}: ScheduleViewerProps) {
  const [activeTab, setActiveTab] = useState<'full' | 'family'>('full')

  const schedulesByPeriod = useMemo(() => {
    return PERIODS.reduce((acc, period) => {
      const entries = schedules
        .filter((entry) => entry.schedule.period === period.id)
        .sort((a, b) => {
          const orderA = typeof a.classroom.orderIndex === 'number' ? a.classroom.orderIndex : 0
          const orderB = typeof b.classroom.orderIndex === 'number' ? b.classroom.orderIndex : 0
          if (orderA !== orderB) return orderA - orderB
          return a.classroom.name.localeCompare(b.classroom.name)
        })
      acc[period.id] = entries
      return acc
    }, {} as Record<string, ScheduleEntry[]>)
  }, [schedules])

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Schedule Viewer</p>
            <h1 className="text-2xl font-semibold text-slate-900 mt-2">{sessionName}</h1>
            <p className="text-sm text-slate-600 mt-1">
              Browse the full roster or review your family’s schedule.
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setActiveTab('full')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                activeTab === 'full'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Full Schedule
            </button>
            <button
              onClick={() => setActiveTab('family')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                activeTab === 'family'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              My Family
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'full' ? (
        <div className="space-y-8">
          {PERIODS.map((period) => (
            <section key={period.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">{period.name}</h2>
                <span className="text-sm text-slate-500">
                  {schedulesByPeriod[period.id]?.length || 0} classes
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(schedulesByPeriod[period.id] || []).map((entry) => {
                  const roster = [...entry.roster].sort((a, b) => a.lastName.localeCompare(b.lastName))
                  return (
                    <div key={entry.schedule.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{entry.classTeachingRequest.className}</h3>
                          <p className="text-sm text-slate-500">{entry.classroom.name}</p>
                        </div>
                        <div className="text-xs text-slate-500 text-right">
                          <div>{entry.teacher.firstName} {entry.teacher.lastName}</div>
                          <div className="mt-1">Grade {entry.classTeachingRequest.gradeRange}</div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Roster</p>
                        {roster.length === 0 ? (
                          <p className="text-sm text-slate-400 mt-2">No students registered yet.</p>
                        ) : (
                          <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                            {roster.map((student) => {
                              const status = student.status || 'registered'
                              const isReserved = status === 'hold' || status === 'pending'
                              return (
                                <div key={student.id} className="flex items-center justify-between text-sm text-slate-700">
                                  <span>{student.lastName}, {student.firstName} (Grade {student.grade})</span>
                                  {isReserved && (
                                    <span className="text-xs text-amber-600">Reserved</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {(schedulesByPeriod[period.id] || []).length === 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                    No classes scheduled for this period.
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <ReadonlyScheduleView
          sessionId={sessionId}
          classRegistrations={classRegistrations}
          volunteerAssignments={volunteerAssignments}
        />
      )}
    </div>
  )
}
