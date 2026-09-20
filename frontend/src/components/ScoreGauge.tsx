import { scoreColor } from '../utils/format'

export function ScoreGauge({ score, grade }: { score: number | null | undefined; grade?: string | null }) {
  if (score == null) {
    return <div className="text-on-surface-variant text-body-sm">No score</div>
  }
  const min = 300
  const max = 900
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min)))

  const getGradeColor = (s: number) => {
    if (s >= 800) return 'text-tertiary-container'
    if (s >= 700) return 'text-secondary'
    if (s >= 550) return 'text-on-surface'
    return 'text-error'
  }

  const getGradeBg = (s: number) => {
    if (s >= 800) return 'bg-tertiary-container/15 text-tertiary-container'
    if (s >= 700) return 'bg-secondary/15 text-secondary'
    if (s >= 550) return 'bg-surface-container text-on-surface'
    return 'bg-error-container text-error'
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${pct * 100} 100`}
              strokeLinecap="round"
              className={`${scoreColor(score)} transition-all duration-1000`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-2xl font-bold leading-none ${getGradeColor(score)}`}>{score}</div>
            {grade && (
              <span className={`mt-1 px-2 py-0.5 rounded-full text-mono-caption font-semibold ${getGradeBg(score)}`}>
                Grade {grade}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-mono-caption text-on-surface-variant">Range: {min} - {max}</span>
          <span className="text-mono-caption text-on-surface-variant">Higher is better</span>
        </div>
      </div>
    </div>
  )
}
