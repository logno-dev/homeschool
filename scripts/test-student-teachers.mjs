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

const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, console, process, Request, Response, URL, require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name) })
  return module.exports
}

const directory = mkdtempSync(join(tmpdir(), 'dvclc-student-teachers-'))
const client = createClient({ url: pathToFileURL(join(directory, 'test.db')).href })
const schema = load('lib/schema.ts')
const db = drizzle(client, { schema })

try {
  const dialect = new SQLiteSyncDialect()
  const tables = [schema.families, schema.guardians, schema.children, schema.sessions, schema.sessionRegistrationWindows, schema.classrooms, schema.sessionClassrooms, schema.classTeachingRequests, schema.schedules, schema.classRegistrations, schema.volunteerJobs, schema.sessionVolunteerJobs, schema.volunteerAssignments]
  for (const table of tables) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.map((column) => {
      let sql = `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}`
      if (column.default !== undefined) {
        const value = column.default
        sql += ` DEFAULT ${typeof value === 'object' ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : Number(value)}`
      }
      return sql
    })
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(', ')})`)
  }

  await db.insert(schema.families).values({ id: 'family', name: 'Teacher Family', address: '1 Test Way', phone: '555-0100', email: 'family@example.com', sharingCode: 'teacher-family' })
  await db.insert(schema.families).values({ id: 'co-family', name: 'Co-Teacher Family', address: '2 Test Way', phone: '555-0101', email: 'co-family@example.com', sharingCode: 'co-teacher-family' })
  await db.insert(schema.guardians).values({ id: 'guardian', familyId: 'family', email: 'parent@example.com', firstName: 'Pat', lastName: 'Teacher' })
  await db.insert(schema.guardians).values({ id: 'other-guardian', familyId: 'family', email: 'other@example.com', firstName: 'Other', lastName: 'Guardian' })
  await db.insert(schema.guardians).values({ id: 'co-guardian', familyId: 'co-family', email: 'co-parent@example.com', firstName: 'Casey', lastName: 'Parent' })
  await db.insert(schema.children).values([
    { id: 'student-teacher', familyId: 'family', firstName: 'Alex', lastName: 'Teacher', grade: '8', dateOfBirth: '2012-01-01', allergies: 'Peanuts' },
    { id: 'other-child', familyId: 'family', firstName: 'Sam', lastName: 'Teacher', grade: '6', dateOfBirth: '2014-01-01', allergies: 'None' },
    { id: 'student-co-teacher', familyId: 'co-family', firstName: 'Riley', lastName: 'Helper', grade: '7', dateOfBirth: '2013-01-01', allergies: 'Dairy' }
  ])
  await db.insert(schema.sessions).values({ id: 'session', name: 'Fall', startDate: '2026-09-01', endDate: '2026-12-01', registrationStartDate: '2026-08-01', registrationEndDate: '2026-08-31' })
  await db.insert(schema.classrooms).values({ id: 'room-template', name: 'Room A' })
  await db.insert(schema.sessionClassrooms).values({ id: 'room', sessionId: 'session', classroomId: 'room-template', name: 'Room A', orderIndex: 0 })
  await db.insert(schema.classTeachingRequests).values({ id: 'class', sessionId: 'session', guardianId: 'guardian', coTeacherId: 'co-guardian', coTeacher: 'Casey Parent', className: 'Student-Led Science', description: 'Science', gradeRange: '6-8', maxStudents: 10, helpersNeeded: 0, status: 'approved', studentTeacherChildId: 'student-teacher', studentCoTeacherChildId: 'student-co-teacher' })
  await db.insert(schema.schedules).values({ id: 'schedule', sessionId: 'session', classTeachingRequestId: 'class', classroomId: 'room-template', sessionClassroomId: 'room', period: 'first', status: 'published' })
  await db.insert(schema.classRegistrations).values({ id: 'registration', sessionId: 'session', scheduleId: 'schedule', childId: 'other-child', familyId: 'family', registeredBy: 'guardian', status: 'registered' })

  const createAdminClass = load('app/api/admin/class-teaching-requests/route.ts', {
    '@/lib/db': { db }, '@/lib/schema': schema,
    '@/lib/server-auth': { getAuthenticatedAdmin: async () => ({ session: { user: { id: 'guardian' } } }) },
    '@/lib/database': { getClassTeachingRequestsWithSession: async () => [] },
    '@/lib/grades': { getGradeRangeFromLabel: () => ({ from: 6, to: 8 }) },
    '@/lib/user-groups': { syncTeacherGroupMembership: async () => {} }
  }).POST
  const classPayload = { sessionId: 'session', className: 'Co-Led Math', description: 'Math', gradeRange: '6-8', teacherId: 'guardian', coTeacherId: 'co-guardian', studentCoTeacherChildId: 'student-co-teacher' }
  const invalidCoTeacherResponse = await createAdminClass(new Request('http://localhost/api/admin/class-teaching-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...classPayload, studentCoTeacherChildId: 'other-child' }) }))
  assert.equal(invalidCoTeacherResponse.status, 400, 'A student co-teacher must belong to the selected parent family')
  const validCoTeacherResponse = await createAdminClass(new Request('http://localhost/api/admin/class-teaching-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(classPayload) }))
  assert.equal(validCoTeacherResponse.status, 201)
  assert.equal((await validCoTeacherResponse.json()).request.studentCoTeacherChildId, 'student-co-teacher')

  const studentTeacherHelpers = load('lib/student-teachers.ts', { 'server-only': {}, '@/lib/db': { db }, '@/lib/schema': schema })
  assert.deepEqual(await studentTeacherHelpers.getStudentTeacherAssignment('session', 'student-teacher', 'first'), { scheduleId: 'schedule', className: 'Student-Led Science' })
  assert.deepEqual(await studentTeacherHelpers.getStudentTeacherAssignment('session', 'student-co-teacher', 'first'), { scheduleId: 'schedule', className: 'Student-Led Science' })
  assert.equal(await studentTeacherHelpers.getStudentTeacherAssignment('session', 'other-child', 'first'), null)

  const createClassHold = load('app/api/registration/holds/class/route.ts', {
    '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/student-teachers': studentTeacherHelpers,
    '@/lib/server-auth': { getAuthenticatedUser: async () => ({ user: { id: 'guardian' } }) },
    '@/lib/database': { getGuardianById: async () => (await db.select().from(schema.guardians))[0] },
    '@/lib/registration-events': { publishRegistrationUpdate: () => {} }
  }).POST
  const holdResponse = await createClassHold(new Request('http://localhost/api/registration/holds/class', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'session', scheduleId: 'schedule', childId: 'student-teacher' }) }))
  assert.equal(holdResponse.status, 409)
  assert.match((await holdResponse.json()).error, /student teacher/)

  const registrationSchedules = load('lib/registration-schedules.ts', {
    'server-only': {}, '@/lib/db': { db }, '@/lib/schema': schema,
    '@/lib/database': { ensureSessionClassrooms: async () => {}, ensureSessionVolunteerJobs: async () => {} },
    '@/lib/volunteer-job-access': { getVisibleVolunteerJobs: async () => new Map() }
  })
  const result = await registrationSchedules.getRegistrationSchedules('session', 'guardian')
  assert.equal(result.schedules.length, 1)
  assert.equal(result.schedules[0].roster[0].id, 'student-teacher')
  assert.equal(result.schedules[0].roster[0].role, 'student_teacher')
  assert.equal(result.schedules[0].roster[1].role, 'student_co_teacher')
  assert.equal(`${result.schedules[0].teacher.firstName} ${result.schedules[0].teacher.lastName}`, 'Alex Teacher')
  assert.equal(result.schedules[0].classTeachingRequest.coTeacher, 'Riley Helper')
  assert.equal(result.schedules[0].teacher.id, 'guardian', 'The parent remains linked for volunteer credit')
  assert.equal(result.schedules[0].availableSpots, 9, 'Only the enrolled student consumes a student seat')

  let currentUserId = 'guardian'
  const teacherRoster = load('app/api/teacher/schedule/[sessionId]/route.ts', {
    '@/lib/db': { db }, '@/lib/schema': schema,
    '@/lib/server-auth': { getAuthenticatedUserSession: async () => ({ session: { user: { id: currentUserId } } }) },
    '@/lib/database': { getGuardianById: async (id) => (await db.select().from(schema.guardians)).find((guardian) => guardian.id === id) },
    '@/lib/app-time': { getAppTimezone: async () => 'America/New_York', parseAppDate: (value) => new Date(`${value}T00:00:00Z`) }
  }).GET
  const rosterResponse = await teacherRoster(new Request('http://localhost/api/teacher/schedule/session'), { params: Promise.resolve({ sessionId: 'session' }) })
  assert.equal(rosterResponse.status, 200)
  const rosterPayload = await rosterResponse.json()
  const [teacherClass] = rosterPayload.classes
  assert.equal(rosterPayload.reviewSchedule[0].teacherName, 'Alex Teacher')
  assert.equal(rosterPayload.reviewSchedule[0].coTeacherName, 'Riley Helper')
  assert.equal(rosterPayload.classrooms[0].name, 'Room A')
  assert.equal(rosterPayload.registrationStarted, true)
  assert.equal(teacherClass.classroomName, 'Room A')
  assert.equal(teacherClass.period, 'first')
  assert.equal(teacherClass.roster.length, 3)
  assert.equal(teacherClass.roster.find((student) => student.id === 'student-teacher').allergies, 'Peanuts')
  assert.equal(teacherClass.roster.find((student) => student.id === 'student-co-teacher').allergies, 'Dairy')
  assert.equal(teacherClass.roster.find((student) => student.id === 'other-child').allergies, 'None')
  currentUserId = 'co-guardian'
  const coTeacherRosterResponse = await teacherRoster(new Request('http://localhost/api/teacher/schedule/session'), { params: Promise.resolve({ sessionId: 'session' }) })
  assert.equal((await coTeacherRosterResponse.json()).classes.length, 1, 'The student co-teacher parent retains roster access')
  currentUserId = 'other-guardian'
  const privateRosterResponse = await teacherRoster(new Request('http://localhost/api/teacher/schedule/session'), { params: Promise.resolve({ sessionId: 'session' }) })
  assert.deepEqual((await privateRosterResponse.json()).classes, [], 'Another guardian cannot view this class roster')

  await client.execute('UPDATE class_teaching_requests SET max_students = 1 WHERE id = \'class\'')
  await db.insert(schema.children).values([
    { id: 'waitlisted-child', familyId: 'co-family', firstName: 'Waitlisted', lastName: 'Student', grade: '6', dateOfBirth: '2014-01-01' },
    { id: 'admin-added-child', familyId: 'co-family', firstName: 'Admin', lastName: 'Addition', grade: '6', dateOfBirth: '2014-02-01' }
  ])
  await db.insert(schema.classRegistrations).values({ id: 'waitlisted-registration', sessionId: 'session', scheduleId: 'schedule', childId: 'waitlisted-child', familyId: 'co-family', registeredBy: 'guardian', status: 'waitlisted' })

  const adminRegistrationMocks = {
    '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/student-teachers': studentTeacherHelpers,
    '@/lib/server-auth': { getAuthenticatedAdmin: async () => ({ session: { user: { id: 'guardian' } } }) },
    '@/lib/registration-events': { publishRegistrationUpdate: () => {} }
  }
  const updateAdminRegistration = load('app/api/admin/registrations/[registrationId]/route.ts', adminRegistrationMocks).PATCH
  const updateParams = { params: Promise.resolve({ registrationId: 'waitlisted-registration' }) }
  const blockedPromotion = await updateAdminRegistration(new Request('http://localhost/api/admin/registrations/waitlisted-registration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'registered' }) }), updateParams)
  assert.equal(blockedPromotion.status, 409)
  assert.equal((await blockedPromotion.json()).code, 'CLASS_FULL')
  const overloadedPromotion = await updateAdminRegistration(new Request('http://localhost/api/admin/registrations/waitlisted-registration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'registered', allowOverload: true }) }), updateParams)
  assert.equal(overloadedPromotion.status, 200, 'An admin can explicitly promote a student into a full class')

  const createAdminRegistration = load('app/api/admin/registrations/route.ts', adminRegistrationMocks).POST
  const createPayload = { sessionId: 'session', scheduleId: 'schedule', childId: 'admin-added-child', status: 'registered' }
  const blockedAddition = await createAdminRegistration(new Request('http://localhost/api/admin/registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createPayload) }))
  assert.equal(blockedAddition.status, 409)
  assert.equal((await blockedAddition.json()).code, 'CLASS_FULL')
  const overloadedAddition = await createAdminRegistration(new Request('http://localhost/api/admin/registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...createPayload, allowOverload: true }) }))
  assert.equal(overloadedAddition.status, 200, 'An admin can explicitly add a student to a full class')

  console.log('Student-teacher behavior, teacher-scoped roster privacy, and admin class overloads verified.')
} finally {
  client.close()
  rmSync(directory, { recursive: true, force: true })
}
