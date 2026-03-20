interface WaveformVisualizerProps {
  data: number[]
  active?: boolean
}

export function WaveformVisualizer({ data, active = false }: WaveformVisualizerProps) {
  return (
    <div className="flex items-end justify-center gap-1 h-12">
      {data.map((level, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full transition-all duration-150 ${
            active ? 'bg-white/80' : 'bg-white/30'
          }`}
          style={{
            height: `${Math.max(4, level * 48)}px`,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  )
}
