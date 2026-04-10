export function Sparkline({
  data,
  positive,
  width = 120,
  height = 40,
}: {
  data: number[]
  positive: boolean
  width?: number
  height?: number
}) {
  if (!data || data.length < 2) return <div style={{ width, height }} />

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const points = data.map((value, index) => {
    const x = pad + (index / (data.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (value - min) / range) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const color = positive ? '#22c55e' : '#ef4444'

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={`M ${points.join(' L ')}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
