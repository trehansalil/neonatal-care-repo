import { Droplets, Timer, Thermometer, Weight } from 'lucide-react'
import { MetricCard } from './MetricCard'
import { ProgressBar } from '../shared/ProgressBar'
import { useStats } from '../../hooks/useStats'
import { useDiaperAlert } from '../../hooks/useDiaperAlert'
import { useEffect } from 'react'

const DAILY_FEED_TARGET = 400 // ml

export function DashboardMetrics() {
  const { stats, fetchStats } = useStats()
  const diaper = useDiaperAlert()

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const formatTime = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-widest text-dark mb-4">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Feed Volume */}
        <MetricCard
          icon={<span>🍼</span>}
          title="Feed Volume"
          value={`${stats?.total_feed_volume ?? 0}ml`}
          subtitle={`${stats?.feed_count ?? 0} feeds today`}
        >
          <ProgressBar
            value={stats?.total_feed_volume ?? 0}
            max={DAILY_FEED_TARGET}
            className="mt-2"
          />
        </MetricCard>

        {/* Diaper Timer */}
        <MetricCard
          icon={<Timer size={24} className={diaper.isOverdue ? 'text-primary-500' : 'text-accent-400'} />}
          title="Diaper Timer"
          value={formatTime(diaper.hoursSinceLastChange)}
          subtitle={diaper.lastChangeDescription ?? 'No data yet'}
          accent={diaper.isOverdue}
        />

        {/* Diapers Today */}
        <MetricCard
          icon={<Droplets size={24} className="text-accent-400" />}
          title="Diapers Today"
          value={`${(stats?.total_susu ?? 0) + (stats?.total_poti ?? 0)}`}
          subtitle={`💧 ${stats?.total_susu ?? 0} wet  💩 ${stats?.total_poti ?? 0} soiled`}
        />
      </div>

      {/* Vitals row */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <MetricCard
          icon={<Thermometer size={24} className="text-muted" />}
          title="Temperature"
          value={stats?.avg_temperature ? `${stats.avg_temperature.toFixed(1)}°C` : '--'}
          subtitle={
            stats?.max_temperature
              ? `Range: ${stats.min_temperature?.toFixed(1)} - ${stats.max_temperature?.toFixed(1)}°C`
              : undefined
          }
        />
        <MetricCard
          icon={<Weight size={24} className="text-muted" />}
          title="Latest Weight"
          value={stats?.latest_weight ? `${(stats.latest_weight / 1000).toFixed(2)}kg` : '--'}
        />
      </div>
    </div>
  )
}
