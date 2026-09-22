export const formatINR = (n: number | null | undefined): string => {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e7) return `₹ ${(n / 1e7).toFixed(2)} Cr`
  if (Math.abs(n) >= 1e5) return `₹ ${(n / 1e5).toFixed(2)} L`
  return `₹ ${n.toLocaleString('en-IN')}`
}

export const formatPct = (n: number | null | undefined, digits = 1): string => {
  if (n == null) return '—'
  return `${n.toFixed(digits)}%`
}

export const formatNumber = (n: number | null | undefined, digits = 2): string => {
  if (n == null) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits })
}

export const dash = (v: unknown): string => {
  if (v == null || v === '') return '—'
  return String(v)
}

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const date = d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

// Same bands as backend risk_scorer.score_to_grade (800/740/680/620/560)
export const scoreToGrade = (score: number): Grade => {
  if (score >= 800) return 'A'
  if (score >= 740) return 'B'
  if (score >= 680) return 'C'
  if (score >= 620) return 'D'
  if (score >= 560) return 'E'
  return 'F'
}

export type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral'

export const BADGE_BASE =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap'

const TONE_CLASS: Record<Tone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  primary: 'border-primary/30 bg-primary/10 text-primary',
  neutral: 'border-border bg-muted text-muted-foreground',
}

export const badgeTone = (tone: Tone): string => `${BADGE_BASE} ${TONE_CLASS[tone]}`

const GRADE_CLASS: Record<string, string> = {
  A: 'border-grade-a/30 bg-grade-a/10 text-grade-a',
  B: 'border-grade-b/30 bg-grade-b/10 text-grade-b',
  C: 'border-grade-c/30 bg-grade-c/10 text-grade-c',
  D: 'border-grade-d/30 bg-grade-d/10 text-grade-d',
  E: 'border-grade-e/30 bg-grade-e/10 text-grade-e',
  F: 'border-grade-f/30 bg-grade-f/10 text-grade-f',
}

export const gradeColor = (grade: string | null | undefined): string =>
  `${BADGE_BASE} ${GRADE_CLASS[grade ?? ''] || TONE_CLASS.neutral}`

export const outcomeColor = (outcome: string | null | undefined): string => {
  switch (outcome) {
    case 'APPROVE':
      return `${BADGE_BASE} ${TONE_CLASS.success}`
    case 'REVIEW':
      return `${BADGE_BASE} ${TONE_CLASS.warning}`
    case 'REJECT':
      return `${BADGE_BASE} ${TONE_CLASS.danger}`
    default:
      return `${BADGE_BASE} ${TONE_CLASS.neutral}`
  }
}

export const scoreColor = (score: number | null | undefined): string => {
  if (score == null) return 'text-subtle-foreground'
  return `text-grade-${scoreToGrade(score).toLowerCase()}`
}
