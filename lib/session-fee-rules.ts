export interface SessionFeeRule {
  minChildren: number
  maxChildren: number | null
  fee: number
}

export interface SessionFeeRulesResult {
  rules: SessionFeeRule[]
  errors: string[]
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
}

function isNonNegativeMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function parseStoredSessionFeeRules(rawRules: string | null | undefined): SessionFeeRule[] {
  if (!rawRules) {
    return []
  }

  try {
    const parsed = JSON.parse(rawRules)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return []
    }

    const normalized = parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null
        }

        const minChildren = Number(entry.minChildren)
        const maxChildrenRaw = entry.maxChildren
        const fee = Number(entry.fee)

        if (!isPositiveInteger(minChildren) || !isNonNegativeMoney(fee)) {
          return null
        }

        const maxChildren =
          maxChildrenRaw === null || maxChildrenRaw === undefined || maxChildrenRaw === ''
            ? null
            : Number(maxChildrenRaw)

        if (maxChildren !== null && (!isPositiveInteger(maxChildren) || maxChildren < minChildren)) {
          return null
        }

        return {
          minChildren,
          maxChildren,
          fee
        }
      })
      .filter((rule): rule is SessionFeeRule => rule !== null)
      .sort((a, b) => a.minChildren - b.minChildren)

    return normalized
  } catch {
    return []
  }
}

export function parseAndValidateSessionFeeRules(rawRules: unknown): SessionFeeRulesResult {
  const errors: string[] = []

  if (!Array.isArray(rawRules) || rawRules.length === 0) {
    return {
      rules: [],
      errors: ['Pricing rules are required and must include at least one rule.']
    }
  }

  const normalized = rawRules
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        errors.push(`Rule #${index + 1} must be an object.`)
        return null
      }

      const minChildren = Number(entry.minChildren)
      const fee = Number(entry.fee)
      const maxChildrenRaw = entry.maxChildren
      const hasMaxChildren = maxChildrenRaw !== undefined && maxChildrenRaw !== null && maxChildrenRaw !== ''
      const maxChildren = hasMaxChildren ? Number(maxChildrenRaw) : null

      if (!isPositiveInteger(minChildren)) {
        errors.push(`Rule #${index + 1} must have a valid minimum child count.`)
        return null
      }

      if (!isNonNegativeMoney(fee)) {
        errors.push(`Rule #${index + 1} must have a valid fee amount.`)
        return null
      }

      if (maxChildren !== null) {
        if (!isPositiveInteger(maxChildren)) {
          errors.push(`Rule #${index + 1} has an invalid maximum child count.`)
          return null
        }

        if (maxChildren < minChildren) {
          errors.push(`Rule #${index + 1} has a max child count that is lower than the min.`)
          return null
        }
      }

      return {
        minChildren,
        maxChildren,
        fee
      }
    })
    .filter((rule): rule is SessionFeeRule => rule !== null)
    .sort((a, b) => a.minChildren - b.minChildren)

  if (errors.length > 0) {
    return {
      rules: [],
      errors
    }
  }

  if (normalized.length === 0) {
    return {
      rules: [],
      errors: ['Pricing rules are required and must include at least one valid rule.']
    }
  }

  let previousMaxChildren: number = 0
  let hasOpenEnded = false

  normalized.forEach((rule, index) => {
    const isLast = index === normalized.length - 1

    if (index === 0 && rule.minChildren !== 1) {
      errors.push('The first rule must start at 1 child.')
    }

    if (hasOpenEnded) {
      errors.push('Rules are invalid because no rule should appear after an open-ended rule.')
      return
    }

    if (rule.minChildren !== previousMaxChildren + 1) {
      errors.push('Pricing rules must cover every child count without gaps or overlaps.')
    }

    if (rule.maxChildren !== null) {
      previousMaxChildren = rule.maxChildren
      return
    }

    if (!isLast) {
      errors.push('An open-ended rule must be the last rule.')
    }

    hasOpenEnded = true
  })

  if (errors.length > 0) {
    return {
      rules: [],
      errors: [...new Set(errors)]
    }
  }

  return {
    rules: normalized,
    errors: []
  }
}

export function calculateFeeFromRules(childrenCount: number, rules: SessionFeeRule[]): number | null {
  if (childrenCount <= 0) {
    return 0
  }

  for (const rule of rules) {
    const maxChildren = rule.maxChildren === null ? Number.MAX_SAFE_INTEGER : rule.maxChildren

    if (childrenCount >= rule.minChildren && childrenCount <= maxChildren) {
      return rule.fee
    }
  }

  return null
}

export function serializeSessionFeeRules(rules: SessionFeeRule[]): string {
  return JSON.stringify(rules)
}

export function formatRuleLabel(rule: SessionFeeRule): string {
  if (rule.maxChildren === null) {
    return `${rule.minChildren}+ children`
  }

  return `${rule.minChildren}-${rule.maxChildren} children`
}
