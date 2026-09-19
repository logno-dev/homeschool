'use client'

import { useState, useEffect } from 'react'
import type { Session, ScheduleComment } from '@/lib/schema'
import SessionOptions from './SessionOptions'

interface ScheduleEntry {
  id: string
  classroomId: string
  period: string
  className: string
  teacherName: string
  coTeacherName?: string | null
  isStudentCoTeacher?: boolean
  gradeRange: string
}

interface ScheduleData {
  [classroomId: string]: {
    [period: string]: ScheduleEntry
  }
}

interface CommentWithGuardian extends ScheduleComment {
  guardian: {
    firstName: string
    lastName: string
  }
}

interface TeachingClass {
  scheduleId: string
  className: string
  classroomName: string
  period: string
  roster: Array<{ id: string; firstName: string; lastName: string; grade: string; allergies: string | null; parentEmails: string[]; role: 'student' | 'student_teacher' | 'student_co_teacher' }>
  waitlist: Array<{ id: string; firstName: string; lastName: string; grade: string; parentEmails: string[] }>
}

export default function TeacherScheduleReview({ onVisibilityChange }: { onVisibilityChange?: (visible: boolean) => void }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [scheduleData, setScheduleData] = useState<ScheduleData>({})
  const [comments, setComments] = useState<CommentWithGuardian[]>([])
  const [newComment, setNewComment] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [teachingClasses, setTeachingClasses] = useState<TeachingClass[]>([])
  const [teachingClassesStatus, setTeachingClassesStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [scheduleAvailable, setScheduleAvailable] = useState(false)
  const [registrationStarted, setRegistrationStarted] = useState(false)
  const [copyStatus, setCopyStatus] = useState<{ scheduleId: string; status: 'copied' | 'error' } | null>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      fetchScheduleData()
      fetchComments()
    }
  }, [selectedSession])

  useEffect(() => {
    if (isLoading) return
    if (sessions.length === 0) {
      onVisibilityChange?.(false)
      return
    }
    if (teachingClassesStatus === 'loaded') onVisibilityChange?.(scheduleAvailable || registrationStarted)
    if (teachingClassesStatus === 'error') onVisibilityChange?.(true)
  }, [isLoading, onVisibilityChange, registrationStarted, scheduleAvailable, sessions.length, teachingClassesStatus])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions/active')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
        if (data.sessions?.length > 0) {
          setSelectedSession(data.sessions[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchScheduleData = async () => {
    if (!selectedSession) return

    setTeachingClassesStatus('loading')
    try {
      const teachingResponse = await fetch(`/api/teacher/schedule/${selectedSession}`)
      if (teachingResponse.ok) {
        const teachingData = await teachingResponse.json()
        setTeachingClasses(teachingData.classes || [])
        setClassrooms(teachingData.classrooms || [])
        setRegistrationStarted(Boolean(teachingData.registrationStarted))

        const scheduleMap: ScheduleData = {}
        for (const entry of teachingData.reviewSchedule || []) {
          if (!scheduleMap[entry.classroomId]) scheduleMap[entry.classroomId] = {}
          scheduleMap[entry.classroomId][entry.period] = entry
        }
        setScheduleData(scheduleMap)
        setScheduleAvailable((teachingData.reviewSchedule || []).length > 0)
        setTeachingClassesStatus('loaded')
      } else {
        setTeachingClasses([])
        setScheduleAvailable(false)
        setRegistrationStarted(false)
        setTeachingClassesStatus('error')
      }
    } catch (error) {
      console.error('Error fetching teacher classes:', error)
      setTeachingClasses([])
      setScheduleAvailable(false)
      setRegistrationStarted(false)
      setTeachingClassesStatus('error')
    }
  }

  const fetchComments = async () => {
    if (!selectedSession) return

    try {
      const response = await fetch(`/api/teacher/schedule/${selectedSession}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const submitComment = async () => {
    if (!newComment.trim() || !selectedSession) return

    setIsSubmittingComment(true)
    try {
      const response = await fetch(`/api/teacher/schedule/${selectedSession}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: newComment.trim(),
          isPublic
        }),
      })

      if (response.ok) {
        setNewComment('')
        setIsPublic(false)
        fetchComments() // Refresh comments
      } else {
        console.error('Failed to submit comment')
      }
    } catch (error) {
      console.error('Error submitting comment:', error)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRosterParentEmails = (teachingClass: TeachingClass) => Array.from(new Map(
    teachingClass.roster
      .flatMap((student) => student.parentEmails)
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => [email.toLowerCase(), email])
  ).values())

  const copyRosterParentEmails = async (teachingClass: TeachingClass) => {
    const emails = getRosterParentEmails(teachingClass)
    if (!emails.length) return
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      setCopyStatus({ scheduleId: teachingClass.scheduleId, status: 'copied' })
    } catch (error) {
      console.error('Unable to copy parent emails:', error)
      setCopyStatus({ scheduleId: teachingClass.scheduleId, status: 'error' })
    }
  }

  const periods = ['first', 'second', 'lunch', 'third']
  const periodNames: Record<string, string> = { first: 'First Hour', second: 'Second Hour', lunch: 'Lunch', third: 'Third Hour' }

  if (isLoading) {
    return null
  }

  if (sessions.length === 0) {
    return null
  }

  if (teachingClassesStatus === 'error') return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">Unable to load your teaching schedule right now. Please refresh and try again.</div>

  if (teachingClassesStatus === 'loaded' && !scheduleAvailable && !registrationStarted) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Teaching Schedule</h2>
        <select
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
          className="w-full sm:w-auto border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <SessionOptions sessions={sessions} />
        </select>
      </div>

      {registrationStarted && <section className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">My Classes & Rosters</h3>
          <p className="mt-1 text-sm text-gray-500">Confirmed students for classes you teach or co-teach.</p>
        </div>
        {teachingClassesStatus === 'loading' && <p className="px-6 py-5 text-sm text-gray-500">Loading your classes...</p>}
        {teachingClassesStatus === 'loaded' && teachingClasses.length === 0 && <p className="px-6 py-5 text-sm text-gray-500">You do not have a published or submitted class in this session.</p>}
        {teachingClassesStatus === 'loaded' && teachingClasses.length > 0 && (
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            {teachingClasses.map((teachingClass) => (
              <article key={teachingClass.scheduleId} className="overflow-hidden rounded-lg border border-gray-200">
                <div className="bg-blue-50 px-4 py-3">
                  <h4 className="font-semibold text-blue-950">{teachingClass.className}</h4>
                  <p className="mt-1 text-sm text-blue-800">{periodNames[teachingClass.period] || teachingClass.period} · {teachingClass.classroomName}</p>
                </div>
                <div className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Roster ({teachingClass.roster.length})</h5>
                    <button
                      type="button"
                      onClick={() => void copyRosterParentEmails(teachingClass)}
                      disabled={getRosterParentEmails(teachingClass).length === 0}
                      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {copyStatus?.scheduleId === teachingClass.scheduleId && copyStatus.status === 'copied'
                        ? 'Emails copied'
                        : copyStatus?.scheduleId === teachingClass.scheduleId && copyStatus.status === 'error'
                          ? 'Unable to copy'
                          : 'Copy roster parent emails'}
                    </button>
                  </div>
                  {teachingClass.roster.length === 0 ? <p className="mt-3 text-sm text-gray-500">No confirmed students yet.</p> : (
                    <div className="mt-3 divide-y divide-gray-100">
                      {teachingClass.roster.map((student) => (
                        <div key={student.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{student.lastName}, {student.firstName}</span>
                            <span className="text-xs text-gray-500">Grade {student.grade}</span>
                            {(student.role === 'student_teacher' || student.role === 'student_co_teacher') && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">{student.role === 'student_co_teacher' ? 'Student co-teacher' : 'Student teacher'}</span>}
                          </div>
                          <p className={`mt-1 text-sm ${student.allergies?.trim() ? 'font-medium text-red-700' : 'text-gray-500'}`}>Allergies: {student.allergies?.trim() || 'None reported'}</p>
                          <p className="mt-1 text-sm text-gray-600">
                            Parent emails: {student.parentEmails.length > 0
                              ? student.parentEmails.map((email, index) => <span key={email}>{index > 0 ? ', ' : ''}<a href={`mailto:${email}`} className="text-blue-700 hover:underline">{email}</a></span>)
                              : 'None available'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-5 border-t border-amber-200 pt-4">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-amber-700">Waitlist ({teachingClass.waitlist.length})</h5>
                    {teachingClass.waitlist.length === 0 ? <p className="mt-2 text-sm text-gray-500">No students are waitlisted.</p> : (
                      <div className="mt-2 divide-y divide-amber-100 rounded-md bg-amber-50 px-3">
                        {teachingClass.waitlist.map((student) => (
                          <div key={student.id} className="py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-gray-900">{student.lastName}, {student.firstName}</span>
                              <span className="text-xs text-gray-500">Grade {student.grade}</span>
                            </div>
                            <p className="mt-1 text-sm text-gray-600">
                              Parent emails: {student.parentEmails.length > 0
                                ? student.parentEmails.map((email, index) => <span key={email}>{index > 0 ? ', ' : ''}<a href={`mailto:${email}`} className="text-blue-700 hover:underline">{email}</a></span>)
                                : 'None available'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>}

      {/* Schedule Grid */}
      {scheduleAvailable && <><div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Current Schedule</h3>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classroom
                </th>
                {periods.map((period) => (
                  <th key={period} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {classrooms.map((classroom) => (
                <tr key={classroom.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {classroom.name}
                  </td>
                  {periods.map((period) => {
                    const entry = scheduleData[classroom.id]?.[period]
                    return (
                      <td key={period} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry ? (
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900">{entry.className}</div>
                             <div className="text-xs text-gray-500">{entry.teacherName}</div>
                             {entry.coTeacherName && <div className="text-xs text-gray-500">{entry.isStudentCoTeacher ? 'Student co-teacher' : 'Co-teacher'}: {entry.coTeacherName}</div>}
                            <div className="text-xs text-gray-500">{entry.gradeRange}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden divide-y divide-gray-200">
          {classrooms.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No classroom schedule data available for this session.
            </div>
          ) : (
            classrooms.map((classroom) => (
              <div key={classroom.id} className="p-4">
                <div className="mb-3">
                  <h4 className="text-base font-semibold text-gray-900">{classroom.name}</h4>
                  {classroom.description && (
                    <p className="text-sm text-gray-500">{classroom.description}</p>
                  )}
                </div>
                <div className="space-y-3">
                  {periods.map((period) => {
                    const entry = scheduleData[classroom.id]?.[period]
                    return (
                      <div key={period} className="border rounded-lg border-gray-200 p-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          {period.charAt(0).toUpperCase() + period.slice(1)}
                        </div>
                        {entry ? (
                          <div className="space-y-1 text-sm text-gray-700">
                            <div className="font-medium text-gray-900">{entry.className}</div>
                             <div>Teacher: {entry.teacherName}</div>
                             {entry.coTeacherName && <div>{entry.isStudentCoTeacher ? 'Student co-teacher' : 'Co-teacher'}: {entry.coTeacherName}</div>}
                            <div>Grade Range: {entry.gradeRange}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">No class scheduled</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Teacher Comments & Feedback</h3>
        </div>
        
        {/* Add Comment Form */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="space-y-4">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts on the schedule..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Make this comment public (visible to all teachers)
                </span>
              </label>
              <button
                onClick={submitComment}
                disabled={!newComment.trim() || isSubmittingComment}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {isSubmittingComment ? 'Submitting...' : 'Submit Comment'}
              </button>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="px-6 py-4">
          {comments.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No comments yet. Be the first to share your feedback!</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="border-l-4 border-gray-200 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {comment.guardian.firstName} {comment.guardian.lastName}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        comment.isPublic 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {comment.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-700">{comment.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div></>}
    </div>
  )
}
