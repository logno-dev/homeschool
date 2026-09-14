export function normalizeEmailSpacing(value: string): string {
  return value.replace(/(?:&amp;nbsp;|&nbsp;|&#0*160;|&#x0*a0;|\u00a0)/gi, ' ')
}
