import { scoreColor } from '../utils/format'

export function ScoreGauge({ score, grade }: { score: number | null | undefined; grade?: string | null }) {
  if (score == null) {
    return <div className="text-slate-400 text-sm">No score</div>
  }
  const min = 300
  const max = 900
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min)))
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(148 163 184 / 0.25)" strokeWidth="3" />
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
          <div className={`text-2xl font-bold leading-none ${scoreColor(score)}`}>{score}</div>
          {grade && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Grade {grade}</div>}
        </div>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        <div>Range: {min} - {max}</div>
        <div>Higher is better</div>
      </div>
    </div>
  )
}
