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
    module, exports: module.exports, console,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  }, { filename: path })
  return module.exports
}

const { ADMIN_MODULES } = load('lib/admin-access.ts')
let role = 'user'
let modules = new Set()
const session = { user: { id: 'delegated-user', firstName: 'Test', email: 'test@example.com' } }
const navigation = { redirect: path => { throw new Error(`redirect:${path}`) }, useRouter: () => ({}) }
const auth = load('lib/server-auth.ts', {
  'next/navigation': navigation,
  './database': { getUserById: async () => ({ role }) },
  '@/lib/auth-server': { getCurrentAuthSession: async () => session },
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
