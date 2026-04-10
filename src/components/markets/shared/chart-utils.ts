import type { MarketChart } from '@/types/market'

export function buildMovingAverage(points: MarketChart['points'], period: number) {
  return points.map((_, index) => {
    if (index < period - 1) return null
    const slice = points.slice(index - period + 1, index + 1).map((p) => p.close)
    return slice.reduce((sum, v) => sum + v, 0) / period
  })
}

export function buildLinePath(values: Array<number | null>, maxValue: number, minValue: number) {
  const range = maxValue - minValue || 1
  const coords = values
    .map((value, index) => {
      if (value === null) return null
      const x = (index / Math.max(values.length - 1, 1)) * 100
      const y = ((maxValue - value) / range) * 100
      return { x, y, value }
    })
    .filter((item): item is { x: number; y: number; value: number } => item !== null)

  return coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}
