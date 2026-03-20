import { ClipboardList, LayoutDashboard, TrendingUp, BookOpen } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

const tabs = [
  { key: 'log' as const, label: 'Log', icon: ClipboardList },
  { key: 'dashboard' as const, label: 'Dash', icon: LayoutDashboard },
  { key: 'trends' as const, label: 'Trends', icon: TrendingUp },
  { key: 'guide' as const, label: 'Guide', icon: BookOpen },
]

export function BottomNav() {
  const { mobileTab, setMobileTab } = useAppStore()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40">
      <div className="flex">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMobileTab(key)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors cursor-pointer ${
              mobileTab === key ? 'text-primary-500' : 'text-muted'
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {label}
            </span>
            {mobileTab === key && (
              <div className="absolute bottom-0 h-0.5 w-12 bg-accent-300 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
