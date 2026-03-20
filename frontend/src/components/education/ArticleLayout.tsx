import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageContainer } from '../layout/PageContainer'

interface ArticleLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  backTo?: string
  backLabel?: string
}

export function ArticleLayout({
  title,
  subtitle,
  children,
  backTo = '/',
  backLabel = 'Back',
}: ArticleLayoutProps) {
  return (
    <PageContainer>
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-dark transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </Link>

      <div className="bg-primary-500 text-white rounded-t-xl px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{title}</h1>
        <p className="mt-2 text-primary-100 text-base sm:text-lg">{subtitle}</p>
      </div>

      <div className="bg-surface rounded-b-xl border border-t-0 border-border px-6 py-8 sm:px-10 sm:py-10">
        <div className="space-y-10">{children}</div>
      </div>
    </PageContainer>
  )
}
