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

const require = createRequire(import.meta.url)
function load(path, mocks = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, console, Request, Response, URL, Blob, FormData, fetch, process, setTimeout, ...globals, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) })
  return module.exports
}

const directory = mkdtempSync(join(tmpdir(), 'dvclc-newsletter-broadcasts-'))
const client = createClient({ url: pathToFileURL(join(directory, 'test.db')).href })
const schema = load('lib/schema.ts')
const db = drizzle(client, { schema })
try {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.users, schema.authAccounts, schema.userGroups, schema.userGroupMemberships, schema.newsletters, schema.newsletterGroups, schema.newsletterRecipients, schema.globalSettings]) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.map(column => {
      let sql = `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}`
      if (column.default !== undefined) {
        const value = column.default
        sql += ` DEFAULT ${typeof value === 'object' ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : Number(value)}`
      }
      return sql
    })
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(', ')})`)
  }

  await db.insert(schema.userGroups).values({ id: 'group', name: 'Families', slug: 'families' })
  for (const [id, email] of [['user-a', 'shared@example.com'], ['user-b', 'shared@example.com'], ['user-c', 'unique@example.com']]) {
    await db.insert(schema.users).values({ id, email, firstName: id, lastName: 'Test' })
    if (id !== 'user-b') await db.insert(schema.authAccounts).values({ id: `auth-${id}`, userId: id, email, passwordHash: 'test', isActive: true })
    await db.insert(schema.userGroupMemberships).values({ id: `membership-${id}`, userId: id, groupId: 'group' })
  }

  const newsletterHelpers = load('lib/newsletters.ts', { 'server-only': {}, '@/lib/db': { db }, '@/lib/schema': schema })
  const emailContent = load('lib/email-content.ts')
  assert.equal(emailContent.normalizeEmailSpacing('One&nbsp;two&#160;three&#xA0;four\u00a0five'), 'One two three four five')
  const recipients = await newsletterHelpers.resolveNewsletterRecipients(['group'], true)
  assert.equal(recipients.map(recipient => recipient.email).join(','), 'shared@example.com,unique@example.com', 'Broadcast contacts are deduplicated by email')

  const createNewsletter = load('app/api/admin/newsletters/route.ts', {
    '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/newsletters': newsletterHelpers, '@/lib/email-content': emailContent,
    '@/lib/newsletter-broadcasts': { processNewsletterCampaign: async () => 'pending' },
    '@/lib/server-auth': { getAuthenticatedAdmin: async () => ({ session: { user: { id: 'user-a' } } }) }
  }).POST
  const createResponse = await createNewsletter(new Request('http://localhost/api/admin/newsletters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: 'New scheduled message', html: '<p>News</p>', text: 'News', status: 'scheduled', scheduledAt: new Date(Date.now() + 7_200_000).toISOString(), groupIds: ['group'], includeInactive: true }) }))
  assert.equal(createResponse.status, 201)
  const createdNewsletter = (await createResponse.json()).newsletter
  assert.equal(createdNewsletter.status, 'scheduled', 'A newly created message can be scheduled directly')
  assert.equal(createdNewsletter.totalRecipients, 2)
  await db.delete(schema.newsletterRecipients).where(eq(schema.newsletterRecipients.newsletterId, createdNewsletter.id))
  await db.delete(schema.newsletterGroups).where(eq(schema.newsletterGroups.newsletterId, createdNewsletter.id))
  await db.delete(schema.newsletters).where(eq(schema.newsletters.id, createdNewsletter.id))

  await db.insert(schema.globalSettings).values({ key: 'email_sender_aliases', value: '["news"]' })
  const calls = []
  const providerFetch = async (url, init) => {
    calls.push({ url, init })
    if (url.endsWith('/segments')) return Response.json({ id: 'segment-id' })
    if (url.endsWith('/contacts/imports')) return Response.json({ id: 'import-id' })
    if (url.endsWith('/broadcasts')) return Response.json({ id: 'broadcast-id' })
    if (url.endsWith('/emails')) return Response.json({ id: 'email-id' })
    throw new Error(`Unexpected provider call: ${url}`)
  }
  const email = load('lib/email.ts', {
    '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/database': { getGlobalSetting: async () => null }, '@/lib/email-types': {}, '@/lib/email-content': emailContent, '@/lib/fee-pdf': { createFeePdf: () => new Uint8Array() }, '@vercel/blob': { put: async () => ({}) }
  }, { fetch: providerFetch, process: { env: { RESEND_API_KEY: 'test-key', RESEND_EMAIL_DOMAIN: 'example.com' } } })
  assert.equal(await email.createNewsletterSegment('newsletter', 'Test campaign'), 'segment-id')
  assert.equal(await email.createNewsletterContactImport('newsletter', 'segment-id', recipients), 'import-id')
  assert.equal(await email.createNewsletterBroadcast({ newsletterId: 'newsletter', segmentId: 'segment-id', subject: 'Subject', html: '<p><span style="color:#e60000;background-color:#ffff00">Hello&nbsp;world</span></p>', text: 'Hello\u00a0world', scheduledAt: null }), 'broadcast-id')
  const importBody = calls[1].init.body
  assert.equal(importBody.get('on_conflict'), 'upsert')
  assert.equal(importBody.get('segments'), '[{"id":"segment-id"}]')
  const broadcastBody = JSON.parse(calls[2].init.body)
  assert.equal(broadcastBody.segment_id, 'segment-id')
  assert.equal(broadcastBody.send, true)
  assert.match(broadcastBody.html, /RESEND_UNSUBSCRIBE_URL/)
  assert.match(broadcastBody.html, /color:#e60000/)
  assert.match(broadcastBody.html, /background-color:#ffff00/)
  assert.ok(!/nbsp|\u00a0/.test(broadcastBody.html))
  await email.sendIndividualEmail({ to: 'person@example.com', subject: 'Individual', html: '<p>Wrap&nbsp;normally</p>', text: 'Wrap\u00a0normally' })
  const individualBody = JSON.parse(calls[3].init.body)
  assert.equal(individualBody.html, '<p>Wrap normally</p>')
  assert.equal(individualBody.text, 'Wrap normally')
  await email.sendScholarshipRequestNotificationEmail({ recipients: ['admin@example.com'], applicantName: 'Alex Rivera', email: 'alex@example.com', sessionName: 'Fall', scholarshipType: 'Partial', requestedAmount: 60, reason: 'Financial need', additionalInfo: 'Please review' })
  const scholarshipBody = JSON.parse(calls[4].init.body)
  assert.deepEqual(scholarshipBody.to, ['admin@example.com'])
  assert.match(scholarshipBody.subject, /scholarship request/i)
  assert.match(scholarshipBody.html, /Alex Rivera/)
  assert.match(scholarshipBody.html, /\$60\.00/)
  assert.ok(!calls.some(call => call.url.includes('/emails/batch')))

  const scheduledAt = new Date(Date.now() + 3_600_000).toISOString()
  await db.insert(schema.newsletters).values({ id: 'campaign', subject: 'Campaign', html: '<p>News</p>', text: 'News', createdBy: 'user-a', status: 'scheduled', scheduledAt, totalRecipients: 2 })
  await db.insert(schema.newsletterRecipients).values(recipients.map((recipient, index) => ({ id: `recipient-${index}`, newsletterId: 'campaign', ...recipient })))
  let importStatus = 'processing'
  let importChecks = 0
  let completeAfterChecks = Number.POSITIVE_INFINITY
  let broadcastMetrics = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0, suppressed: 0 }
  const cronEmail = {
    createNewsletterSegment: async () => 'segment-id',
    createNewsletterContactImport: async () => 'import-id',
    getNewsletterContactImport: async () => {
      importChecks += 1
      return { status: importChecks >= completeAfterChecks ? 'completed' : importStatus, counts: { total: 2, created: 2, updated: 0, skipped: 0, failed: 0 } }
    },
    createNewsletterBroadcast: async () => 'broadcast-id',
    getNewsletterBroadcast: async () => ({ status: 'sent', sent_at: new Date().toISOString() }),
    getNewsletterBroadcastMetrics: async () => broadcastMetrics
  }
  const campaignProcessor = load('lib/newsletter-broadcasts.ts', { '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/email': cronEmail })
  const cron = load('app/api/cron/newsletters/route.ts', { '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/newsletter-broadcasts': campaignProcessor }).GET
  const cronRequest = new Request('http://localhost/api/cron/newsletters', { headers: { Authorization: 'Bearer secret' } })
  const originalSecret = process.env.CRON_SECRET
  process.env.CRON_SECRET = 'secret'
  assert.equal((await cron(cronRequest)).status, 200)
  let [campaign] = await db.select().from(schema.newsletters).where(eq(schema.newsletters.id, 'campaign'))
  assert.equal(campaign.status, 'processing')
  assert.equal(campaign.resendSegmentId, 'segment-id')
  assert.equal(campaign.resendContactImportId, 'import-id')
  importStatus = 'completed'
  await cron(cronRequest)
  ;[campaign] = await db.select().from(schema.newsletters).where(eq(schema.newsletters.id, 'campaign'))
  assert.equal(campaign.status, 'provider_scheduled')
  assert.equal(campaign.resendBroadcastId, 'broadcast-id')
  await cron(cronRequest)
  ;[campaign] = await db.select().from(schema.newsletters).where(eq(schema.newsletters.id, 'campaign'))
  assert.equal(campaign.status, 'sent')
  assert.equal((await db.select().from(schema.newsletterRecipients)).filter(row => row.status === 'sent').length, 2)
  await db.update(schema.newsletters).set({ sentAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() }).where(eq(schema.newsletters.id, 'campaign'))
  const newsletterDetails = load('app/api/admin/newsletters/[newsletterId]/route.ts', {
    '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/newsletters': newsletterHelpers, '@/lib/email': cronEmail, '@/lib/email-content': emailContent,
    '@/lib/newsletter-broadcasts': campaignProcessor,
    '@/lib/server-auth': { getAuthenticatedAdmin: async () => ({ session: { user: { id: 'user-a' } } }) }
  }).GET
  const detailsResponse = await newsletterDetails(new Request('http://localhost/api/admin/newsletters/campaign?refresh=1'), { params: Promise.resolve({ newsletterId: 'campaign' }) })
  assert.equal(detailsResponse.status, 200)
  let campaignDetails = (await detailsResponse.json()).newsletter
  assert.equal(campaignDetails.totalSent, 2, 'A temporarily empty metrics response does not erase the accepted send count')
  broadcastMetrics = { sent: 2, delivered: 2, opened: 1, clicked: 1, bounced: 0, complained: 0, unsubscribed: 0, suppressed: 0 }
  const refreshedDetailsResponse = await newsletterDetails(new Request('http://localhost/api/admin/newsletters/campaign?refresh=1'), { params: Promise.resolve({ newsletterId: 'campaign' }) })
  campaignDetails = (await refreshedDetailsResponse.json()).newsletter
  assert.equal(campaignDetails.deliveredCount, 2)
  assert.equal(campaignDetails.openedCount, 1)
  assert.equal(campaignDetails.clickedCount, 1)
  assert.ok(campaignDetails.metricsUpdatedAt)

  const sendNow = load('app/api/admin/newsletters/route.ts', {
    '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/newsletters': newsletterHelpers, '@/lib/email-content': emailContent,
    '@/lib/newsletter-broadcasts': campaignProcessor,
    '@/lib/server-auth': { getAuthenticatedAdmin: async () => ({ session: { user: { id: 'user-a' } } }) }
  }).POST
  importStatus = 'processing'
  importChecks = 0
  completeAfterChecks = 3
  const sendNowResponse = await sendNow(new Request('http://localhost/api/admin/newsletters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: 'Immediate message', html: '<p>Now</p>', text: 'Now', status: 'send_now', groupIds: ['group'], includeInactive: true }) }))
  assert.equal(sendNowResponse.status, 201)
  const immediateNewsletter = (await sendNowResponse.json()).newsletter
  assert.equal(immediateNewsletter.status, 'sent')
  assert.equal(immediateNewsletter.scheduledAt, null)
  assert.equal(immediateNewsletter.totalSent, 2)
  assert.equal(importChecks, 3, 'Send now waits for the asynchronous contact import before creating the Broadcast')
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
  console.log('Recipient deduplication, contact import, unsubscribe content, Broadcast creation, Send now, sent history, delivery metrics, and status reconciliation verified.')
} finally {
  client.close()
  rmSync(directory, { recursive: true, force: true })
}
