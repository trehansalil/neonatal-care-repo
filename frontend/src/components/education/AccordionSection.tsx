import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface AccordionSectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  number?: number
}

export function AccordionSection({
  title,
  children,
  defaultOpen = false,
  number,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-4 bg-surface hover:bg-primary-50/40 transition-colors cursor-pointer"
      >
        {number !== undefined && (
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center">
            {number}
          </span>
        )}
        <span className="flex-1 text-left font-semibold text-dark">{title}</span>
        <ChevronDown
          className={`w-5 h-5 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-2 text-sm text-dark leading-relaxed space-y-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
