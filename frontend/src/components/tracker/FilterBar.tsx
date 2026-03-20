import { Chip } from '../shared/Chip'
import { useAppStore, type EntryType, type TimeRange } from '../../store/appStore'

const entryTypes: { key: EntryType; label: string }[] = [
  { key: 'feed', label: '🍼 Feed' },
  { key: 'susu', label: '💧 Susu' },
  { key: 'poti', label: '💩 Poti' },
  { key: 'temperature', label: '🌡️ Temp' },
  { key: 'weight', label: '⚖️ Weight' },
  { key: 'speech', label: '🎙️ Speech' },
]

const timeRanges: { key: TimeRange; label: string }[] = [
  { key: '6h', label: '6h' },
  { key: '12h', label: '12h' },
  { key: 'today', label: 'Today' },
  { key: '24h', label: '24h' },
  { key: 'week', label: 'Week' },
]

export function FilterBar() {
  const { activeFilters, toggleFilter, timeRange, setTimeRange } = useAppStore()

  return (
    <div className="space-y-3">
      {/* Time range */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {timeRanges.map(({ key, label }) => (
          <Chip
            key={key}
            label={label}
            active={timeRange === key}
            onClick={() => setTimeRange(key)}
          />
        ))}
      </div>

      {/* Type filters */}
      <div className="flex gap-2 flex-wrap">
        {entryTypes.map(({ key, label }) => (
          <Chip
            key={key}
            label={label}
            active={activeFilters.includes(key)}
            onClick={() => toggleFilter(key)}
          />
        ))}
      </div>
    </div>
  )
}
