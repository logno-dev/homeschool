import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq, inArray, and } from 'drizzle-orm'
import { getAuthenticatedUser, getAppRole } from '@/lib/server-auth'
import { getAdminModuleAccess } from '@/lib/user-groups'
import { db } from '@/lib/db'
import { users, classTeachingRequests, familyRegistrationStatus, scholarshipApplications, families, sessions, guardians } from '@/lib/schema'
import AdminLayout from '@/app/components/AdminLayout'

type ActionCard = {
  key: 'users' | 'registration-overrides' | 'scholarships' | 'class-requests'
  title: string
  description: string
  href: string
  count: number
  tone: string
}

function ActionTable({ title, href, children, empty }: { title: string; href: string; children: React.ReactNode; empty: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4"><h2 className="font-semibold text-gray-900">{title}</h2><Link href={href} className="text-sm font-medium text-blue-600 hover:text-blue-800">Open full queue</Link></div>
      {empty ? <p className="px-5 py-6 text-sm text-gray-500">No outstanding items.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><tbody className="divide-y divide-gray-200">{children}</tbody></table></div>}
    </section>
  )
}

export default async function AdminDashboard() {
  const session = await getAuthenticatedUser()
  const role = await getAppRole(session)
  const isPrivileged = role === 'admin' || role === 'moderator'
  const moduleKeys: ActionCard['key'][] = ['users', 'registration-overrides', 'scholarships', 'class-requests']
  const access = await Promise.all(moduleKeys.map(async (key) => [key, isPrivileged || await getAdminModuleAccess(session.user.id, key)] as const))
  const canAccess = new Map(access)
  if (!Array.from(canAccess.values()).some(Boolean)) redirect('/dashboard')

  const [activationItems, overrideItems, scholarshipItems, classRequestItems] = await Promise.all([
    canAccess.get('users') ? db.select({ id: users.id, name: users.firstName, lastName: users.lastName, email: users.email, status: users.activationStatus, createdAt: users.createdAt }).from(users).where(inArray(users.activationStatus, ['pending', 'under_review'])) : Promise.resolve([]),
    canAccess.get('registration-overrides') ? db.select({ id: familyRegistrationStatus.id, familyName: families.name, sessionName: sessions.name, createdAt: familyRegistrationStatus.createdAt }).from(familyRegistrationStatus).leftJoin(families, eq(familyRegistrationStatus.familyId, families.id)).leftJoin(sessions, eq(familyRegistrationStatus.sessionId, sessions.id)).where(and(eq(familyRegistrationStatus.status, 'admin_override'), eq(familyRegistrationStatus.adminOverride, true))) : Promise.resolve([]),
    canAccess.get('scholarships') ? db.select({ id: scholarshipApplications.id, familyName: families.name, sessionName: sessions.name, guardianName: guardians.firstName, guardianLastName: guardians.lastName, createdAt: scholarshipApplications.createdAt }).from(scholarshipApplications).leftJoin(families, eq(scholarshipApplications.familyId, families.id)).leftJoin(sessions, eq(scholarshipApplications.sessionId, sessions.id)).leftJoin(guardians, eq(scholarshipApplications.guardianId, guardians.id)).where(eq(scholarshipApplications.status, 'pending')) : Promise.resolve([]),
    canAccess.get('class-requests') ? db.select({ id: classTeachingRequests.id, className: classTeachingRequests.className, status: classTeachingRequests.status, createdAt: classTeachingRequests.createdAt }).from(classTeachingRequests).where(inArray(classTeachingRequests.status, ['pending', 'changes_requested'])) : Promise.resolve([])
  ])

  const cards = ([
    { key: 'users', title: 'Account Activations', description: 'Review new account and acknowledgement requests.', href: '/admin/users', count: activationItems.length, tone: 'border-blue-200 bg-blue-50 text-blue-900' },
    { key: 'registration-overrides', title: 'Registration Overrides', description: 'Resolve families waiting for registration approval.', href: '/admin/registration-overrides', count: overrideItems.length, tone: 'border-amber-200 bg-amber-50 text-amber-900' },
    { key: 'scholarships', title: 'Scholarship Requests', description: 'Review pending scholarship applications.', href: '/admin/scholarships', count: scholarshipItems.length, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { key: 'class-requests', title: 'Teacher Class Requests', description: 'Review new and returned class teaching requests.', href: '/admin/class-requests', count: classRequestItems.length, tone: 'border-purple-200 bg-purple-50 text-purple-900' }
  ] satisfies ActionCard[]).filter((card) => canAccess.get(card.key))

  return (
    <AdminLayout userName={[session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || session.user.email} activeTab="dashboard">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-purple-500">Administration</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Action Dashboard</h1>
            <p className="mt-1 text-gray-600">Review outstanding requests and jump directly to the next item that needs attention.</p>
          </div>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Link key={card.key} href={card.href} className={`rounded-xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}>
                <div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{card.title}</h2><span className="text-3xl font-bold">{card.count}</span></div>
                <p className="mt-3 text-sm opacity-80">{card.description}</p>
                <span className="mt-5 inline-block text-sm font-semibold underline">Open queue</span>
              </Link>
            ))}
          </section>
          {cards.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">No administrative modules are assigned to your account.</div>}
          <div className="space-y-5">
            {canAccess.get('users') && <ActionTable title="Account Activations" href="/admin/users" empty={activationItems.length === 0}>{activationItems.map((item) => <tr key={item.id}><td className="px-5 py-3 font-medium text-gray-900">{item.name} {item.lastName}</td><td className="px-5 py-3 text-gray-600">{item.email}</td><td className="px-5 py-3 capitalize text-gray-500">{item.status.replace('_', ' ')}</td><td className="px-5 py-3 text-right"><Link href={`/admin/users/${item.id}`} className="font-medium text-blue-600 hover:text-blue-800">Review</Link></td></tr>)}</ActionTable>}
            {canAccess.get('registration-overrides') && <ActionTable title="Registration Overrides" href="/admin/registration-overrides" empty={overrideItems.length === 0}>{overrideItems.map((item) => <tr key={item.id}><td className="px-5 py-3 font-medium text-gray-900">{item.familyName || 'Unknown family'}</td><td className="px-5 py-3 text-gray-600">{item.sessionName || 'Unknown session'}</td><td className="px-5 py-3 text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</td><td className="px-5 py-3 text-right"><Link href="/admin/registration-overrides" className="font-medium text-blue-600 hover:text-blue-800">Review</Link></td></tr>)}</ActionTable>}
            {canAccess.get('scholarships') && <ActionTable title="Scholarship Requests" href="/admin/scholarships" empty={scholarshipItems.length === 0}>{scholarshipItems.map((item) => <tr key={item.id}><td className="px-5 py-3 font-medium text-gray-900">{item.familyName || 'Unknown family'}</td><td className="px-5 py-3 text-gray-600">{item.sessionName || 'Unknown session'}</td><td className="px-5 py-3 text-gray-500">{item.guardianName} {item.guardianLastName}</td><td className="px-5 py-3 text-right"><Link href="/admin/scholarships" className="font-medium text-blue-600 hover:text-blue-800">Review</Link></td></tr>)}</ActionTable>}
            {canAccess.get('class-requests') && <ActionTable title="Teacher Class Requests" href="/admin/class-requests" empty={classRequestItems.length === 0}>{classRequestItems.map((item) => <tr key={item.id}><td className="px-5 py-3 font-medium text-gray-900">{item.className}</td><td className="px-5 py-3 capitalize text-gray-600">{item.status.replace('_', ' ')}</td><td className="px-5 py-3 text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</td><td className="px-5 py-3 text-right"><Link href="/admin/class-requests" className="font-medium text-blue-600 hover:text-blue-800">Review</Link></td></tr>)}</ActionTable>}
          </div>
        </div>
      </main>
    </AdminLayout>
  )
}
