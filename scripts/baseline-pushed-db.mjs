import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

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
const latestCreatedAt = Number(latest.rows[0]?.created_at || 0)
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
}

client.close()
