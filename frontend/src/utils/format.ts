export const formatINR = (n: number | null | undefined): string => {
  if (n == null) return '-'
  if (Math.abs(n) >= 1e7) return `INR ${(n / 1e7).toFixed(2)} Cr`
  if (Math.abs(n) >= 1e5) return `INR ${(n / 1e5).toFixed(2)} L`
  return `INR ${n.toLocaleString('en-IN')}`
}

export const formatPct = (n: number | null | undefined, digits = 1): string => {
  if (n == null) return '-'
  return `${n.toFixed(digits)}%`
}

export const formatNumber = (n: number | null | undefined, digits = 2): string => {
  if (n == null) return '-'
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits })
}

// Colors include dark-mode variants (e.g. bg-emerald-100/30 in dark).
export const gradeColor = (grade: string | null | undefined): string => {
  switch (grade) {
    case 'A': return 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
    case 'B': return 'bg-lime-100 text-lime-800 ring-lime-200 dark:bg-lime-500/15 dark:text-lime-300 dark:ring-lime-500/30'
    case 'C': return 'bg-yellow-100 text-yellow-800 ring-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:ring-yellow-500/30'
    case 'D': return 'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30'
    case 'E': return 'bg-red-100 text-red-800 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30'
    case 'F': return 'bg-rose-200 text-rose-900 ring-rose-300 dark:bg-rose-500/25 dark:text-rose-200 dark:ring-rose-500/40'
    default: return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-500/40'
  }
}

export const outcomeColor = (outcome: string | null | undefined): string => {
  switch (outcome) {
    case 'APPROVE': return 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
    case 'REVIEW':  return 'bg-yellow-100 text-yellow-800 ring-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:text-yellow-300 dark:ring-yellow-500/30'
    case 'REJECT':  return 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
    default:        return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-500/40'
  }
}

export const scoreColor = (score: number | null | undefined): string => {
  if (score == null) return 'text-slate-400'
  if (score >= 800) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 740) return 'text-lime-600 dark:text-lime-400'
  if (score >= 680) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 620) return 'text-orange-600 dark:text-orange-400'
  if (score >= 560) return 'text-red-600 dark:text-red-400'
  return 'text-rose-700 dark:text-rose-400'
}
