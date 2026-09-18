<script lang="ts">
  import type { Circuit, CircuitComponent } from '../circuit/types'

  export let circuit: Circuit
  export let selectedId: string | null = null
  export let onselect: (id: string) => void = () => undefined

  $: width = Math.max(760, circuit.components.length * 116 + 150)
  $: height = Math.max(300, circuit.nodes.length * 68 + 70)

  function nodeY(node: string): number {
    const index = circuit.nodes.indexOf(node)
    return 54 + Math.max(0, index) * 68
  }

  function terminals(component: CircuitComponent): [string, string] {
    if (component.type === 'battery') return [component.positive, component.negative]
    if (component.type === 'transistor') return [component.collector, component.emitter]
    return [component.nodeA, component.nodeB]
  }

  function resistorPath(x: number, y: number): string {
    return `M ${x - 18} ${y} l 5 -8 l 7 16 l 7 -16 l 7 16 l 7 -16 l 5 8`
  }
</script>

<div class="schematic-scroll" role="region" aria-label="Circuit schematic">
  <svg viewBox={`0 0 ${width} ${height}`} style={`min-width:${width}px`} aria-label={`${circuit.name} schematic`}>
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" class="grid-line" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />

    {#each circuit.nodes as node}
      <g class:ground={node === '0'}>
        <line x1="54" x2={width - 30} y1={nodeY(node)} y2={nodeY(node)} class="node-rail" />
        <circle cx="54" cy={nodeY(node)} r="5" class="node-dot" />
        <text x="42" y={nodeY(node) + 5} text-anchor="end" class="node-label">{node === '0' ? 'GND' : node}</text>
      </g>
    {/each}

    {#each circuit.components as component, index (component.id)}
      {@const x = 104 + index * 116}
      {@const pair = terminals(component)}
      {@const y1 = nodeY(pair[0])}
      {@const y2 = nodeY(pair[1])}
      {@const middle = (y1 + y2) / 2}
      <g
        class="component"
        class:selected={component.id === selectedId}
        role="button"
        tabindex="0"
        aria-label={`Select ${component.name}`}
        onclick={() => onselect(component.id)}
        onkeydown={(event) => (event.key === 'Enter' || event.key === ' ') && onselect(component.id)}
      >
        <line x1={x} x2={x} y1={Math.min(y1, y2)} y2={Math.max(y1, y2)} class="component-wire" />
        <circle cx={x} cy={y1} r="4" class="terminal" />
        <circle cx={x} cy={y2} r="4" class="terminal" />

        {#if component.type === 'resistor'}
          <rect x={x - 28} y={middle - 14} width="56" height="28" rx="4" class="symbol-bg" />
          <path d={resistorPath(x - 20, middle)} class="symbol-stroke" />
        {:else if component.type === 'capacitor'}
          <rect x={x - 25} y={middle - 18} width="50" height="36" rx="4" class="symbol-bg" />
          <line x1={x - 14} x2={x + 14} y1={middle - 5} y2={middle - 5} class="symbol-stroke" />
          <line x1={x - 14} x2={x + 14} y1={middle + 5} y2={middle + 5} class="symbol-stroke" />
        {:else if component.type === 'battery'}
          <rect x={x - 25} y={middle - 20} width="50" height="40" rx="4" class="symbol-bg" />
          <line x1={x - 15} x2={x + 15} y1={middle - 6} y2={middle - 6} class="symbol-stroke strong" />
          <line x1={x - 9} x2={x + 9} y1={middle + 6} y2={middle + 6} class="symbol-stroke" />
        {:else if component.type === 'voltmeter'}
          <circle cx={x} cy={middle} r="20" class="symbol-bg meter" />
          <text x={x} y={middle + 6} text-anchor="middle" class="symbol-letter">V</text>
        {:else}
          <circle cx={x} cy={middle} r="22" class="symbol-bg transistor" />
          <line x1={x - 7} x2={x - 7} y1={middle - 12} y2={middle + 12} class="symbol-stroke" />
          <line x1={x - 7} x2={x + 10} y1={middle - 7} y2={middle - 15} class="symbol-stroke" />
          <line x1={x - 7} x2={x + 10} y1={middle + 7} y2={middle + 15} class="symbol-stroke" />
          <line x1={x - 34} x2={x - 7} y1={nodeY(component.base)} y2={middle} class="component-wire" />
          <circle cx={x - 34} cy={nodeY(component.base)} r="4" class="terminal" />
        {/if}

        <rect x={x - 38} y={middle + 26} width="76" height="19" rx="9" class="name-pill" />
        <text x={x} y={middle + 40} text-anchor="middle" class="component-name">{component.name}</text>
      </g>
    {/each}

    {#if circuit.components.length === 0}
      <text x={width / 2} y={height / 2 - 5} text-anchor="middle" class="empty-title">The board is ready</text>
      <text x={width / 2} y={height / 2 + 22} text-anchor="middle" class="empty-copy">Add a component from the palette.</text>
    {/if}
  </svg>
</div>

<style>
  .schematic-scroll { overflow: auto; height: 100%; min-height: 300px; background: #0b1115; }
  svg { display: block; width: 100%; height: 100%; min-height: 300px; }
  .grid-line { fill: none; stroke: #17232a; stroke-width: 1; }
  .node-rail { stroke: #33454d; stroke-width: 1.5; }
  .node-dot, .terminal { fill: #76e6c2; stroke: #0b1115; stroke-width: 2; }
  .ground .node-rail { stroke: #44535a; }
  .ground .node-dot { fill: #a8b4b9; }
  .node-label { fill: #7f929a; font-size: 12px; font-family: var(--font-mono); }
  .component { cursor: pointer; outline: none; }
  .component-wire { stroke: #a9bbc1; stroke-width: 2; }
  .symbol-bg { fill: #101a1f; stroke: #8aa0a8; stroke-width: 1.5; }
  .symbol-stroke { fill: none; stroke: #d9e4e7; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .symbol-stroke.strong { stroke-width: 3; }
  .symbol-letter { fill: #d9e4e7; font-size: 16px; font-weight: 700; }
  .meter { stroke: #f4c95d; }
  .transistor { stroke: #9fa8ff; }
  .name-pill { fill: #19252b; stroke: #2c3c43; }
  .component-name { fill: #afbec4; font-size: 11px; font-family: var(--font-mono); }
  .component:hover .symbol-bg, .component:focus-visible .symbol-bg, .component.selected .symbol-bg { stroke: #76e6c2; stroke-width: 2.5; }
  .component.selected .name-pill { fill: #15372e; stroke: #76e6c2; }
  .empty-title { fill: #dbe6e9; font-size: 18px; font-weight: 650; }
  .empty-copy { fill: #788b93; font-size: 14px; }
</style>
