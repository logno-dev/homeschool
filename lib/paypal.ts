interface PayPalMetadata {
  kind: 'fee' | 'scholarship'
  feeAmountCents: number
  donationAmountCents: number
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

function getPayPalConfig(): PayPalConfig {
  const isSandbox = toBoolean(process.env.PAYPAL_SANDBOX_ENABLED) || toBoolean(process.env.NEXT_PUBLIC_PAYPAL_SANDBOX)

  if (isSandbox) {
    const sandboxClientId = process.env.PAYPAL_CLIENT_ID_SANDBOX
    const sandboxClientSecret = process.env.PAYPAL_CLIENT_SECRET_SANDBOX

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

  const liveClientId = process.env.PAYPAL_CLIENT_ID_LIVE
  const liveClientSecret = process.env.PAYPAL_CLIENT_SECRET_LIVE

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
    throw new Error(tokenData.error_description || 'Failed to obtain PayPal access token')
  }

  return tokenData.access_token
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
    const errorMessage = payload.message || payload.details?.[0]?.description || 'PayPal request failed'
    throw new Error(errorMessage)
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
    invoiceId: params.familySessionFeeId,
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
    invoiceId: `scholarship:${params.familySessionFeeId}`,
    description: 'Scholarship fund donation'
  }
}

export function parseFeeMetadata(order: PayPalOrder): PayPalMetadata & { familySessionFeeId: string } | null {
  const custom = order.purchase_units?.[0]?.custom_id
  const invoiceId = order.purchase_units?.[0]?.invoice_id

  if (!custom || !invoiceId) {
    return null
  }

  const parts = custom.split(':')
  if (parts.length !== 3 || parts[0] !== 'fee') {
    return null
  }

  const feeAmountCents = Number(parts[1])
  const donationAmountCents = Number(parts[2])

  if (!Number.isFinite(feeAmountCents) || !Number.isFinite(donationAmountCents)) {
    return null
  }

  return {
    kind: 'fee',
    familySessionFeeId: invoiceId,
    feeAmountCents,
    donationAmountCents
  }
}

export function parseScholarshipMetadata(order: PayPalOrder): PayPalMetadata & { familyId?: string } | null {
  const custom = order.purchase_units?.[0]?.custom_id
  const invoiceId = order.purchase_units?.[0]?.invoice_id

  if (!custom || !invoiceId) {
    return null
  }

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
    familyId: invoiceId.startsWith('scholarship:') ? invoiceId.replace('scholarship:', '') : undefined
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

  if (!payload.id) {
    throw new Error('PayPal order was not created')
  }

  return payload.id
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalOrder> {
  const config = getPayPalConfig()
  const token = await getPayPalAccessToken(config)
  const payload = await postToPayPal(`${config.apiBase}/v2/checkout/orders/${orderId}/capture`, token, null)
  return payload as PayPalOrder
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
