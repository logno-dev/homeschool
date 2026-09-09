import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
// Exercise server pages and initial sidebar rendering without a live database/session.
function load(path, mocks = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  })
  const module = { exports: {} }
  vm.runInNewContext(outputText, {
    module, exports: module.exports, console, URL,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  }, { filename: path })
  return module.exports
}

const { ADMIN_MODULES } = load('lib/admin-access.ts')
let role = 'user'
let modules = new Set()
const session = { user: { id: 'delegated-user', firstName: 'Test', email: 'test@example.com' } }
let signedIn = true
const navigation = { redirect: path => { throw new Error(`redirect:${path}`) }, useRouter: () => ({}) }
const auth = load('lib/server-auth.ts', {
  'next/navigation': navigation,
  './database': { getUserById: async () => ({ role }) },
  '@/lib/auth-server': { getCurrentAuthSession: async () => signedIn ? session : null },
  '@/lib/user-groups': { getAdminModuleAccess: async () => modules },
  '@/lib/admin-access': { ADMIN_MODULES },
  react: { ...React, cache: fn => fn },
})
const provider = load('app/components/AdminAccessProvider.tsx')
const Sidebar = load('app/components/AdminLayout.tsx', {
  '@/lib/auth-client': { useAuth: () => ({}) },
  '@/lib/client-env': {},
  'next/navigation': navigation,
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  './AdminAccessProvider': provider,
}).default
const mocks = {
  'next/navigation': navigation,
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  '@/lib/server-auth': auth,
  '@/app/components/AdminAccessProvider': provider.default,
  '@/app/components/AdminLayout': Sidebar,
  '@/lib/db': { db: { select: () => { throw new Error('Unauthorized dashboard query') } } },
  '@/lib/schema': {},
}
const Dashboard = load('app/admin/page.tsx', mocks).default
const Layout = load('app/admin/layout.tsx', mocks).default

await assert.rejects(Dashboard(), /redirect:\/dashboard/)
await assert.rejects(Layout({ children: null }), /redirect:\/dashboard/)

// Every module outside the action queues must still admit users to /admin.
const queueModules = ['users', 'registration-overrides', 'scholarships', 'class-requests']
for (const module of ADMIN_MODULES.filter(item => !queueModules.includes(item.key))) {
  modules = new Set([module.key])
  const html = renderToStaticMarkup(await Layout({ children: await Dashboard() }))
  assert.ok(html.includes(module.label), `${module.key} should appear in navigation`)
  assert.ok(html.includes('Select a module from the navigation'))
  assert.ok(!html.includes('href="/admin/users"'))
  assert.ok(!html.includes('Account Activations'))
  for (const other of ADMIN_MODULES.filter(item => item.key !== module.key && item.key !== 'class-requests')) {
    assert.ok(!html.includes(`href="/admin/${other.key}"`), `${other.key} must be hidden from ${module.key}`)
  }
  await auth.requireAdminAccess(module.key)
  await assert.rejects(auth.requireAdminAccess('users'), /redirect:\/dashboard/)
}

modules = new Set(['events', 'reports'])
assert.deepEqual(Array.from((await auth.getAdminPageAccess()).modules), ['events', 'reports'])
for (const privilegedRole of ['admin', 'moderator']) {
  role = privilegedRole
  assert.equal((await auth.getAdminPageAccess()).modules.length, ADMIN_MODULES.length)
  await auth.requireAdminAccess('users')
}
console.log('Admin entry, delegated module guards, and initial sidebar visibility checks passed.')

// Test the actual session-list route used by Registrations, including its write boundary.
role = 'user'
const sessionRows = [{ id: 'session-1', name: 'Fall', isActive: true }]
let reads = 0
let writes = 0
const apiMocks = {
  '@/lib/server-auth': auth,
  '@/lib/schema': { sessions: {}, volunteerAssignments: {} },
  '@/lib/database': { getGuardianById: async () => ({ familyId: 'family-1' }) },
  '@/lib/registration-events': { publishRegistrationUpdate: () => {} },
  '@/lib/db': { db: {
    select: () => ({ from: async () => { reads++; return sessionRows } }),
    insert: () => ({ values: value => ({ returning: async () => { writes++; return [value] } }) }),
  } },
}
const sessionsApi = load('app/api/admin/sessions/route.ts', apiMocks)
const assignmentsApi = load('app/api/admin/volunteer-assignments/route.ts', apiMocks)
const request = body => new Request('http://localhost/api/admin/test', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
for (const module of ['registrations', 'reports', 'registration-overrides', 'payments', 'events', 'class-requests', 'users', 'sessions']) {
  modules = new Set([module])
  const response = await sessionsApi.GET()
  assert.equal(response.status, 200, `${module} can load the session picker`)
  assert.deepEqual((await response.json()).sessions, sessionRows)
  const create = await sessionsApi.POST(request({}))
  assert.equal(create.status, module === 'sessions' ? 400 : 403, `${module} session-write boundary`)
}

modules = new Set(['registrations'])
const assignment = { sessionId: 'session-1', guardianId: 'guardian-1', volunteerType: 'volunteer_job', volunteerJobId: 'job-1', period: 'first' }
assert.equal((await assignmentsApi.POST(request(assignment))).status, 200)
assert.equal(writes, 1, 'Delegated registration staff can create volunteer assignments')
modules = new Set(['events'])
assert.equal((await assignmentsApi.POST(request(assignment))).status, 403)
assert.equal(writes, 1, 'Unrelated module access cannot write assignments')

for (const assigned of [[], ['faqs'], ['newsletters']]) {
  modules = new Set(assigned)
  const previousReads = reads
  assert.equal((await sessionsApi.GET()).status, 403)
  assert.equal(reads, previousReads, 'Denied requests must not read session data')
}

modules = new Set(['registrations'])
assert.equal((await auth.getAuthenticatedAdmin('settings')).status, 403)
assert.equal((await auth.getAuthenticatedAdmin('users')).status, 403)
assert.equal((await auth.getAuthenticatedAdmin('groups')).status, 403)
assert.equal((await auth.getAuthenticatedAdmin()).status, 403)
signedIn = false
assert.equal((await sessionsApi.GET()).status, 401)
assert.equal((await assignmentsApi.POST(request(assignment))).status, 401)
signedIn = true
role = 'admin'
modules = new Set()
assert.equal((await sessionsApi.GET()).status, 200)
assert.ok(!('error' in await auth.getAuthenticatedAdmin()))
console.log('Delegated session lookup, registration writes, unrelated-module denials, and unauthenticated API checks passed.')

// Supporting lookup routes expose only the fields their consuming modules need.
const lookupSchema = {
  users: { id: 'id', firstName: 'firstName', lastName: 'lastName', email: 'email' },
  userGroups: { id: 'id', name: 'name', slug: 'slug', isSystem: 'isSystem' },
  userGroupMemberships: { groupId: 'groupId', userId: 'userId' },
}
const lookupRows = new Map([
  [lookupSchema.users, [{ id: 'user-1', firstName: 'A', lastName: 'Parent', email: 'parent@example.com', privateNotes: 'not for messaging' }]],
  [lookupSchema.userGroups, [{ id: 'group-1', name: 'Family', slug: 'family', isSystem: true, accessControls: '{"settings":true}' }]],
  [lookupSchema.userGroupMemberships, [{ groupId: 'group-1', userId: 'user-1' }]],
])
const lookupMocks = {
  '@/lib/server-auth': auth,
  '@/lib/schema': lookupSchema,
  '@/lib/db': { db: { select: fields => ({ from: table => {
    const result = lookupRows.get(table).map(row => Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column]])))
    return Object.assign(Promise.resolve(result), { orderBy: async () => result })
  } }) } },
}
const groupOptions = load('app/api/admin/groups/options/route.ts', lookupMocks)
const recipients = load('app/api/admin/messaging/recipients/route.ts', lookupMocks)
role = 'user'
modules = new Set(['sessions'])
const optionsResponse = await groupOptions.GET()
assert.equal(optionsResponse.status, 200)
assert.deepEqual(await optionsResponse.json(), { groups: [{ id: 'group-1', name: 'Family', slug: 'family' }] })
assert.equal((await recipients.GET()).status, 403)
modules = new Set(['newsletters'])
const recipientsResponse = await recipients.GET()
assert.equal(recipientsResponse.status, 200)
assert.deepEqual(await recipientsResponse.json(), {
  users: [{ id: 'user-1', firstName: 'A', lastName: 'Parent', email: 'parent@example.com' }],
  groups: [{ id: 'group-1', name: 'Family', isSystem: true, members: [{ id: 'user-1' }] }],
})
assert.equal((await auth.getAuthenticatedAdmin('users')).status, 403)
assert.equal((await auth.getAuthenticatedAdmin('groups')).status, 403)
modules = new Set(['registrations'])
assert.equal((await recipients.GET()).status, 403)
assert.equal((await groupOptions.GET()).status, 403)
console.log('Messaging recipient and registration-group lookup scope checks passed.')
