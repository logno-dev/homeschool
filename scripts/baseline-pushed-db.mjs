import dotenv from 'dotenv'
import { createClient } from '@libsql/client'
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

dotenv.config({ path: '.env.local' })

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
})

const expectedTables = [
  'children',
  'families',
  'users',
  'auth_accounts',
  'user_groups',
  'user_group_memberships',
  'faqs'
]

const result = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
const existingTables = new Set(result.rows.map((row) => String(row.name)))
const missingTables = expectedTables.filter((table) => !existingTables.has(table))

if (missingTables.length) {
  throw new Error(`Refusing to baseline: expected tables are missing: ${missingTables.join(', ')}`)
}

await client.execute(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash text NOT NULL,
    created_at numeric
  )
`)

const latest = await client.execute('SELECT MAX(created_at) AS created_at FROM __drizzle_migrations')
let latestCreatedAt = Number(latest.rows[0]?.created_at || 0)
const lastPreNewsletterMigration = 1787961600000

if (latestCreatedAt >= lastPreNewsletterMigration) {
  console.log('Migration history already reaches the user-group migration; nothing to baseline.')
} else if (latestCreatedAt > 0) {
  throw new Error(`Refusing to baseline: migration history already exists through ${latestCreatedAt}.`)
} else {
  await client.execute({
    sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    args: ['baseline-push-created-schema', lastPreNewsletterMigration]
  })
  console.log('Baselined the existing push-created schema through migration 0036.')
  latestCreatedAt = lastPreNewsletterMigration
}

const migration0058 = 1790560933000
if (latestCreatedAt < migration0058) {
  console.log('Run migrations through 0058 before checking newer push-created schema.')
  client.close()
  process.exit(0)
}

async function hasTable(name) {
  const result = await client.execute({ sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", args: [name] })
  return result.rows.length > 0
}

async function hasColumn(table, column) {
  const result = await client.execute(`PRAGMA table_info(${table})`)
  return result.rows.some((row) => String(row.name) === column)
}

async function recordMigration(filename, createdAt) {
  if (latestCreatedAt >= createdAt) return
  const contents = await readFile(new URL(`../drizzle/${filename}`, import.meta.url), 'utf8')
  const hash = createHash('sha256').update(contents).digest('hex')
  await client.execute({ sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)', args: [hash, createdAt] })
  latestCreatedAt = createdAt
  console.log(`Baselined push-created migration ${filename.replace('.sql', '')}.`)
}

if (await hasTable('family_class_charges') && await hasTable('class_fee_refunds')) {
  await client.batch([
    'CREATE INDEX IF NOT EXISTS idx_class_charges_family_session ON family_class_charges (family_id, session_id)',
    'CREATE INDEX IF NOT EXISTS idx_class_charges_class ON family_class_charges (class_teaching_request_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_class_refund_reference ON class_fee_refunds (method, reference) WHERE reference IS NOT NULL'
  ])
}

if (await hasTable('class_categories')) {
  await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS class_categories_name_idx ON class_categories (name)')
}

if (latestCreatedAt < 1791072000000 && await hasTable('family_class_charges') && await hasTable('class_fee_refunds')) {
  await recordMigration('0059_class_fee_refunds.sql', 1791072000000)
}

if (latestCreatedAt === 1791072000000 && await hasColumn('fee_payments', 'billing_snapshot') && await hasColumn('family_class_charges', 'billing_treatment')) {
  await recordMigration('0060_payment_billing_snapshots.sql', 1791158400000)
}

if (latestCreatedAt === 1791158400000 && await hasTable('class_categories') && await hasColumn('class_teaching_requests', 'category_id') && await hasColumn('class_teaching_requests', 'preferred_period')) {
  await recordMigration('0061_class_teaching_slots_categories.sql', 1791763200000)
}

if (latestCreatedAt === 1791763200000 && await hasColumn('sessions', 'class_teaching_access_mode') && await hasColumn('sessions', 'class_teaching_allowed_group_ids')) {
  await recordMigration('0062_class_teaching_access.sql', 1791849600000)
}

client.close()
