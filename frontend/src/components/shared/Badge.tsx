import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'primary' | 'accent' | 'muted' | 'success' | 'danger'
  className?: string
}

const variants = {
  primary: 'bg-primary-100 text-primary-700',
  accent: 'bg-accent-100 text-accent-500',
  muted: 'bg-bg text-muted',
  success: 'bg-green-100 text-green-700',
  danger: 'bg-primary-100 text-primary-600',
}

export function Badge({ children, variant = 'primary', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase rounded-full ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
