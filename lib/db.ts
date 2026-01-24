import { drizzle } from 'drizzle-orm/libsql'
import 'server-only'
import { createClient } from '@libsql/client'
import * as schema from './schema'

export const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
})

export const db = drizzle(client, { schema })

let databaseAvailable: boolean | null = null

export async function hasDatabaseConnection(): Promise<boolean> {
  if (databaseAvailable !== null) {
    return databaseAvailable
  }

  try {
    await client.execute('SELECT 1')
    databaseAvailable = true
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error checking database connection:', error)
    }
    databaseAvailable = false
  }

  return databaseAvailable
}
