export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermanentJobError'
  }
}

export function isTransientHttpStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}
