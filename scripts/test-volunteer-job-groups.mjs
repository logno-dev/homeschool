import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { eq } from 'drizzle-orm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, console, Request, setTimeout, process: { env: { NODE_ENV: 'production' } }, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) })
  return module.exports
}

const directory = mkdtempSync(join(tmpdir(), 'dvclc-job-groups-'))
const client = createClient({ url: pathToFileURL(join(directory, 'test.db')).href })
const schema = load('lib/schema.ts')
const db = drizzle(client, { schema })
const pure = load('lib/volunteer-job-groups.ts')
let viewer = 'board-user'
let adminAllowed = true
const request = body => new Request('http://localhost/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
try {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.guardians, schema.userGroups, schema.userGroupMemberships, schema.volunteerJobs, schema.sessionVolunteerJobs, schema.sessions, schema.schedules, schema.classTeachingRequests, schema.volunteerAssignments, schema.familyRegistrationStatus, schema.familySessionFees, schema.children, schema.classRegistrations, schema.sessionClassrooms]) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.filter(column => column.name !== 'allowed_group_ids').map(column => {
      let sql = `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}`
      if (column.default !== undefined) {
        const value = column.default
        sql += ` DEFAULT ${typeof value === 'object' ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : Number(value)}`
      }
      return sql
    })
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(', ')})`)
  }
  await client.execute("INSERT INTO volunteer_jobs (id,title,description,created_by) VALUES ('open','Open job','Everyone can help','board-user')")
  await client.executeMultiple(readFileSync(new URL('../drizzle/0052_volunteer_job_groups.sql', import.meta.url), 'utf8'))
  assert.equal((await db.select().from(schema.volunteerJobs))[0].allowedGroupIds, '[]')
  for (const [id, familyId] of [['board-user', 'family-a'], ['partner', 'family-a'], ['teacher-user', 'family-b'], ['admin-only', 'family-c']]) {
    await db.insert(schema.guardians).values({ id, familyId, email: `${id}@example.com`, firstName: id, lastName: 'Test' })
  }
  await db.insert(schema.userGroups).values([{ id: 'board', name: 'Board', slug: 'board' }, { id: 'teacher', name: 'Teacher', slug: 'teacher' }])
  await db.insert(schema.userGroupMemberships).values([{ id: 'board-member', userId: 'board-user', groupId: 'board' }, { id: 'teacher-member', userId: 'teacher-user', groupId: 'teacher' }])
  await db.insert(schema.sessions).values({ id: 'session', name: 'Test session', startDate: '2026-09-01', endDate: '2026-12-01', registrationStartDate: '2026-09-01', registrationEndDate: '2026-12-01', isActive: true })
  const baseMocks = { 'server-only': {}, '@/lib/db': { db }, '@/lib/schema': schema, './volunteer-job-groups': pure }
  const access = load('lib/volunteer-job-access.ts', baseMocks)
  const mocks = {
    ...baseMocks, '@/lib/volunteer-job-access': access, '@/lib/volunteer-job-groups': pure,
    '@/lib/server-auth': {
      getAuthenticatedAdmin: async () => adminAllowed ? { session: { user: { id: viewer, email: `${viewer}@example.com` } } } : { error: 'Forbidden', status: 403 },
      getAuthenticatedUser: async () => ({ user: { id: viewer } }),
      getAuthenticatedUserSession: async () => ({ session: { user: { id: viewer } } }),
    },
    '@/lib/database': {
      ensureSessionClassrooms: async () => {}, ensureSessionVolunteerJobs: async () => {}, getActiveSession: async () => null,
      getGuardianById: async id => (await db.select().from(schema.guardians).where(eq(schema.guardians.id, id)))[0],
      getGuardiansByFamily: async familyId => db.select().from(schema.guardians).where(eq(schema.guardians.familyId, familyId)),
      getChildrenByFamily: async () => [], getGlobalSetting: async () => null,
    },
    '@/lib/registration-events': { publishRegistrationUpdate: () => {} },
    '@/lib/user-groups': { getRegistrationAccess: async () => ({ isOpen: true }) },
    '@/lib/fee-calculation': { createOrUpdateFamilySessionFee: async () => {} },
    '@/lib/grades': { isGradeWithinRange: () => true },
    '@/lib/email': { sendRegistrationConfirmationEmail: async () => {}, sendRegistrationOverrideNotificationEmail: async () => {} },
  }
  const jobsApi = load('app/api/admin/volunteer-jobs/route.ts', mocks)
  const jobApi = load('app/api/admin/volunteer-jobs/[jobId]/route.ts', mocks)
  const jobInput = { title: 'Board-only job', description: 'Private board duties', quantityAvailable: 2, jobType: 'period_based', allowedGroupIds: ['board'] }
  let response = await jobsApi.POST(request(jobInput))
  assert.equal(response.status, 201)
  const restricted = await response.json()
  assert.deepEqual(restricted.allowedGroupIds, ['board'])
  response = await jobsApi.POST(request({ ...jobInput, title: 'Board or teacher job', jobType: 'non_period', allowedGroupIds: ['board', 'teacher'] }))
  assert.equal(response.status, 201)
  const either = await response.json()
  for (const job of [{ id: 'open', jobType: 'non_period' }, restricted, either]) await db.insert(schema.sessionVolunteerJobs).values({ id: `session-${job.id}`, sessionId: 'session', volunteerJobId: job.id, jobType: job.jobType, quantityAvailable: 2 })
  assert.equal((await jobsApi.POST(request({ ...jobInput, allowedGroupIds: ['unknown'] }))).status, 400)
  assert.equal((await jobApi.PUT(request({ ...jobInput, allowedGroupIds: 'board' }), { params: Promise.resolve({ jobId: restricted.id }) })).status, 400)
  const { allowedGroupIds, ...withoutGroups } = jobInput
  assert.equal((await jobApi.PUT(request(withoutGroups), { params: Promise.resolve({ jobId: restricted.id }) })).status, 200)
  assert.equal((await db.select().from(schema.volunteerJobs).where(eq(schema.volunteerJobs.id, restricted.id)))[0].allowedGroupIds, '["board"]')
  adminAllowed = false
  assert.equal((await jobApi.PUT(request({ ...jobInput, allowedGroupIds: [] }), { params: Promise.resolve({ jobId: restricted.id }) })).status, 403)
  adminAllowed = true

  assert.equal(await access.canSignUpForVolunteerJob(restricted.id, 'session', 'board-user', 'board-user'), true)
  assert.equal(await access.canSignUpForVolunteerJob(restricted.id, 'session', 'partner', 'board-user'), false, 'Personal access is not inherited from a family member')
  assert.equal(await access.canSignUpForVolunteerJob(restricted.id, 'session', 'board-user', 'partner'), false, 'The assigned guardian must also qualify')
  assert.equal(await access.canSignUpForVolunteerJob(either.id, 'session', 'teacher-user', 'teacher-user'), true, 'Any selected group qualifies')
  assert.equal(await access.canSignUpForVolunteerJob(restricted.id, 'session', 'admin-only', 'admin-only'), false, 'Admin role alone does not grant signup eligibility')
  const schedules = load('lib/registration-schedules.ts', mocks)
  const boardSchedule = await schedules.getRegistrationSchedules('session', 'board-user')
  assert.ok(boardSchedule.volunteerJobs.some(job => job.id === restricted.id))
  assert.deepEqual(Array.from(boardSchedule.volunteerJobs.find(job => job.id === restricted.id).eligibleGuardianIds), ['board-user'])
  const partnerSchedule = await schedules.getRegistrationSchedules('session', 'partner')
  assert.equal(partnerSchedule.volunteerJobs.length, 0)
  assert.deepEqual(partnerSchedule.nonPeriodVolunteerJobs.map(job => job.id), ['open'])
  assert.ok(!JSON.stringify(partnerSchedule).includes(restricted.id))

  const hold = load('app/api/registration/holds/volunteer/route.ts', mocks).POST
  const batch = load('app/api/registration/batch-register/route.ts', mocks).POST
  const selection = { guardianId: 'board-user', sessionId: 'session', volunteerJobId: restricted.id, period: 'first', volunteerType: 'volunteer_job', guardianName: 'Board' }
  const submit = () => batch(request({ sessionId: 'session', registrations: [], volunteerAssignments: [selection] }))
  viewer = 'partner'
  assert.equal((await hold(request(selection))).status, 403)
  assert.equal((await submit()).status, 403, 'Direct submission cannot bypass the catalog filter')
  viewer = 'board-user'
  assert.equal((await hold(request({ ...selection, guardianId: 'partner' }))).status, 403)
  response = await hold(request(selection))
  assert.equal(response.status, 200)
  const held = await response.json()
  const counts = await schedules.getRegistrationSchedules('session', 'partner')
  assert.ok(!JSON.stringify(counts.volunteerJobAssignmentCounts).includes(restricted.id))
  const bundleModule = load('lib/registration.ts', { ...mocks, './database': mocks['@/lib/database'], './registration-schedules': schedules })
  assert.equal((await bundleModule.getRegistrationScheduleBundle('session', 'partner')).initialVolunteerAssignments.length, 0)
  assert.equal((await bundleModule.getRegistrationScheduleBundle('session', 'board-user')).initialVolunteerAssignments.length, 1)
  viewer = 'partner'
  const refresh = load('app/api/registration/holds/refresh/route.ts', mocks).POST
  assert.equal((await refresh(request({ sessionId: 'session' }))).status, 200)
  assert.equal((await db.select().from(schema.volunteerAssignments))[0].holdExpiresAt, held.holdExpiresAt, 'An ineligible user cannot renew a hidden reservation')

  viewer = 'board-user'
  await db.delete(schema.userGroupMemberships).where(eq(schema.userGroupMemberships.id, 'board-member'))
  assert.equal((await submit()).status, 403, 'Membership revocation is checked again at checkout')
  await db.insert(schema.userGroupMemberships).values({ id: 'board-member', userId: 'board-user', groupId: 'board' })
  assert.equal((await submit()).status, 200)
  assert.equal((await db.select().from(schema.volunteerAssignments))[0].status, 'assigned')
  const adminAssignments = load('app/api/admin/volunteer-assignments/route.ts', mocks)
  assert.equal((await adminAssignments.POST(request({ ...selection, guardianId: 'partner' }))).status, 403)
  const adminAssignment = load('app/api/admin/volunteer-assignments/[assignmentId]/route.ts', mocks)
  assert.equal((await adminAssignment.PATCH(request({ guardianId: 'partner', volunteerType: 'volunteer_job', volunteerJobId: restricted.id }), { params: Promise.resolve({ assignmentId: held.holdId }) })).status, 403)

  const statusModule = load('lib/registration-status.ts', mocks)
  const partnerStatus = await statusModule.getRegistrationStatus('session', 'partner')
  assert.equal(partnerStatus.volunteerAssignments.length, 0)
  assert.equal(partnerStatus.existingVolunteerCoverage.length, 1)
  assert.ok(!JSON.stringify(partnerStatus).includes(restricted.id))
  assert.ok(!JSON.stringify(partnerStatus).includes('Board-only job'))
  assert.equal((await statusModule.getRegistrationStatus('session', 'board-user')).volunteerAssignments.length, 1)
  viewer = 'partner'
  response = await batch(request({ sessionId: 'session', registrations: [], volunteerAssignments: [], modifyRegistration: true }))
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()))
  assert.equal((await db.select().from(schema.volunteerAssignments))[0].id, held.holdId, 'Editing the family must preserve hidden commitments and their IDs')
  await db.update(schema.volunteerAssignments).set({ status: 'pending' }).where(eq(schema.volunteerAssignments.id, held.holdId))
  await db.update(schema.familyRegistrationStatus).set({ status: 'admin_override', adminOverride: true }).where(eq(schema.familyRegistrationStatus.familyId, 'family-a'))
  response = await batch(request({ sessionId: 'session', registrations: [], volunteerAssignments: [], modifyRegistration: true, requestAdminOverride: true }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).adminOverrideRequested, true)
  const pending = await db.select().from(schema.volunteerAssignments)
  assert.equal(pending.length, 1)
  assert.equal(pending[0].id, held.holdId)
  assert.equal(pending[0].status, 'pending', 'Hidden pending assignments must not be approved or duplicated by family edits')

  viewer = 'board-user'
  response = await jobApi.PUT(request({ ...jobInput, allowedGroupIds: [] }), { params: Promise.resolve({ jobId: restricted.id }) })
  assert.equal(response.status, 200)
  assert.equal(await access.canSignUpForVolunteerJob(restricted.id, 'session', 'partner', 'partner'), true)
  await db.update(schema.volunteerJobs).set({ allowedGroupIds: '{broken' }).where(eq(schema.volunteerJobs.id, restricted.id))
  assert.equal(await access.canSignUpForVolunteerJob(restricted.id, 'session', 'board-user', 'board-user'), false)
  assert.ok(!(await access.getVisibleVolunteerJobs('board-user')).has(restricted.id))
  const context = load('app/components/RegistrationContext.tsx')
  const Counter = load('app/components/VolunteerHourCounter.tsx', { './RegistrationContext': context }).default
  const coverage = [{ guardianId: 'board-user', guardianName: 'Board', period: 'first', volunteerType: 'existing_volunteer', className: 'Existing family volunteer commitment' }, { guardianId: 'board-user', guardianName: 'Board', period: 'non_period', volunteerType: 'existing_volunteer', className: 'Existing family volunteer commitment' }]
  let requirements
  function Probe() {
    const registration = context.useRegistration()
    requirements = registration.getVolunteerRequirements()
    assert.equal(registration.hasGuardianConflictInPeriod('board-user', 'first'), true)
    assert.equal(registration.getGuardianConflictDetails('board-user', 'first'), 'Existing family volunteer commitment')
    return React.createElement(Counter, { teachingAssignments: coverage })
  }
  const counterHtml = renderToStaticMarkup(React.createElement(context.RegistrationProvider, { teachingAssignments: coverage, initialRegistrations: [{ childId: 'child', scheduleId: 's1', period: 'first' }, { childId: 'child', scheduleId: 's2', period: 'second' }] }, React.createElement(Probe)))
  assert.equal(requirements.requiredHours, 2)
  assert.equal(requirements.fulfilledHours, 2, 'Private hour-based and general commitments still fulfill family requirements')
  assert.ok(counterHtml.includes('Complete'))
  assert.ok(!counterHtml.includes('Teaching Existing family'))
  console.log('Volunteer-job migration, group editing, personal eligibility, filtered catalogs/holds/history, signup enforcement, and preserved family commitments verified.')
} finally { client.close(); rmSync(directory, { recursive: true, force: true }) }
