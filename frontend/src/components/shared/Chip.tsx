interface ChipProps {
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export function Chip({ label, active = false, onClick, className = '' }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors cursor-pointer ${
        active
          ? 'bg-accent-300 text-dark'
          : 'bg-surface text-muted border border-border hover:border-primary-300 hover:text-dark'
      } ${className}`}
    >
      {label}
    </button>
  )
}
