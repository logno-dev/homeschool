export interface ReimbursementMethod {
  id: string
  label: string
  detailsLabel: string
}

export const DEFAULT_REIMBURSEMENT_METHODS: ReimbursementMethod[] = [
  { id: 'zelle', label: 'Zelle', detailsLabel: 'Zelle Username' },
  { id: 'check', label: 'Check', detailsLabel: 'Payable to' },
]

export function parseReimbursementMethods(value: string | null | undefined): ReimbursementMethod[] {
  if (!value) return DEFAULT_REIMBURSEMENT_METHODS
  try {
    const parsed = JSON.parse(value)
    return isReimbursementMethods(parsed) ? parsed : DEFAULT_REIMBURSEMENT_METHODS
  } catch {
    return DEFAULT_REIMBURSEMENT_METHODS
  }
}

export function isReimbursementMethods(value: unknown): value is ReimbursementMethod[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every((method) => {
    if (!method || typeof method !== 'object') return false
    const item = method as Record<string, unknown>
    return typeof item.id === 'string' && /^[a-z0-9][a-z0-9_-]{0,49}$/i.test(item.id)
      && typeof item.label === 'string' && item.label.trim().length > 0 && item.label.trim().length <= 100
      && typeof item.detailsLabel === 'string' && item.detailsLabel.trim().length > 0 && item.detailsLabel.trim().length <= 100
  }) && new Set(value.map((method) => method.id)).size === value.length
}

export function normalizeReimbursementMethods(methods: ReimbursementMethod[]) {
  return methods.map((method) => ({
    id: method.id,
    label: method.label.trim(),
    detailsLabel: method.detailsLabel.trim(),
  }))
}
