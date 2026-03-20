interface ProgressBarProps {
  value: number
  max: number
  label?: string
  className?: string
}

export function ProgressBar({ value, max, label, className = '' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted">{label}</span>
          <span className="font-semibold text-dark">
            {value}/{max}ml
          </span>
        </div>
      )}
      <div className="h-2.5 bg-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-300 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
