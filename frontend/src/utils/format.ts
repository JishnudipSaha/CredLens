export const formatINR = (n: number | null | undefined): string => {
  if (n == null) return '-'
  if (Math.abs(n) >= 1e7) return `₹ ${(n / 1e7).toFixed(2)} Cr`
  if (Math.abs(n) >= 1e5) return `₹ ${(n / 1e5).toFixed(2)} L`
  return `₹ ${n.toLocaleString('en-IN')}`
}

export const formatPct = (n: number | null | undefined, digits = 1): string => {
  if (n == null) return '-'
  return `${n.toFixed(digits)}%`
}

export const formatNumber = (n: number | null | undefined, digits = 2): string => {
  if (n == null) return '-'
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits })
}

// Grade colors - Institutional fintech design
export const gradeColor = (grade: string | null | undefined): string => {
  switch (grade) {
    case 'A': return 'badge-approved'
    case 'B': return 'badge-review'
    case 'C': return 'badge-rejected'
    case 'D': return 'badge-rejected'
    case 'E': return 'badge-rejected'
    case 'F': return 'badge-rejected'
    default: return 'chip bg-surface-container text-on-surface-variant'
  }
}

// Decision outcome colors
export const outcomeColor = (outcome: string | null | undefined): string => {
  switch (outcome) {
    case 'APPROVE': return 'badge-approved'
    case 'REVIEW':  return 'badge-review'
    case 'REJECT':  return 'badge-rejected'
    default:        return 'chip bg-surface-container text-on-surface-variant'
  }
}

// Score colors
export const scoreColor = (score: number | null | undefined): string => {
  if (score == null) return 'text-on-surface-variant'
  if (score >= 800) return 'text-tertiary-container'
  if (score >= 740) return 'text-secondary'
  if (score >= 680) return 'text-on-surface'
  if (score >= 620) return 'text-secondary-container'
  if (score >= 560) return 'text-error'
  return 'text-error'
}
