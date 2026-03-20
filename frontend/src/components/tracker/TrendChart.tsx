import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { useAppStore } from '../../store/appStore'
import { TrendControls } from './TrendControls'
import { Card } from '../shared/Card'
import { chartColors } from '../../theme/colors'
import { useMemo } from 'react'
import type { Entry } from '../../api/client'

function aggregateEntries(
  entries: Entry[],
  metric: string,
  aggregation: string
): { label: string; value: number }[] {
  const buckets = new Map<string, number[]>()

  for (const entry of entries) {
    const d = new Date(entry.timestamp)
    let key: string

    switch (aggregation) {
      case 'hour':
        key = d.toLocaleTimeString([], { hour: 'numeric' })
        break
      case 'day':
        key = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
        break
      case 'week': {
        const week = Math.ceil(d.getDate() / 7)
        key = `Week ${week}`
        break
      }
      case 'month':
        key = d.toLocaleDateString([], { month: 'short', year: '2-digit' })
        break
      default:
        key = d.toLocaleTimeString([], { hour: 'numeric' })
    }

    const val = (entry as unknown as Record<string, unknown>)[metric]
    if (val != null && typeof val === 'number' && val > 0) {
      const arr = buckets.get(key) ?? []
      arr.push(val)
      buckets.set(key, arr)
    }
  }

  return Array.from(buckets.entries()).map(([label, values]) => ({
    label,
    value: metric.includes('count')
      ? values.reduce((a, b) => a + b, 0)
      : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
  }))
}

export function TrendChart() {
  const { entries, trendMetric, compareMetric, aggregation } = useAppStore()

  const primaryData = useMemo(
    () => aggregateEntries(entries, trendMetric, aggregation),
    [entries, trendMetric, aggregation]
  )

  const compareData = useMemo(
    () => (compareMetric ? aggregateEntries(entries, compareMetric, aggregation) : []),
    [entries, compareMetric, aggregation]
  )

  // Merge primary and compare data
  const chartData = useMemo(() => {
    const merged = primaryData.map((d) => {
      const compare = compareData.find((c) => c.label === d.label)
      return { label: d.label, primary: d.value, compare: compare?.value ?? null }
    })
    return merged
  }, [primaryData, compareData])

  // Summary stats
  const summary = useMemo(() => {
    const values = primaryData.map((d) => d.value)
    if (values.length === 0) return null
    return {
      avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
      max: Math.max(...values),
      min: Math.min(...values),
      count: values.length,
    }
  }, [primaryData])

  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-widest text-dark mb-4">Trends</h2>

      <TrendControls />

      <Card className="mt-4" padding="md">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: chartColors.text }}
                axisLine={{ stroke: chartColors.grid }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: chartColors.text }}
                axisLine={{ stroke: chartColors.grid }}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: `1px solid ${chartColors.grid}`,
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="primary"
                stroke={chartColors.primary}
                strokeWidth={2}
                dot={{ r: 3, fill: chartColors.primary }}
                name={trendMetric.replace('_', ' ')}
              />
              {compareMetric && (
                <Line
                  type="monotone"
                  dataKey="compare"
                  stroke={chartColors.secondary}
                  strokeWidth={2}
                  dot={{ r: 3, fill: chartColors.secondary }}
                  name={compareMetric.replace('_', ' ')}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Summary strip */}
      {summary && (
        <div className="mt-3 bg-primary-500 text-white rounded-lg p-4 grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/70">Avg</p>
            <p className="text-lg font-bold">{summary.avg}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/70">Max</p>
            <p className="text-lg font-bold">{summary.max}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/70">Min</p>
            <p className="text-lg font-bold">{summary.min}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/70">Count</p>
            <p className="text-lg font-bold">{summary.count}</p>
          </div>
        </div>
      )}
    </div>
  )
}
