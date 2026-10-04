import { eq } from 'drizzle-orm'
import { familySessionFees } from '@/lib/schema'
import { getFinancialLineItems, type FinancialLineItem } from '@/lib/financial-line-items'
import type { FeeTransaction } from '@/lib/class-fee-ledger'

export interface PaymentBillingSnapshot {
  version: 1
  capturedAt: string
  lineItems: FinancialLineItem[]
  totalFee: number
  paidAmount: number
  remainingBalance: number
  status: string
}

export async function createPaymentSnapshot(tx: FeeTransaction, feeId: string | null | undefined): Promise<string | null> {
  if (!feeId) return null
  const [fee] = await tx.select().from(familySessionFees).where(eq(familySessionFees.id, feeId)).limit(1)
  if (!fee) return null
  const snapshot: PaymentBillingSnapshot = {
    version: 1, capturedAt: new Date().toISOString(),
    lineItems: await getFinancialLineItems(fee, tx),
    totalFee: fee.totalFee, paidAmount: fee.paidAmount,
    remainingBalance: Math.max(0, Math.round((fee.totalFee - fee.paidAmount) * 100) / 100),
    status: fee.status
  }
  return JSON.stringify(snapshot)
}
