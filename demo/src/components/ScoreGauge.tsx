import { cn } from '../utils/cn'
import { gradeColor, scoreColor, scoreToGrade } from '../utils/format'

export function ScoreGauge({ score, grade }: { score: number | null | undefined; grade?: string | null }) {
  if (score == null) {
    return (
      <div className="grid h-24 w-24 place-items-center rounded-full border border-dashed border-border text-center text-[11px] leading-tight text-subtle-foreground">
        No score
      </div>
    )
  }

  const min = 300
  const max = 900
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min)))
  const g = (grade || scoreToGrade(score)).toUpperCase()

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" className="stroke-muted" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            strokeWidth="3.2"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={`${pct * 100} 100`}
            className={cn('transition-all duration-1000', scoreColor(score))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-bold leading-none tabular-nums text-foreground">{score}</div>
          <span className={cn('mt-1.5', gradeColor(g))}>{g}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="font-mono text-[11px] text-subtle-foreground">
          {min}–{max}
        </span>
        <span>Higher is better</span>
      </div>
    </div>
  )
}
