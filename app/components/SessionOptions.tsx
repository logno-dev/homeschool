import type { Session } from '@/lib/schema'

interface SessionOptionsProps {
  sessions: Array<Pick<Session, 'id' | 'name' | 'startDate' | 'endDate'>>
}

const sortByStartDate = (a: Pick<Session, 'startDate'>, b: Pick<Session, 'startDate'>) =>
  new Date(b.startDate).getTime() - new Date(a.startDate).getTime()

const isPast = (session: Pick<Session, 'endDate'>) => new Date(`${session.endDate}T23:59:59`) < new Date()

export default function SessionOptions({ sessions }: SessionOptionsProps) {
  const sortedSessions = [...sessions].sort(sortByStartDate)
  const recentSessions = sortedSessions.filter((session) => !isPast(session))
  const pastSessions = sortedSessions.filter(isPast)

  const options = (items: SessionOptionsProps['sessions']) => items.map((session) => (
    <option key={session.id} value={session.id}>{session.name}</option>
  ))

  return (
    <>
      {recentSessions.length > 0 && (
        <>
          <option value="__recent_sessions__" disabled>Recent Sessions</option>
          {options(recentSessions)}
        </>
      )}
      {pastSessions.length > 0 && (
        <>
          <option value="__past_sessions__" disabled>Past Sessions</option>
          {options(pastSessions)}
        </>
      )}
    </>
  )
}
