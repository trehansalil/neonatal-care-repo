interface SectionCardProps {
  icon: string
  title: string
  description: string
  className?: string
}

export function SectionCard({ icon, title, description, className = '' }: SectionCardProps) {
  return (
    <div className={`flex items-start gap-4 ${className}`}>
      <div className="flex-shrink-0 w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center text-xl">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-dark">{title}</h3>
        <p className="text-muted text-sm mt-1">{description}</p>
      </div>
    </div>
  )
}
