import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
// Newer Node versions can hide CJS-to-ESM loading failures that crash the
// externalized sanitizer in production. Exercise the stricter loader too.
execFileSync(process.execPath, [
  ...(process.allowedNodeEnvironmentFlags.has('--no-experimental-require-module') ? ['--no-experimental-require-module'] : []),
  '-e', 'const assert = require("node:assert/strict"); const sanitize = require("sanitize-html"); assert.equal(sanitize("<p><strong>Event</strong></p><script>bad()</script>"), "<p><strong>Event</strong></p>");',
], { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'pipe' })
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, console, URL, File, Uint8Array, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) })
  return module.exports
}
const calendar = load('lib/calendar.ts')
const content = load('lib/event-content.ts', { 'server-only': {}, './calendar': calendar })
const images = load('lib/event-images.ts')
const base = { id: 'one', title: 'Meetup', startDate: '2026-09-10', endDate: null, startTime: '13:00', endTime: '14:00', isAllDay: false, eventType: 'general', color: '#3b82f6', isPublic: true, createdBy: 'editor' }
const spanning = { ...base, id: 'spanning', startDate: '2026-09-09', endDate: '2026-09-11', isAllDay: true }
assert.equal(calendar.isCalendarDate('2026-02-30'), false)
assert.equal(calendar.isCalendarDate('2028-02-29'), true)
assert.equal(calendar.calendarDayHref([base], '2026-09-10'), '/events/one')
assert.equal(calendar.calendarDayHref([base, spanning], '2026-09-10'), '/calendar/2026-09-10')
assert.equal(calendar.calendarDayHref([base], '2026-09-11'), '/calendar/2026-09-11')
assert.equal(calendar.eventsForDay([spanning], '2026-09-11').length, 1)
assert.equal(calendar.eventsForDay([spanning], '2026-09-12').length, 0)
assert.equal(calendar.upcomingEventGroups([base, spanning, { ...base, id: 'past', startDate: '2025-01-01' }], '2026-09-10')[0].events.length, 2)
assert.equal(calendar.formatEventTime(base), '1:00 PM – 2:00 PM')
assert.equal(calendar.formatCalendarDate('2026-09-10'), 'September 10, 2026')
assert.equal(calendar.sortCalendarEvents([base, { ...base, id: 'all-day', isAllDay: true }])[0].id, 'all-day')
assert.match(content.sanitizeEventDescription('Bring lunch\nMeet at A & B'), /Bring lunch<br \/>Meet at A &amp; B/)
assert.equal(content.sanitizeEventDescription('<p>Wrap&nbsp;these&#160;words&#xA0;naturally\u00a0please</p>'), '<p>Wrap these words naturally please</p>')
const safe = content.sanitizeEventDescription('<h2>Welcome</h2><p><strong>Bring lunch</strong></p><ol><li data-list="bullet"><span class="ql-ui"></span>Water</li></ol><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">Bad</a><a href="https://example.com" target="_blank">Map</a>')
assert.match(safe, /<strong>Bring lunch<\/strong>/)
assert.match(safe, /data-list="bullet"/)
assert.match(safe, /noopener noreferrer/)
assert.ok(!/script|onerror|<img|javascript:/.test(safe))
assert.throws(() => content.validateEventDates('2026-09-10', '2026-09-09', '', '', true))
assert.throws(() => content.validateEventBannerUrl('https://example.com/events/banner.png'))
const banner = 'https://test.public.blob.vercel-storage.com/events/banner.png'
assert.equal(content.validateEventBannerUrl(banner), banner)

const schema = load('lib/schema.ts')
const client = createClient({ url: ':memory:' })
const db = drizzle(client, { schema })
let authorized = true
const auth = { getAuthenticatedAdmin: async () => authorized ? { session: { user: { id: 'editor' } } } : { error: 'Forbidden', status: 403 } }
try {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.events, schema.guardians, schema.sessions, schema.sessionRegistrationWindows, schema.userGroups]) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.filter(column => column.name !== 'banner_url').map(column => {
      let sql = `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}`
      if (column.default !== undefined) {
        const value = column.default
        sql += ` DEFAULT ${typeof value === 'object' ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : Number(value)}`
      }
      return sql
    })
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(', ')})`)
  }
  await client.execute("INSERT INTO events (id, title, start_date, created_by) VALUES ('legacy', 'Legacy event', '2026-09-09', 'editor')")
  await client.executeMultiple(readFileSync(new URL('../drizzle/0051_event_banners.sql', import.meta.url), 'utf8'))
  assert.equal((await db.select().from(schema.events))[0].bannerUrl, null)
  const mocks = { '@/lib/db': { db, client }, '@/lib/schema': schema, '@/lib/server-auth': auth, '@/lib/event-content': content }
  const collection = load('app/api/admin/events/route.ts', mocks)
  const item = load('app/api/admin/events/[eventId]/route.ts', mocks)
  const request = body => new Request('http://localhost/test', { method: 'POST', body: JSON.stringify(body) })
  const body = { ...base, description: '<p><strong>Welcome</strong> to the event.</p><script>bad()</script>', bannerUrl: banner }
  let response = await collection.POST(request(body))
  assert.equal(response.status, 201)
  const saved = await response.json()
  assert.equal(saved.bannerUrl, banner)
  assert.ok(saved.description.includes('<strong>Welcome</strong>'))
  assert.ok(!saved.description.includes('script'))
  const params = { params: Promise.resolve({ eventId: saved.id }) }
  response = await item.PUT(request({ ...body, bannerUrl: '' }), params)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).bannerUrl, null)
  assert.equal((await collection.POST(request({ ...body, startDate: '2026-02-30' }))).status, 400)
  authorized = false
  assert.equal((await collection.POST(request(body))).status, 403)
  assert.equal((await item.PUT(request(body), params)).status, 403)
  authorized = true

  await db.insert(schema.events).values({ ...base, id: 'private', title: 'Private event', isPublic: false })
  await db.insert(schema.sessions).values({ id: 'session', name: 'Fall', startDate: '2026-10-01', endDate: '2026-12-01', registrationStartDate: '2026-09-01', registrationEndDate: '2026-09-30' })
  await db.insert(schema.userGroups).values([{ id: 'family', name: 'Family', slug: 'family' }, { id: 'other', name: 'Other', slug: 'other' }])
  await db.insert(schema.sessionRegistrationWindows).values([
    { id: 'eligible', sessionId: 'session', groupId: 'family', startDate: '2026-09-10T08:30', endDate: '2026-09-20' },
    { id: 'hidden', sessionId: 'session', groupId: 'other', startDate: '2026-09-10', endDate: '2026-09-20' },
  ])
  const appTime = load('lib/app-time.ts', { 'server-only': {}, '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/timezones': {} })
  const events = load('lib/events.ts', {
    ...mocks, '@/lib/app-time': { ...appTime, getAppTimezone: async () => 'America/Los_Angeles' },
    '@/lib/user-groups': { getFamilyRegistrationGroups: async () => [{ group: { id: 'family' } }] },
  })
  assert.equal(await events.getCalendarEventById('private', 'viewer'), null)
  assert.equal((await events.getCalendarEventById('private', 'editor', true)).id, 'private')
  assert.equal(await events.getCalendarEventById('registration-open-hidden', 'viewer'), null)
  assert.equal(await events.getCalendarEventById('missing', 'viewer'), null)
  const registrationEvent = await events.getCalendarEventById('registration-open-eligible', 'viewer')
  assert.equal(registrationEvent.startDate, '2026-09-10')
  assert.equal(registrationEvent.startTime, '08:30')
  assert.equal(registrationEvent.isAllDay, false)
  assert.equal((await events.getCalendarEventById('session-start-session', 'viewer')).eventType, 'session')

  const link = ({ children, ...props }) => React.createElement('a', props, children)
  const eventCard = load('app/components/EventCard.tsx', { 'next/link': link, '@/lib/calendar': calendar }).default
  const pageMocks = {
    'next/link': link, 'next/navigation': { notFound: () => { throw new Error('NOT_FOUND') } },
    '@/lib/server-auth': { ...auth, getAuthenticatedUser: async () => ({ user: { id: 'viewer' } }) },
    '@/lib/events': events, '@/lib/calendar': calendar, '@/lib/event-content': content, '@/app/components/EventCard': eventCard,
  }
  const dayPage = load('app/calendar/[date]/page.tsx', pageMocks).default
  const detailsPage = load('app/events/[eventId]/page.tsx', pageMocks).default
  const dayHtml = renderToStaticMarkup(await dayPage({ params: Promise.resolve({ date: '2026-09-10' }) }))
  assert.ok(dayHtml.includes(`/events/${saved.id}`))
  assert.ok(dayHtml.includes('/events/registration-open-eligible'))
  assert.ok(!dayHtml.includes('/events/private'))
  await assert.rejects(dayPage({ params: Promise.resolve({ date: '2026-02-30' }) }), /NOT_FOUND/)
  const detailsHtml = renderToStaticMarkup(await detailsPage({ params: Promise.resolve({ eventId: saved.id }) }))
  assert.ok(detailsHtml.includes('<strong>Welcome</strong>'))
  assert.ok(detailsHtml.includes('/calendar/2026-09-10'))
  authorized = false
  await assert.rejects(detailsPage({ params: Promise.resolve({ eventId: 'private' }) }), /NOT_FOUND/)
  authorized = true
} finally { client.close() }

let uploads = 0
const upload = load('app/api/admin/events/banner/route.ts', {
  '@/lib/server-auth': auth, '@/lib/event-images': images,
  '@vercel/blob': { put: async (path, file, options) => { uploads++; assert.ok(path.startsWith('events/')); assert.equal(options.access, 'public'); return { url: banner } } },
}).POST
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvXYAAAAASUVORK5CYII=', 'base64')
const fileRequest = (bytes, type) => {
  const data = new FormData()
  data.append('file', new File([bytes], 'banner.png', { type }))
  return new Request('http://localhost/upload', { method: 'POST', body: data })
}
assert.equal((await upload(fileRequest(png, 'image/png'))).status, 201)
assert.equal((await upload(fileRequest('<svg></svg>', 'image/svg+xml'))).status, 400)
assert.equal((await upload(fileRequest('not an image', 'image/png'))).status, 400)
assert.equal((await upload(fileRequest(new Uint8Array(images.MAX_EVENT_IMAGE_SIZE + 1), 'image/png'))).status, 400)
authorized = false
assert.equal((await upload(fileRequest(png, 'image/png'))).status, 403)
assert.equal(uploads, 1)
console.log('Event migration/CRUD, rich-text sanitization, banner validation, day routing, timeline grouping, and event visibility checks passed.')
