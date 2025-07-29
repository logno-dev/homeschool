'use client'

import { useState, useEffect } from 'react'
import type { Session, ScheduleComment } from '@/lib/schema'

interface ScheduleEntry {
  id: string
  classroomId: string
  period: string
  classTeachingRequestId: string
  className: string
  teacherName: string
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

export default function TeacherScheduleReview() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [scheduleData, setScheduleData] = useState<ScheduleData>({})
  const [comments, setComments] = useState<CommentWithGuardian[]>([])
  const [newComment, setNewComment] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [classrooms, setClassrooms] = useState<any[]>([])

  useEffect(() => {
    fetchSessions()
    fetchClassrooms()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      fetchScheduleData()
      fetchComments()
    }
  }, [selectedSession])

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

  const fetchClassrooms = async () => {
    try {
      const response = await fetch('/api/admin/classrooms')
      if (response.ok) {
        const data = await response.json()
        setClassrooms(data.classrooms || [])
      }
    } catch (error) {
      console.error('Error fetching classrooms:', error)
    }
  }

  const fetchScheduleData = async () => {
    if (!selectedSession) return

    try {
      const response = await fetch(`/api/admin/schedule/${selectedSession}`)
      if (response.ok) {
        const data = await response.json()
        
        // Create a map of class teaching request ID to teacher info
        const teacherMap: { [key: string]: { name: string, gradeRange: string, className: string } } = {}
        if (data.approvedClasses) {
          data.approvedClasses.forEach((classRequest: any) => {
            teacherMap[classRequest.id] = {
              name: `${classRequest.guardian.firstName} ${classRequest.guardian.lastName}`,
              gradeRange: classRequest.gradeRange,
              className: classRequest.className
            }
          })
        }
        
        // Transform the schedule entries into a nested object for easy lookup
        const scheduleMap: ScheduleData = {}
        
        if (data.scheduleEntries) {
          data.scheduleEntries.forEach((entry: any) => {
            if (!scheduleMap[entry.classroomId]) {
              scheduleMap[entry.classroomId] = {}
            }
            
            const teacherInfo = teacherMap[entry.classTeachingRequestId] || {
              name: 'Unknown Teacher',
              gradeRange: 'Unknown',
              className: 'Unknown Class'
            }
            
            scheduleMap[entry.classroomId][entry.period] = {
              id: entry.id,
              classroomId: entry.classroomId,
              period: entry.period,
              classTeachingRequestId: entry.classTeachingRequestId,
              className: teacherInfo.className,
              teacherName: teacherInfo.name,
              gradeRange: teacherInfo.gradeRange
            }
          })
        }
        
        setScheduleData(scheduleMap)
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error)
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

  const periods = ['first', 'second', 'lunch', 'third']

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No active sessions found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Schedule Review</h2>
        <select
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
      </div>

      {/* Schedule Grid */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Current Schedule</h3>
        </div>
        <div className="overflow-x-auto">
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
            <div className="flex items-center justify-between">
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
      </div>
    </div>
  )
}