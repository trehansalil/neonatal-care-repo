import { useAppStore } from '../../store/appStore'

const quickButtons = [
  { key: 'feed', icon: '🍼', label: 'Feed' },
  { key: 'susu', icon: '💧', label: 'Susu' },
  { key: 'poti', icon: '💩', label: 'Poti' },
  { key: 'temp', icon: '🌡️', label: 'Temp' },
  { key: 'weight', icon: '⚖️', label: 'Weight' },
  { key: 'speechLog', icon: '📋', label: 'Log' },
]

export function QuickAdd() {
  const { openModal } = useAppStore()

  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-widest text-dark mb-3">Quick Add</h2>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
        {quickButtons.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => openModal(key)}
            className="flex flex-col items-center gap-1 p-3 bg-surface border border-border rounded-lg hover:border-primary-300 active:bg-primary-50 transition-colors cursor-pointer"
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-xs font-semibold text-muted uppercase">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
