import type { ReactNode } from 'react'
import { Card } from '../shared/Card'

interface MetricCardProps {
  icon: ReactNode
  title: string
  value: string
  subtitle?: string
  accent?: boolean
  children?: ReactNode
}

export function MetricCard({ icon, title, value, subtitle, accent, children }: MetricCardProps) {
  return (
    <Card accent="left" accentColor={accent ? 'primary' : 'accent'} padding="md">
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-0.5">{title}</p>
          <p className="text-2xl font-bold text-dark leading-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          {children}
        </div>
      </div>
    </Card>
  )
}
