interface PayPalMetadata {
  kind: 'fee' | 'scholarship'
  feeAmountCents: number
  donationAmountCents: number
}

interface PayPalErrorPayloadDetail {
  issue?: string
  description?: string
  field?: string
  value?: string | number
}

interface PayPalErrorPayload {
  name?: string
  message?: string
  details?: PayPalErrorPayloadDetail[]
  debug_id?: string
}

interface PayPalErrorSummaryPayload {
  name?: string
  message?: string
  debug_id?: string
  details?: Array<{
    issue?: string
    description?: string
    field?: string
    value?: string | number
  }>
}

function makeInvoiceSuffix() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${timestamp}-${random}`
}

function makeInvoiceId(base: string): string {
  return `${base}#${makeInvoiceSuffix()}`
}

function extractInvoiceIdBase(invoiceId: string): string {
  return invoiceId.split('#', 1)[0]
}

interface PayPalConfig {
  isSandbox: boolean
  clientId: string
  clientSecret: string
  apiBase: string
}

interface PayPalAmount {
  currency_code: 'USD'
  value: string
}

interface PayPalPurchaseUnit {
  reference_id?: string
  description?: string
  custom_id?: string
  invoice_id?: string
  amount: PayPalAmount
}

interface PayPalOrder {
  id: string
  status: string
  purchase_units: Array<{
    reference_id?: string
    invoice_id?: string
    custom_id?: string
    payments?: {
      captures?: Array<{
        status?: string
        amount?: PayPalAmount
      }>
    }
    amount?: PayPalAmount
  }>
}

const toBoolean = (value?: string) => {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return ['true', '1', 'yes', 'on'].includes(normalized)
}

const readSecret = (value?: string) => value?.trim()

const sanitizePayPalError = (payload: unknown, defaultMessage: string) => {
  if (!payload || typeof payload !== 'object') {
    return defaultMessage
  }

  const candidate = payload as Record<string, unknown>
  const error = typeof candidate.error === 'string' ? candidate.error : null
  const errorDescription =
    typeof candidate.error_description === 'string' ? candidate.error_description : null

  return `${error ?? 'PayPal API error'}: ${errorDescription ?? defaultMessage}`
}

function getPayPalConfig(): PayPalConfig {
  const isSandbox = toBoolean(process.env.PAYPAL_SANDBOX_ENABLED) || toBoolean(process.env.NEXT_PUBLIC_PAYPAL_SANDBOX)

  if (isSandbox) {
    const sandboxClientId =
      readSecret(process.env.PAYPAL_CLIENT_ID_SANDBOX)
      || readSecret(process.env.PAYPAL_SANDBOX_CLIENT_ID)
      || readSecret(process.env.PAYPAL_CLIENT_ID)

    const sandboxClientSecret =
      readSecret(process.env.PAYPAL_CLIENT_SECRET_SANDBOX)
      || readSecret(process.env.PAYPAL_SANDBOX_CLIENT_SECRET)
      || readSecret(process.env.PAYPAL_CLIENT_SECRET)

    if (!sandboxClientId || !sandboxClientSecret) {
      throw new Error('Missing sandbox PayPal credentials')
    }

    return {
      isSandbox,
      clientId: sandboxClientId,
      clientSecret: sandboxClientSecret,
      apiBase: 'https://api-m.sandbox.paypal.com'
    }
  }

  const liveClientId =
    readSecret(process.env.PAYPAL_CLIENT_ID_LIVE)
    || readSecret(process.env.PAYPAL_LIVE_CLIENT_ID)
    || readSecret(process.env.PAYPAL_CLIENT_ID)

  const liveClientSecret =
    readSecret(process.env.PAYPAL_CLIENT_SECRET_LIVE)
    || readSecret(process.env.PAYPAL_LIVE_CLIENT_SECRET)
    || readSecret(process.env.PAYPAL_CLIENT_SECRET)

  if (!liveClientId || !liveClientSecret) {
    throw new Error('Missing live PayPal credentials')
  }

  return {
    isSandbox,
    clientId: liveClientId,
    clientSecret: liveClientSecret,
    apiBase: 'https://api-m.paypal.com'
  }
}

const PAYPAL_DEBUG_LOGS = toBoolean(process.env.PAYPAL_DEBUG) || toBoolean(process.env.PAYPAL_DEBUG_LOGS)

function getPayPalDebugEnabled(): boolean {
  return PAYPAL_DEBUG_LOGS || process.env.NODE_ENV !== 'production'
}

export function logPayPalDebug(message: string, context?: Record<string, unknown>) {
  if (!getPayPalDebugEnabled()) {
    return
  }

  if (context) {
    console.error(`[PayPal Debug] ${message}`, context)
  } else {
    console.error(`[PayPal Debug] ${message}`)
  }
}

function pickFirst<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value
    }
  }

  return null
}

function centsToString(amountCents: number): string {
  return (amountCents / 100).toFixed(2)
}

function parseAmount(value: string): number {
  const normalized = Number.parseFloat(value)
  if (Number.isNaN(normalized) || !Number.isFinite(normalized)) {
    throw new Error('Invalid PayPal amount')
  }
  return normalized
}

export function toAmountCents(value: number): number {
  return Math.round(value * 100)
}

async function getPayPalAccessToken(config: PayPalConfig): Promise<string> {
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

  const tokenResponse = await fetch(`${config.apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok) {
    throw new Error(sanitizePayPalError(tokenData, 'Failed to obtain PayPal access token'))
  }

  return tokenData.access_token
}

function summarizePayPalErrorPayload(payload: unknown): PayPalErrorSummaryPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as PayPalErrorPayload
  const details = Array.isArray(candidate.details)
    ? candidate.details.map((detail) => ({
      issue: detail?.issue,
      description: detail?.description,
      field: detail?.field,
      value: detail?.value
    }))
    : undefined

  return {
    name: candidate.name,
    message: candidate.message,
    debug_id: candidate.debug_id,
    details
  }
}

function getPayPalErrorIssues(payload: ReturnType<typeof summarizePayPalErrorPayload> | undefined) {
  if (!payload || !Array.isArray(payload.details)) {
    return []
  }

  return payload.details
    .map((detail) => detail?.issue)
    .filter((issue): issue is string => typeof issue === 'string' && issue.length > 0)
}

async function getPayPalOrderRaw(config: PayPalConfig, token: string, orderId: string): Promise<PayPalOrder> {
  const payload = await postToPayPal(`${config.apiBase}/v2/checkout/orders/${orderId}`, token, null, 'GET')
  return payload as PayPalOrder
}

async function postToPayPal(url: string, token: string, body: unknown, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const payload = await response.json()

  if (!response.ok) {
    const summarizedError = summarizePayPalErrorPayload(payload)

    logPayPalDebug('PayPal request failed', {
      url,
      method,
      status: response.status,
      statusText: response.statusText,
      paypalDebugId: response.headers.get('paypal-debug-id'),
      requestBody: body,
      error: summarizedError,
      responsePayload: JSON.stringify(payload)
    })

    const errorDetails = (payload as PayPalErrorPayload).details
    const firstDetail = Array.isArray(errorDetails) && errorDetails.length > 0
      ? errorDetails[0]
      : undefined

    const errorMessage =
      (payload as PayPalErrorPayload).message
      || firstDetail?.description
      || firstDetail?.issue
      || 'PayPal request failed'

    const error = new Error(errorMessage) as Error & {
      payPalStatus?: number
      payPalDebugId?: string | null
      payPalError?: ReturnType<typeof summarizePayPalErrorPayload>
    }

    error.payPalStatus = response.status
    error.payPalDebugId = response.headers.get('paypal-debug-id')
    error.payPalError = summarizedError

    throw error
  }

  return payload
}

export function getPayPalMetadata() {
  const config = getPayPalConfig()

  return {
    isSandbox: config.isSandbox,
    clientId: config.clientId
  }
}

export function makeFeeMetadata(params: { familySessionFeeId: string; feeAmountCents: number; donationAmountCents: number }): {
  customId: string
  invoiceId: string
  description: string
} {
  return {
    customId: `fee:${params.feeAmountCents}:${params.donationAmountCents}`,
    invoiceId: makeInvoiceId(params.familySessionFeeId),
    description: `Session fee payment for family session fee ${params.familySessionFeeId}`
  }
}

export function makeScholarshipMetadata(params: { familySessionFeeId: string; amountCents: number }): {
  customId: string
  invoiceId: string
  description: string
} {
  return {
    customId: `donation:${params.amountCents}`,
    invoiceId: makeInvoiceId(`scholarship:${params.familySessionFeeId}`),
    description: 'Scholarship fund donation'
  }
}

export function parseFeeMetadata(order: PayPalOrder): PayPalMetadata & { familySessionFeeId: string } | null {
  const primaryUnit = order.purchase_units?.[0]
  const capturePayment = primaryUnit?.payments?.captures?.[0]
  const captureCustomId = capturePayment && 'custom_id' in capturePayment
    ? (capturePayment as { custom_id?: string | null }).custom_id
    : undefined

  const custom = pickFirst(primaryUnit?.custom_id, captureCustomId as string | null | undefined) as string | null | undefined
  const invoiceId = primaryUnit?.invoice_id

  if (!invoiceId) {
    return null
  }

  const familySessionFeeId = extractInvoiceIdBase(invoiceId)

  const feeAmountCents = Number(0)
  const donationAmountCents = Number(0)

  if (!custom) {
    return {
      kind: 'fee',
      familySessionFeeId,
      feeAmountCents,
      donationAmountCents
    }
  }

  const parts = custom.split(':')
  if (parts.length !== 3 || parts[0] !== 'fee') {
    return null
  }

  const feeAmount = Number(parts[1])
  const donationAmount = Number(parts[2])

  if (!Number.isFinite(feeAmount) || !Number.isFinite(donationAmount)) {
    return null
  }

  return {
    kind: 'fee',
    familySessionFeeId,
    feeAmountCents: feeAmount,
    donationAmountCents: donationAmount
  }
}

export function parseScholarshipMetadata(order: PayPalOrder): PayPalMetadata & { familyId?: string } | null {
  const primaryUnit = order.purchase_units?.[0]
  const capturePayment = primaryUnit?.payments?.captures?.[0]
  const captureCustomId = capturePayment && 'custom_id' in capturePayment
    ? (capturePayment as { custom_id?: string | null }).custom_id
    : undefined

  const custom = pickFirst(primaryUnit?.custom_id, captureCustomId)
  const invoiceId = primaryUnit?.invoice_id

  if (!custom || !invoiceId) {
    return null
  }

  const invoiceIdBase = extractInvoiceIdBase(invoiceId)
  if (!invoiceIdBase.startsWith('scholarship:')) {
    return null
  }

  const familyId = invoiceIdBase.replace('scholarship:', '')

  const parts = custom.split(':')
  if (parts.length !== 2 || parts[0] !== 'donation') {
    return null
  }

  const feeAmountCents = Number(parts[1])

  if (!Number.isFinite(feeAmountCents)) {
    return null
  }

  return {
    kind: 'scholarship',
    feeAmountCents,
    donationAmountCents: 0,
    familyId: familyId || undefined
  }
}

export async function createPayPalOrder(params: {
  totalAmountCents: number
  description: string
  customId: string
  invoiceId: string
}): Promise<string> {
  const config = getPayPalConfig()
  const token = await getPayPalAccessToken(config)

  const orderPayload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: centsToString(params.totalAmountCents)
        } as PayPalAmount,
        description: params.description,
        custom_id: params.customId,
        invoice_id: params.invoiceId
      } as PayPalPurchaseUnit
    ],
    application_context: {
      user_action: 'PAY_NOW',
      brand_name: 'DVCLC',
      shipping_preference: 'NO_SHIPPING'
    }
  }

  const payload = await postToPayPal(
    `${config.apiBase}/v2/checkout/orders`,
    token,
    orderPayload
  )

  logPayPalDebug('Created PayPal order', {
    orderId: payload.id,
    invoiceId: params.invoiceId,
    totalAmountCents: params.totalAmountCents,
    status: payload.status
  })

  if (!payload.id) {
    throw new Error('PayPal order was not created')
  }

  return payload.id
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalOrder> {
  const config = getPayPalConfig()
  const token = await getPayPalAccessToken(config)

  const preCaptureOrder = await getPayPalOrderRaw(config, token, orderId)
  logPayPalDebug('Fetched PayPal order before capture', {
    orderId,
    summary: summarizePayPalOrderForDebug(preCaptureOrder)
  })

  if (preCaptureOrder.status === 'COMPLETED') {
    logPayPalDebug('PayPal order already completed before capture', {
      orderId,
      summary: summarizePayPalOrderForDebug(preCaptureOrder)
    })
    return preCaptureOrder
  }

  if (preCaptureOrder.status !== 'APPROVED') {
    logPayPalDebug('PayPal order not approved for capture', {
      orderId,
      status: preCaptureOrder.status,
      summary: summarizePayPalOrderForDebug(preCaptureOrder)
    })
    throw new Error(`PayPal order is not ready for capture: ${preCaptureOrder.status}`)
  }

  try {
    const payload = await postToPayPal(`${config.apiBase}/v2/checkout/orders/${orderId}/capture`, token, null)

    logPayPalDebug('Captured PayPal order', {
      orderId,
      status: payload?.status,
      payloadSummary: summarizePayPalOrderForDebug(payload as PayPalOrder)
    })

    return payload as PayPalOrder
  } catch (error) {
    const paypalStatus = (error as Error & { payPalStatus?: number }).payPalStatus
    const payPalError = (error as Error & { payPalError?: PayPalErrorSummaryPayload }).payPalError
    const issues = getPayPalErrorIssues(payPalError)
    const hasCaptureRaceIssue = paypalStatus === 422 && issues.some((issue) => [
      'ORDER_ALREADY_CAPTURED',
      'ORDER_ALREADY_COMPLETED',
      'ORDER_NOT_APPROVED'
    ].includes(issue))

    if (hasCaptureRaceIssue) {
      const updatedOrder = await getPayPalOrderRaw(config, token, orderId)
      logPayPalDebug('PayPal order status changed while capturing', {
        orderId,
        status: updatedOrder.status,
        summary: summarizePayPalOrderForDebug(updatedOrder),
        issues
      })

      if (updatedOrder.status === 'COMPLETED') {
        return updatedOrder
      }
    }

    throw error
  }
}

export function summarizePayPalOrderForDebug(order: PayPalOrder) {
  const unit = order.purchase_units?.[0]
  const captures = unit?.payments?.captures ?? []

  return {
    id: order.id,
    status: order.status,
    invoiceId: unit?.invoice_id,
    purchaseCustomId: unit?.custom_id,
    purchaseAmount: unit?.amount,
    captures: captures.map((capture) => ({
      status: capture.status,
      amount: capture.amount
    }))
  }
}

export function getCaptureAmountCents(order: PayPalOrder): number {
  const unit = order.purchase_units?.[0]
  const capture = unit?.payments?.captures?.[0]

  if (capture?.amount?.value) {
    return toAmountCents(parseAmount(capture.amount.value))
  }

  if (unit?.amount?.value) {
    return toAmountCents(parseAmount(unit.amount.value))
  }

  return 0
}
