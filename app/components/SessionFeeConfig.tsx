'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { parseStoredSessionFeeRules, type SessionFeeRule } from '@/lib/session-fee-rules'
import type { SessionFeeConfig } from '@/lib/schema'
import { useToast } from './ToastContainer'
import Button from './Button'

interface SessionFeeConfigProps {
  sessionId: string
  sessionName: string
  startInEditMode?: boolean
  inline?: boolean
}

interface RuleFormRow {
  minChildren: string
  maxChildren: string
  fee: string
}

const defaultRule: RuleFormRow = {
  minChildren: '1',
  maxChildren: '',
  fee: '0'
}

export default function SessionFeeConfig({ sessionId, sessionName, startInEditMode = false, inline = false }: SessionFeeConfigProps) {
  const [feeConfig, setFeeConfig] = useState<SessionFeeConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(startInEditMode)
  const { showSuccess, showError } = useToast()

  const [formData, setFormData] = useState<{
    dueDate: string
    costBreakdown: string
    pricingRules: RuleFormRow[]
  }>({
    dueDate: '',
    costBreakdown: '',
    pricingRules: [defaultRule]
  })

  const toFormRows = (rules: SessionFeeRule[]): RuleFormRow[] =>
    rules.length > 0
      ? rules.map((rule) => ({
          minChildren: String(rule.minChildren),
          maxChildren: rule.maxChildren === null ? '' : String(rule.maxChildren),
          fee: String(rule.fee)
        }))
      : [defaultRule]

  const getActiveRules = () => parseStoredSessionFeeRules(feeConfig?.pricingRules)

  const toCurrency = (value: string | number) => {
    const amount = Number(value)
    return Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
  }

  const getRuleLabel = (rule: { minChildren: string; maxChildren: string }) => {
    const minValue = Number(rule.minChildren)
    const maxValue = rule.maxChildren
    if (!maxValue || maxValue.trim() === '') {
      return `${minValue}+ students`
    }

    const max = Number(maxValue)

    if (minValue === max) {
      return `${minValue} student${minValue === 1 ? '' : 's'}`
    }

    return `${minValue}-${max} students`
  }

  useEffect(() => {
    fetchFeeConfig()
  }, [sessionId])

  const fetchFeeConfig = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/admin/sessions/${sessionId}/fees`)

      if (!response.ok) {
        throw new Error('Failed to fetch fee configuration')
      }

      const data = await response.json()
      if (data.success && data.feeConfig) {
        const config = data.feeConfig
        setFeeConfig(config)
        setFormData({
          dueDate: config.dueDate ? config.dueDate.split('T')[0] : '',
          costBreakdown: config.costBreakdown || '',
          pricingRules: toFormRows(parseStoredSessionFeeRules(config.pricingRules))
        })
      } else {
        setFeeConfig(null)
        setFormData({
          dueDate: '',
          costBreakdown: '',
          pricingRules: [defaultRule]
        })
      }
    } catch (error) {
      console.error('Error fetching fee config:', error)
      showError('Failed to load fee configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const pricingRulesPayload = formData.pricingRules.map((rule) => ({
        minChildren: Number(rule.minChildren),
        maxChildren: rule.maxChildren.trim() === '' ? null : Number(rule.maxChildren),
        fee: Number(rule.fee)
      }))

      const response = await fetch(`/api/admin/sessions/${sessionId}/fees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pricingRules: pricingRulesPayload,
          dueDate: formData.dueDate,
          costBreakdown: formData.costBreakdown.trim() || null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save fee configuration')
      }

      const data = await response.json()
      showSuccess(data.message)
      setIsEditing(false)
      await fetchFeeConfig()
    } catch (error) {
      console.error('Error saving fee config:', error)
      showError(error instanceof Error ? error.message : 'Failed to save fee configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (feeConfig) {
      setFormData({
        dueDate: feeConfig.dueDate ? feeConfig.dueDate.split('T')[0] : '',
        costBreakdown: feeConfig.costBreakdown || '',
        pricingRules: toFormRows(parseStoredSessionFeeRules(feeConfig.pricingRules))
      })
    } else {
      setFormData({
        dueDate: '',
        costBreakdown: '',
        pricingRules: [defaultRule]
      })
    }
    setIsEditing(false)
  }

  const addRule = () => {
    setFormData((prev) => {
      const lastRule = prev.pricingRules[prev.pricingRules.length - 1]
      if (!lastRule) {
        return {
          ...prev,
          pricingRules: [defaultRule]
        }
      }

      if ((lastRule.maxChildren || '').trim() === '') {
        return prev
      }

      const nextMinChildren = Number(lastRule.maxChildren) + 1

      return {
        ...prev,
        pricingRules: [
          ...prev.pricingRules,
          {
            minChildren: String(nextMinChildren),
            maxChildren: '',
            fee: '0'
          }
        ]
      }
    })
  }

  const removeRule = (index: number) => {
    setFormData((prev) => {
      if (prev.pricingRules.length <= 1) {
        return prev
      }

      const pricingRules = prev.pricingRules.filter((_, ruleIndex) => ruleIndex !== index)
      return {
        ...prev,
        pricingRules
      }
    })
  }

  const updateRuleField = (index: number, field: keyof RuleFormRow, value: string) => {
    setFormData((prev) => {
      const pricingRules = [...prev.pricingRules]
      pricingRules[index] = {
        ...pricingRules[index],
        [field]: value
      }
      return {
        ...prev,
        pricingRules
      }
    })
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Fee Configuration - {sessionName}</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  const activeRules = getActiveRules()
  const editing = inline || isEditing

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Fee Configuration - {sessionName}</h3>
        {!editing && (
          <Button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {feeConfig ? 'Edit Fees' : 'Configure Fees'}
          </Button>
        )}
      </div>

      {!editing && feeConfig ? (
        <div className="space-y-3">
          {activeRules.length > 0 ? (
            <div className="space-y-1">
              {activeRules.map((rule) => (
                <div key={`${rule.minChildren}-${rule.maxChildren ?? 'open'}`}>
                  <span className="font-medium">{rule.maxChildren === null ? `${rule.minChildren}+ students` : rule.minChildren === rule.maxChildren ? `${rule.minChildren} student${rule.minChildren === 1 ? '' : 's'}` : `${rule.minChildren}-${rule.maxChildren} students`}</span>:
                  {' '}${toCurrency(rule.fee)}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div>
                <span className="font-medium">First Child Fee:</span> ${toCurrency(feeConfig.firstChildFee)}
              </div>
              <div>
                <span className="font-medium">Additional Child Fee:</span> ${toCurrency(feeConfig.additionalChildFee)}
              </div>
            </>
          )}
          <div>
            {feeConfig.costBreakdown && <div className="mb-3 whitespace-pre-wrap"><span className="font-medium">Cost Breakdown:</span> {feeConfig.costBreakdown}</div>}
            <span className="font-medium">Due Date:</span> {format(parseISO(feeConfig.dueDate), 'MMM d, yyyy')}
          </div>
          <div className="text-sm text-gray-600 mt-4">
            <p>Last updated: {format(parseISO(feeConfig.updatedAt), 'MMM d, yyyy h:mm a')}</p>
          </div>
        </div>
      ) : !editing && !feeConfig ? (
        <div className="text-gray-500">
          No fee configuration set for this session. Click "Configure Fees" to set up fees.
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="costBreakdown" className="block text-sm font-medium text-gray-700 mb-1">Cost Breakdown</label>
            <textarea id="costBreakdown" rows={4} value={formData.costBreakdown} onChange={(e) => setFormData({ ...formData, costBreakdown: e.target.value })} placeholder="Explain what registration and class fees cover." className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="mt-1 text-xs text-gray-500">This explanation is shown to families on the registration page and during checkout.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Rules</label>
            <p className="text-sm text-gray-600 mb-2">Each row is the total fee for that number of students in the family (not an extra amount added on).</p>
            <p className="text-sm text-gray-600 mb-3">
              Example: 1-1 = $45, 2-2 = $65, 3-3 = $85, 4-4 = $100, 5+ = $110
            </p>
            <div className="space-y-3">
              {formData.pricingRules.map((rule, index) => (
                <div key={`${rule.minChildren}-${index}`} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <label htmlFor={`rule-min-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                      From
                    </label>
                    <input
                      type="number"
                      id={`rule-min-${index}`}
                      min="1"
                      step="1"
                      value={rule.minChildren}
                      onChange={(e) => updateRuleField(index, 'minChildren', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <label htmlFor={`rule-max-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                      To
                    </label>
                    <input
                      type="number"
                      id={`rule-max-${index}`}
                      min="1"
                      step="1"
                      placeholder="Blank = no upper limit"
                      value={rule.maxChildren}
                      onChange={(e) => updateRuleField(index, 'maxChildren', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-4">
                    <label htmlFor={`rule-fee-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                      Fee ($)
                    </label>
                    <p className="text-[11px] text-gray-500 mb-1">Total registration fee for this student range</p>
                    <input
                      type="number"
                      id={`rule-fee-${index}`}
                      min="0"
                      step="0.01"
                      value={rule.fee}
                      onChange={(e) => updateRuleField(index, 'fee', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => removeRule(index)}
                      className="px-3 py-2 border border-red-200 text-red-600 rounded hover:bg-red-50"
                      disabled={formData.pricingRules.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRule}
              disabled={formData.pricingRules[formData.pricingRules.length - 1]?.maxChildren?.trim() === ''}
              className="mt-3 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Rule
            </button>
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              id="dueDate"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.dueDate}
              className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
            <Button
              onClick={handleCancel}
              disabled={isSaving}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Cancel
            </Button>
          </div>

            <div className="text-sm text-gray-600 mt-4 p-3 bg-blue-50 rounded">
              <p><strong>Fee Rule Preview:</strong></p>
              {formData.pricingRules.map((rule, index) => (
                <p key={`${rule.minChildren}-display-${index}`}>
                  For {getRuleLabel(rule)}: ${toCurrency(rule.fee)}
                </p>
              ))}
              <p>Plus any individual class fees</p>
            </div>
        </div>
      )}
    </div>
  )
}
