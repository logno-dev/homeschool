import { redirect } from 'next/navigation'
import { getAdminPageAccess } from '@/lib/server-auth'
import AdminAccessProvider from '@/app/components/AdminAccessProvider'

export default async function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  const { modules } = await getAdminPageAccess()
  if (modules.length === 0) redirect('/dashboard')

  return <AdminAccessProvider modules={modules}>{children}</AdminAccessProvider>
}
