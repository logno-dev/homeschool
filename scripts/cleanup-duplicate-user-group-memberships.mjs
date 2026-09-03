import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

dotenv.config({ path: '.env.local' })

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
})

const duplicates = await client.execute(`
  SELECT user_id, group_id, COUNT(*) AS count
  FROM user_group_memberships
  GROUP BY user_id, group_id
  HAVING COUNT(*) > 1
`)

let removed = 0
for (const duplicate of duplicates.rows) {
  const memberships = await client.execute({
    sql: `SELECT id FROM user_group_memberships WHERE user_id = ? AND group_id = ? ORDER BY created_at, id`,
    args: [duplicate.user_id, duplicate.group_id]
  })
  for (const membership of memberships.rows.slice(1)) {
    await client.execute({ sql: 'DELETE FROM user_group_memberships WHERE id = ?', args: [membership.id] })
    removed += 1
  }
}

await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS user_group_memberships_user_group_idx ON user_group_memberships(user_id, group_id)')
console.log(`Removed ${removed} duplicate user-group memberships.`)
