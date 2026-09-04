'use client'

import { useEffect, useMemo, useState } from 'react'
import ReadonlyScheduleView from './ReadonlyScheduleView'
import Modal from './Modal'
import { Grid2X2, List } from 'lucide-react'

interface ScheduleEntry {
  schedule: {
    id: string
    period: string
  }
  classTeachingRequest: {
    className: string
    description: string
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
  const [viewMode, setViewMode] = useState<'cards' | 'grid'>('cards')
  const [isWideScreen, setIsWideScreen] = useState(false)
  const [selectedGridEntry, setSelectedGridEntry] = useState<ScheduleEntry | null>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    setIsWideScreen(mediaQuery.matches)
    setViewMode(mediaQuery.matches ? 'grid' : 'cards')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsWideScreen(event.matches)
      if (!event.matches) setViewMode('cards')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const showingGrid = isWideScreen && viewMode === 'grid'

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

  const classrooms = useMemo(() => Array.from(new Map(schedules.map((entry) => [entry.classroom.id, entry.classroom])).values()).sort((a, b) => {
    const orderA = typeof a.orderIndex === 'number' ? a.orderIndex : 0
    const orderB = typeof b.orderIndex === 'number' ? b.orderIndex : 0
    return orderA !== orderB ? orderA - orderB : a.name.localeCompare(b.name)
  }), [schedules])

  const schedulesByCell = useMemo(() => new Map(schedules.map((entry) => [`${entry.classroom.id}-${entry.schedule.period}`, entry])), [schedules])

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
        <>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Full Schedule</h2>
          <div className="hidden rounded-lg border border-slate-200 bg-slate-50 p-1 md:flex" aria-label="Schedule view">
            <button type="button" onClick={() => setViewMode('cards')} aria-label="Show schedule as cards" title="Cards" className={`rounded-md p-2 ${viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" onClick={() => setViewMode('grid')} aria-label="Show schedule as a grid" title="Grid" className={`rounded-md p-2 ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Grid2X2 className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </div>
        <div className={showingGrid ? 'hidden' : 'space-y-8'}>
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
      {showingGrid && (
         <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
          <table className="min-w-[58rem] w-full table-fixed">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-36 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Classroom</th>
                {PERIODS.map((period) => <th key={period.id} className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${period.id === 'lunch' ? 'w-20' : 'w-40'}`}>{period.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {classrooms.map((classroom) => (
                <tr key={classroom.id}>
                  <td className="px-4 py-3 align-top text-sm font-semibold text-slate-900">{classroom.name}</td>
                  {PERIODS.map((period) => {
                    const entry = schedulesByCell.get(`${classroom.id}-${period.id}`)
                    return <td key={period.id} className="px-2 py-2 align-top">{entry ? <button type="button" onClick={() => setSelectedGridEntry(entry)} className="min-h-20 w-full rounded-lg border border-blue-100 bg-blue-50 p-3 text-left hover:border-blue-300 hover:bg-blue-100"><p className="truncate text-sm font-semibold text-slate-900">{entry.classTeachingRequest.className}</p><p className="truncate text-xs text-slate-600">{`${entry.teacher.firstName} ${entry.teacher.lastName}`.trim()}</p><p className="mt-2 text-xs text-slate-500">Grade {entry.classTeachingRequest.gradeRange} • {entry.roster.length} registered</p></button> : <div className="min-h-20 rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-300">Open</div>}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      ) : (
        <ReadonlyScheduleView
          sessionId={sessionId}
          classRegistrations={classRegistrations}
          volunteerAssignments={volunteerAssignments}
        />
      )}
      <Modal isOpen={Boolean(selectedGridEntry)} onClose={() => setSelectedGridEntry(null)} title={selectedGridEntry?.classTeachingRequest.className || 'Class details'} size="lg">
        {selectedGridEntry && (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-slate-500">{selectedGridEntry.classroom.name} • {PERIODS.find((period) => period.id === selectedGridEntry.schedule.period)?.name}</p>
              <p className="mt-1 text-sm text-slate-700"><strong>Teacher:</strong> {`${selectedGridEntry.teacher.firstName} ${selectedGridEntry.teacher.lastName}`.trim()}</p>
              <p className="mt-1 text-sm text-slate-700"><strong>Grade range:</strong> {selectedGridEntry.classTeachingRequest.gradeRange}</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Class Description</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedGridEntry.classTeachingRequest.description}</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Roster ({selectedGridEntry.roster.length})</h4>
              {selectedGridEntry.roster.length === 0 ? <p className="mt-2 text-sm text-slate-500">No students registered yet.</p> : <div className="mt-2 space-y-2">{[...selectedGridEntry.roster].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((student) => <div key={student.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"><span>{student.lastName}, {student.firstName} (Grade {student.grade})</span>{(student.status === 'hold' || student.status === 'pending') && <span className="text-xs text-amber-600">Reserved</span>}</div>)}</div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
