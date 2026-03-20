import type { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <main className={`flex-1 max-w-5xl mx-auto w-full px-4 py-6 pb-20 md:pb-6 ${className}`}>
      {children}
    </main>
  )
}
