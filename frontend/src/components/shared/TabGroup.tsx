interface Tab {
  key: string
  label: string
}

interface TabGroupProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
  className?: string
}

export function TabGroup({ tabs, active, onChange, className = '' }: TabGroupProps) {
  return (
    <div className={`flex border-b border-border ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors cursor-pointer ${
            active === tab.key
              ? 'text-primary-500 border-b-2 border-primary-500'
              : 'text-muted hover:text-dark'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
