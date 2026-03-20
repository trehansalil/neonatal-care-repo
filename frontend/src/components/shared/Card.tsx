import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  accent?: 'left' | 'top' | 'none'
  accentColor?: 'primary' | 'accent' | 'muted'
  padding?: 'sm' | 'md' | 'lg'
}

const accentStyles = {
  left: {
    primary: 'border-l-4 border-l-primary-500',
    accent: 'border-l-4 border-l-accent-300',
    muted: 'border-l-4 border-l-muted',
  },
  top: {
    primary: 'border-t-4 border-t-primary-500',
    accent: 'border-t-4 border-t-accent-300',
    muted: 'border-t-4 border-t-muted',
  },
  none: { primary: '', accent: '', muted: '' },
}

const paddings = { sm: 'p-3', md: 'p-4', lg: 'p-6' }

export function Card({
  children,
  accent = 'none',
  accentColor = 'primary',
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-surface rounded-lg border border-border ${accentStyles[accent][accentColor]} ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
