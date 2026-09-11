import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getRegistrationStatus } from '@/lib/registration-status'
import { POST as submitRegistration } from '../batch-register/route'

export async function POST(request: Request) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { sessionId } = await request.json()
    if (typeof sessionId !== 'string' || !sessionId) return NextResponse.json({ error: 'Session is required' }, { status: 400 })
    const status = await getRegistrationStatus(sessionId, auth.session.user.id)
    if (status.registrationState === 'completed') return NextResponse.json({ success: true })
    if (!['in_progress', 'incomplete'].includes(status.registrationState)) return NextResponse.json({ error: 'There is no interrupted registration to complete' }, { status: 409 })

    // Reconstruct the submission from this family's persisted selections only.
    // Confirmed entries take precedence over any duplicate cart holds.
    const classRows = [...status.heldClassRegistrations, ...status.classRegistrations]
    const classes = new Map(classRows.map(row => [`${row.registration.childId}:${row.registration.scheduleId}`, row]))
    const volunteerRows = [...status.heldVolunteerAssignments, ...status.volunteerAssignments]
    const volunteers = new Map(volunteerRows.map(row => [`${row.assignment.guardianId}:${row.assignment.period}:${row.assignment.volunteerType}:${row.assignment.scheduleId || row.assignment.volunteerJobId}`, row]))
    if (!classes.size && !volunteers.size && !status.existingVolunteerCoverage.length) return NextResponse.json({ error: 'No saved selections remain. Please select your classes and volunteer jobs again.' }, { status: 400 })
    const emergency = classRows.find(row => row.registration.emergencyContact && row.registration.emergencyPhone)
    return await submitRegistration(new Request(request.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        registrations: Array.from(classes.values(), row => ({
          scheduleId: row.registration.scheduleId, childId: row.registration.childId,
          period: row.schedule.period, className: row.classTeachingRequest.className,
          classroom: row.classroom.name, teacher: '', status: row.registration.status === 'waitlisted' ? 'waitlisted' : 'registered'
        })),
        volunteerAssignments: Array.from(volunteers.values(), row => ({
          guardianId: row.assignment.guardianId, period: row.assignment.period, volunteerType: row.assignment.volunteerType,
          scheduleId: row.assignment.scheduleId || undefined, volunteerJobId: row.assignment.volunteerJobId || undefined,
          className: row.classTeachingRequest?.className, jobTitle: row.volunteerJob?.title, guardianName: ''
        })),
        emergencyContact: { name: emergency?.registration.emergencyContact || '', phone: emergency?.registration.emergencyPhone || '' }
      })
    }))
  } catch (error) {
    console.error('Error resuming registration:', error)
    return NextResponse.json({ error: 'Unable to complete registration. Your saved selections are preserved.' }, { status: 500 })
  }
}
