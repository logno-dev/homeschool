import { db } from '@/lib/db'
import { 
  sessionFeeConfigs, 
  familySessionFees, 
  classRegistrations, 
  schedules, 
  classTeachingRequests
} from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export interface FeeCalculationResult {
  registrationFee: number
  classFees: number
  totalFee: number
  childrenCount: number
  dueDate: string
}

export async function calculateFamilySessionFees(
  sessionId: string, 
  familyId: string
): Promise<FeeCalculationResult> {
  // Get session fee configuration
  const feeConfig = await db
    .select()
    .from(sessionFeeConfigs)
    .where(eq(sessionFeeConfigs.sessionId, sessionId))
    .limit(1)

  if (feeConfig.length === 0) {
    throw new Error(`No fee configuration found for session ${sessionId}`)
  }

  const config = feeConfig[0]

  // Get all children registered for classes in this session
  const registeredChildren = await db
    .select({
      childId: classRegistrations.childId,
      classFee: classTeachingRequests.feeAmount
    })
    .from(classRegistrations)
    .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
    .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .where(and(
      eq(classRegistrations.sessionId, sessionId),
      eq(classRegistrations.familyId, familyId),
      eq(classRegistrations.status, 'registered')
    ))

  // Count unique children
  const uniqueChildren = new Set(registeredChildren.map(r => r.childId))
  const childrenCount = uniqueChildren.size

  // Calculate registration fee (first child + additional children)
  let registrationFee = 0
  if (childrenCount > 0) {
    registrationFee = config.firstChildFee + (Math.max(0, childrenCount - 1) * config.additionalChildFee)
  }

  // Calculate class fees (sum of all class fees for registered children)
  const classFees = registeredChildren.reduce((total, registration) => {
    return total + (registration.classFee || 0)
  }, 0)

  const totalFee = registrationFee + classFees

  return {
    registrationFee,
    classFees,
    totalFee,
    childrenCount,
    dueDate: config.dueDate
  }
}

export async function createOrUpdateFamilySessionFee(
  sessionId: string,
  familyId: string
): Promise<string> {
  const calculation = await calculateFamilySessionFees(sessionId, familyId)

  // Check if family session fee already exists
  const existingFee = await db
    .select()
    .from(familySessionFees)
    .where(and(
      eq(familySessionFees.sessionId, sessionId),
      eq(familySessionFees.familyId, familyId)
    ))
    .limit(1)

  if (existingFee.length > 0) {
    // Update existing fee
    await db
      .update(familySessionFees)
      .set({
        registrationFee: calculation.registrationFee,
        classFees: calculation.classFees,
        totalFee: calculation.totalFee,
        dueDate: calculation.dueDate,
        calculatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Reset status to pending if total changed and not fully paid
        status: existingFee[0].paidAmount >= calculation.totalFee ? 'paid' : 
                existingFee[0].paidAmount > 0 ? 'partial' : 'pending'
      })
      .where(eq(familySessionFees.id, existingFee[0].id))

    return existingFee[0].id
  } else {
    // Create new fee record
    const feeId = randomUUID()
    await db
      .insert(familySessionFees)
      .values({
        id: feeId,
        sessionId,
        familyId,
        registrationFee: calculation.registrationFee,
        classFees: calculation.classFees,
        totalFee: calculation.totalFee,
        paidAmount: 0,
        status: 'pending',
        dueDate: calculation.dueDate,
        calculatedAt: new Date().toISOString()
      })

    return feeId
  }
}

export async function getFamilySessionFeeStatus(
  sessionId: string,
  familyId: string
) {
  const fee = await db
    .select()
    .from(familySessionFees)
    .where(and(
      eq(familySessionFees.sessionId, sessionId),
      eq(familySessionFees.familyId, familyId)
    ))
    .limit(1)

  if (fee.length === 0) {
    return null
  }

  const feeRecord = fee[0]
  const isOverdue = new Date() > new Date(feeRecord.dueDate)
  
  return {
    ...feeRecord,
    isOverdue,
    remainingAmount: feeRecord.totalFee - feeRecord.paidAmount
  }
}