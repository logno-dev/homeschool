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
import { eq } from 'drizzle-orm'

const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, {
    module, exports: module.exports, console,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  }, { filename: path })
  return module.exports
}

// Use an isolated SQLite database; never load the application's database credentials.
// File-backed SQLite survives the driver's connection changes across transactions.
const directory = mkdtempSync(join(tmpdir(), 'dvclc-family-group-'))
const client = createClient({ url: pathToFileURL(join(directory, 'test.db')).href })
const schema = load('lib/schema.ts')
const db = drizzle(client, { schema })
try {
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', activation_status TEXT NOT NULL DEFAULT 'active',
      family_id TEXT, date_of_birth TEXT, grade TEXT, emergency_contact TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE user_groups (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      is_system INTEGER NOT NULL DEFAULT 0, access_controls TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE user_group_memberships (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      group_id TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, group_id)
    );
  `)
  const groups = load('lib/user-groups.ts', {
    'server-only': {}, '@/lib/db': { db }, '@/lib/schema': schema,
    '@/lib/app-time': {}, '@/lib/admin-access': load('lib/admin-access.ts'),
  })
  const { createUser } = load('lib/database.ts', {
    './db': { db, client }, './schema': schema, './grades': {}, './user-groups': groups, './app-time': {},
  })
  const newUser = id => ({ id, email: `${id}@example.com`, firstName: 'New', lastName: 'User', role: 'user', activationStatus: 'pending' })

  await db.insert(schema.userGroups).values({ id: 'existing-family-group', name: 'Family', slug: 'family', isSystem: true, accessControls: '{"reports":true}' })
  await createUser(newUser('user-1'))
  const memberships = await db.select().from(schema.userGroupMemberships)
  assert.equal(memberships.length, 1)
  assert.equal(memberships[0].groupId, 'existing-family-group')
  assert.equal(memberships[0].userId, 'user-1')
  await groups.ensureFamilyGroupMembership('user-1')
  assert.equal((await db.select().from(schema.userGroupMemberships)).length, 1, 'Assignment is idempotent')
  assert.equal((await db.select().from(schema.userGroups))[0].accessControls, '{"reports":true}', 'Existing group configuration is preserved')

  await db.delete(schema.userGroups)
  await createUser(newUser('user-2'))
  const [familyGroup] = await db.select().from(schema.userGroups)
  assert.equal(familyGroup.slug, 'family')
  assert.equal(familyGroup.isSystem, true)
  assert.equal((await db.select().from(schema.userGroupMemberships))[0].userId, 'user-2')

  await client.execute(`CREATE TRIGGER reject_membership BEFORE INSERT ON user_group_memberships BEGIN SELECT RAISE(ABORT, 'membership failure'); END`)
  await assert.rejects(createUser(newUser('user-3')))
  assert.equal((await db.select().from(schema.users).where(eq(schema.users.id, 'user-3'))).length, 0, 'Failed membership assignment rolls back user creation')
  console.log('Family assignment, group initialization/reuse, idempotency, and transaction rollback checks passed.')
} finally {
  client.close()
  rmSync(directory, { recursive: true, force: true })
}
