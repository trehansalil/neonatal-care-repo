import { Chip } from '../shared/Chip'
import { useAppStore, type Aggregation } from '../../store/appStore'

const metrics = [
  { key: 'feed_amount', label: 'Feed Volume' },
  { key: 'susu_count', label: 'Wet Diapers' },
  { key: 'poti_count', label: 'Soiled Diapers' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'weight', label: 'Weight' },
]

const aggregations: { key: Aggregation; label: string }[] = [
  { key: 'hour', label: 'Hour' },
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

export function TrendControls() {
  const { trendMetric, setTrendMetric, compareMetric, setCompareMetric, aggregation, setAggregation } =
    useAppStore()

  return (
    <div className="space-y-4">
      {/* Metric selector */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
          Metric
        </label>
        <div className="flex gap-2">
          <select
            value={trendMetric}
            onChange={(e) => setTrendMetric(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-surface text-dark"
          >
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="text-muted text-sm self-center">vs</span>
          <select
            value={compareMetric ?? ''}
            onChange={(e) => setCompareMetric(e.target.value || null)}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-surface text-dark"
          >
            <option value="">None</option>
            {metrics
              .filter((m) => m.key !== trendMetric)
              .map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Aggregation */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
          Aggregation
        </label>
        <div className="flex gap-2">
          {aggregations.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              active={aggregation === key}
              onClick={() => setAggregation(key)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
