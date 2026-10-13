import ClassHub from '@/app/components/ClassHub'
import { getAuthenticatedUser } from '@/lib/server-auth'

export default async function ClassHubPage({ params }: { params: Promise<{ scheduleId: string }> }) {
  await getAuthenticatedUser()
  const { scheduleId } = await params
  return <ClassHub scheduleId={scheduleId} />
}
