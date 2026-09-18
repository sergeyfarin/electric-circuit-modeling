<script lang="ts">
  import type { SimulationResult } from '../circuit/types'

  export let result: SimulationResult
  export let meterId: string | null = null
  export let node = '0'
  export let label = 'Voltage'

  const width = 760
  const height = 210
  const padding = { left: 54, right: 20, top: 20, bottom: 34 }

  $: values = result.samples.map((sample) =>
    meterId ? (sample.meterReadings[meterId] ?? 0) : (sample.nodeVoltages[node] ?? 0),
  )
  $: minValue = Math.min(0, ...values)
  $: maxValue = Math.max(0.001, ...values)
  $: valueSpan = Math.max(0.001, maxValue - minValue)
  $: maxTime = result.samples.at(-1)?.time ?? 1
  $: points = result.samples
    .map((sample, index) => {
      const x = padding.left + (sample.time / maxTime) * (width - padding.left - padding.right)
      const y = padding.top + ((maxValue - values[index]) / valueSpan) * (height - padding.top - padding.bottom)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  function compact(value: number): string {
    return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2)
  }
</script>

<div class="chart" role="img" aria-label={`${label} from ${minValue.toFixed(2)} to ${maxValue.toFixed(2)} volts`}>
  <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
    <line x1={padding.left} x2={width - padding.right} y1={padding.top} y2={padding.top} class="guide" />
    <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} class="guide" />
    <line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} class="axis" />
    <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} class="axis" />
    <polyline {points} class="trace-glow" />
    <polyline {points} class="trace" />
    <text x="10" y={padding.top + 5} class="tick">{compact(maxValue)} V</text>
    <text x="10" y={height - padding.bottom + 5} class="tick">{compact(minValue)} V</text>
    <text x={padding.left} y={height - 10} class="tick">0 s</text>
    <text x={width - padding.right} y={height - 10} text-anchor="end" class="tick">{compact(maxTime)} s</text>
  </svg>
</div>

<style>
  .chart { height: 210px; min-width: 0; }
  svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .guide { stroke: #233138; stroke-width: 1; stroke-dasharray: 4 6; }
  .axis { stroke: #405159; stroke-width: 1; }
  .trace, .trace-glow { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .trace-glow { stroke: rgba(118, 230, 194, 0.18); stroke-width: 8; }
  .trace { stroke: #76e6c2; stroke-width: 2.5; }
  .tick { fill: #7f929a; font-size: 12px; font-family: var(--font-mono); }
</style>
