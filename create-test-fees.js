const { drizzle } = require('drizzle-orm/better-sqlite3')
const Database = require('better-sqlite3')
const { familySessionFees, sessionFeeConfigs, sessions, families } = require('./lib/schema')
const { randomUUID } = require('crypto')

const sqlite = new Database('./database.db')
const db = drizzle(sqlite)

async function createTestFees() {
  try {
    console.log('Creating test fee data...')

    // Get the first family and session
    const family = await db.select().from(families).limit(1)
    const session = await db.select().from(sessions).limit(1)

    if (family.length === 0 || session.length === 0) {
      console.log('No families or sessions found. Please create some first.')
      return
    }

    const familyId = family[0].id
    const sessionId = session[0].id

    console.log(`Using family: ${familyId}, session: ${sessionId}`)

    // Create session fee config if it doesn't exist
    const existingConfig = await db
      .select()
      .from(sessionFeeConfigs)
      .where(eq(sessionFeeConfigs.sessionId, sessionId))
      .limit(1)

    if (existingConfig.length === 0) {
      await db.insert(sessionFeeConfigs).values({
        id: randomUUID(),
        sessionId: sessionId,
        firstChildFee: 50.00,
        additionalChildFee: 25.00,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
      })
      console.log('Created session fee config')
    }

    // Create family session fee if it doesn't exist
    const existingFee = await db
      .select()
      .from(familySessionFees)
      .where(and(
        eq(familySessionFees.sessionId, sessionId),
        eq(familySessionFees.familyId, familyId)
      ))
      .limit(1)

    if (existingFee.length === 0) {
      await db.insert(familySessionFees).values({
        id: randomUUID(),
        sessionId: sessionId,
        familyId: familyId,
        registrationFee: 75.00,
        classFees: 120.00,
        totalFee: 195.00,
        paidAmount: 0.00,
        status: 'pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        calculatedAt: new Date().toISOString()
      })
      console.log('Created family session fee')
    }

    console.log('Test fee data created successfully!')

  } catch (error) {
    console.error('Error creating test fees:', error)
  } finally {
    sqlite.close()
  }
}

// Import eq and and functions
const { eq, and } = require('drizzle-orm')

createTestFees()