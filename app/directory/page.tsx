import type { Metadata } from 'next'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { calculateCurrentGrade } from '@/lib/grade-calculation'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { authAccounts, children, families, guardians, users } from '@/lib/schema'
import DirectoryList, { type DirectoryFamily } from './DirectoryList'

export const metadata: Metadata = {
  title: 'Member Directory',
  description: 'A private directory of active DVCLC families and members.',
  robots: { index: false, follow: false },
}

const byName = (a: { firstName: string; lastName: string }, b: { firstName: string; lastName: string }) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)

export default async function DirectoryPage() {
  await getAuthenticatedUser()

  // Select only directory-safe fields. Contact, address, birth date, and health
  // information never leave the database for this page.
  const activeAdults = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      userFamilyId: users.familyId,
      guardianFamilyId: guardians.familyId,
    })
    .from(users)
    .innerJoin(authAccounts, eq(authAccounts.userId, users.id))
    .leftJoin(guardians, eq(guardians.id, users.id))
    .where(and(eq(users.activationStatus, 'active'), eq(authAccounts.isActive, true)))

  const familyIds = Array.from(new Set(activeAdults
    .map((adult) => adult.guardianFamilyId || adult.userFamilyId)
    .filter((familyId): familyId is string => Boolean(familyId))))

  const [familyRows, childRows] = familyIds.length > 0
    ? await Promise.all([
        db.select({ id: families.id, name: families.name }).from(families).where(inArray(families.id, familyIds)),
        db.select({
          id: children.id,
          familyId: children.familyId,
          firstName: children.firstName,
          lastName: children.lastName,
          grade: children.grade,
          gradeYear: children.gradeYear,
          gradeLevel: children.gradeLevel,
        }).from(children).where(inArray(children.familyId, familyIds)),
      ])
    : [[], []]

  const directoryFamilies: DirectoryFamily[] = familyRows.map((family) => ({
    id: family.id,
    name: family.name,
    adults: activeAdults
      .filter((adult) => (adult.guardianFamilyId || adult.userFamilyId) === family.id)
      .map(({ id, firstName, lastName }) => ({ id, firstName, lastName }))
      .sort(byName),
    children: childRows
      .filter((child) => child.familyId === family.id)
      .map((child) => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        grade: calculateCurrentGrade(child.gradeYear, child.gradeLevel) || child.grade || 'Grade not listed',
      }))
      .sort(byName),
  })).sort((a, b) => a.name.localeCompare(b.name))

  const unlinkedAdults = activeAdults
    .filter((adult) => !adult.guardianFamilyId && !adult.userFamilyId)
    .map(({ id, firstName, lastName }) => ({ id, firstName, lastName }))
    .sort(byName)

  const adultCount = activeAdults.length
  const childCount = childRows.length

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">DVCLC Community</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Member Directory</h1>
          <p className="mt-3 max-w-2xl text-slate-200">
            Meet the active families in our co-op. This directory intentionally includes only names, family connections, and student grades.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-white/10 px-3 py-1.5">{adultCount} {adultCount === 1 ? 'adult' : 'adults'}</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{childCount} {childCount === 1 ? 'child' : 'children'}</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{directoryFamilies.length} {directoryFamilies.length === 1 ? 'family' : 'families'}</span>
          </div>
        </header>

        {directoryFamilies.length === 0 && unlinkedAdults.length === 0 ? (
          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">No active members to display</h2>
            <p className="mt-2 text-sm text-slate-600">The directory will populate as active members are added.</p>
          </section>
        ) : (
          <DirectoryList families={directoryFamilies} unlinkedAdults={unlinkedAdults} />
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          For member privacy, contact details, addresses, birth dates, and health information are not included.
        </p>
      </main>
    </div>
  )
}
