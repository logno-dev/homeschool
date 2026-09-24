export const REPORT_TYPES = [
  'invoice',
  'billing_statement',
  'donation_receipt'
] as const

export type ReportType = typeof REPORT_TYPES[number]

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  invoice: 'Registration invoice',
  billing_statement: 'Billing statement',
  donation_receipt: 'Donation receipt'
}

export interface ReportTemplateVersion {
  version: number
  publishedAt: string
  dataSchema: Record<string, unknown>
  schemaHash: string
}

export interface ReportTemplateCatalogItem {
  slug: string
  name: string
  latestVersion: number
  versions: ReportTemplateVersion[]
}

export interface ReportTemplateSelection {
  slug: string
  version: number
  schemaHash: string
}

export type ReportTemplateMappings = Partial<Record<ReportType, ReportTemplateSelection>>
