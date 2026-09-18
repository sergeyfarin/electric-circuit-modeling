<script lang="ts">
  import type { Circuit, CircuitComponent, ComponentType, Position } from '../circuit/types'

  export let circuit: Circuit
  export let selectedId: string | null = null
  export let onselect: (id: string) => void = () => undefined
  export let onmove: (id: string, position: Position) => void = () => undefined
  export let onadd: (type: ComponentType, position: Position) => void = () => undefined

  let viewport: HTMLDivElement
  let board: SVGSVGElement
  let isPanning = false
  let isDropTarget = false
  let interaction:
    | { kind: 'component'; pointerId: number; id: string; offsetX: number; offsetY: number }
    | { kind: 'pan'; pointerId: number; clientX: number; clientY: number; scrollLeft: number; scrollTop: number }
    | null = null

  $: width = Math.max(1_200, 300 + Math.ceil(circuit.components.length / 2) * 180)
  $: height = Math.max(650, circuit.nodes.length * 76 + 100)

  const componentTypes: ComponentType[] = ['resistor', 'capacitor', 'battery', 'voltmeter', 'transistor']

  function nodeY(node: string): number {
    const index = circuit.nodes.indexOf(node)
    return 72 + Math.max(0, index) * 72
  }

  function terminals(component: CircuitComponent): [string, string] {
    if (component.type === 'battery') return [component.positive, component.negative]
    if (component.type === 'transistor') return [component.collector, component.emitter]
    return [component.nodeA, component.nodeB]
  }

  function positionOf(component: CircuitComponent, index: number): Position {
    if (component.position) return component.position
    const [nodeA, nodeB] = terminals(component)
    const naturalY = (nodeY(nodeA) + nodeY(nodeB)) / 2
    return {
      x: 250 + (index % 5) * 170,
      y: Math.max(100, Math.min(height - 90, naturalY + Math.floor(index / 5) * 150)),
    }
  }

  function toBoardPoint(clientX: number, clientY: number): Position {
    const point = board.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const matrix = board.getScreenCTM()
    if (!matrix) return { x: 250, y: 150 }
    const transformed = point.matrixTransform(matrix.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  function clampPosition(position: Position): Position {
    return {
      x: Math.max(175, Math.min(width - 65, Math.round(position.x / 10) * 10)),
      y: Math.max(65, Math.min(height - 70, Math.round(position.y / 10) * 10)),
    }
  }

  function startComponentDrag(event: PointerEvent, component: CircuitComponent, index: number) {
    event.stopPropagation()
    event.preventDefault()
    const point = toBoardPoint(event.clientX, event.clientY)
    const position = positionOf(component, index)
    interaction = {
      kind: 'component',
      pointerId: event.pointerId,
      id: component.id,
      offsetX: point.x - position.x,
      offsetY: point.y - position.y,
    }
    onselect(component.id)
    board.setPointerCapture(event.pointerId)
  }

  function startPan(event: PointerEvent) {
    if (event.button !== 0) return
    interaction = {
      kind: 'pan',
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    }
    isPanning = true
    board.setPointerCapture(event.pointerId)
  }

  function continueInteraction(event: PointerEvent) {
    if (!interaction || interaction.pointerId !== event.pointerId) return
    if (interaction.kind === 'component') {
      const point = toBoardPoint(event.clientX, event.clientY)
      onmove(
        interaction.id,
        clampPosition({ x: point.x - interaction.offsetX, y: point.y - interaction.offsetY }),
      )
      return
    }

    viewport.scrollLeft = interaction.scrollLeft - (event.clientX - interaction.clientX)
    viewport.scrollTop = interaction.scrollTop - (event.clientY - interaction.clientY)
  }

  function finishInteraction(event: PointerEvent) {
    if (!interaction || interaction.pointerId !== event.pointerId) return
    if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId)
    interaction = null
    isPanning = false
  }

  function moveWithKeyboard(event: KeyboardEvent, component: CircuitComponent, index: number) {
    const offsets: Record<string, Position> = {
      ArrowLeft: { x: -10, y: 0 },
      ArrowRight: { x: 10, y: 0 },
      ArrowUp: { x: 0, y: -10 },
      ArrowDown: { x: 0, y: 10 },
    }
    const offset = offsets[event.key]
    if (!offset) {
      if (event.key === 'Enter' || event.key === ' ') onselect(component.id)
      return
    }
    event.preventDefault()
    const current = positionOf(component, index)
    onmove(component.id, clampPosition({ x: current.x + offset.x, y: current.y + offset.y }))
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    isDropTarget = true
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    isDropTarget = false
    const type = event.dataTransfer?.getData('application/x-circuit-component') as ComponentType
    if (!componentTypes.includes(type)) return
    onadd(type, clampPosition(toBoardPoint(event.clientX, event.clientY)))
  }

  function wirePath(node: string, terminalX: number, terminalY: number, lane: number): string {
    const elbowX = 132 + lane * 8
    return `M 108 ${nodeY(node)} H ${elbowX} V ${terminalY} H ${terminalX}`
  }

  function resistorPath(): string {
    return 'M 0 -24 l -8 5 l 16 7 l -16 7 l 16 7 l -16 7 l 8 5'
  }
</script>

<div
  bind:this={viewport}
  class="schematic-scroll"
  class:panning={isPanning}
  class:drop-target={isDropTarget}
  role="region"
  aria-label="Draggable circuit schematic"
  ondragover={handleDragOver}
  ondragleave={() => (isDropTarget = false)}
  ondrop={handleDrop}
>
  <svg
    bind:this={board}
    role="application"
    viewBox={`0 0 ${width} ${height}`}
    style={`width:${width}px;height:${height}px`}
    aria-label={`${circuit.name} schematic. Drag components to move them and drag empty space to pan.`}
    onpointerdown={startPan}
    onpointermove={continueInteraction}
    onpointerup={finishInteraction}
    onpointercancel={finishInteraction}
  >
    <defs>
      <pattern id="minor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" class="grid-line" />
      </pattern>
      <pattern id="major-grid" width="100" height="100" patternUnits="userSpaceOnUse">
        <rect width="100" height="100" fill="url(#minor-grid)" />
        <path d="M 100 0 L 0 0 0 100" class="major-grid-line" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#major-grid)" class="board-background" />

    <g class="gesture-hint" pointer-events="none">
      <rect x="148" y="18" width="210" height="27" rx="13" />
      <text x="163" y="36">Drag parts · drag board to pan</text>
    </g>

    <g class="node-bank" pointer-events="none">
      <rect x="16" y="34" width="112" height={Math.max(86, circuit.nodes.length * 72 + 34)} rx="10" />
      <text x="34" y="58" class="bank-title">NODES</text>
      {#each circuit.nodes as node}
        <g class:ground={node === '0'}>
          <line x1="54" x2="108" y1={nodeY(node)} y2={nodeY(node)} class="node-rail" />
          <circle cx="108" cy={nodeY(node)} r="5" class="node-dot" />
          <text x="48" y={nodeY(node) + 5} text-anchor="end" class="node-label">{node === '0' ? 'GND' : node}</text>
        </g>
      {/each}
    </g>

    {#each circuit.components as component, index (component.id)}
      {@const position = positionOf(component, index)}
      {@const pair = terminals(component)}
      <g class="wires" pointer-events="none">
        <path d={wirePath(pair[0], position.x, position.y - 34, index % 6)} class="connection-wire" />
        <path d={wirePath(pair[1], position.x, position.y + 34, (index + 2) % 6)} class="connection-wire" />
        {#if component.type === 'transistor'}
          <path d={wirePath(component.base, position.x - 31, position.y, (index + 4) % 6)} class="connection-wire base-wire" />
        {/if}
      </g>

      <g
        transform={`translate(${position.x} ${position.y})`}
        class="component"
        class:selected={component.id === selectedId}
        class:dragging={interaction?.kind === 'component' && interaction.id === component.id}
        role="button"
        tabindex="0"
        aria-label={`Move ${component.name}. Use arrow keys for precise movement.`}
        onpointerdown={(event) => startComponentDrag(event, component, index)}
        onkeydown={(event) => moveWithKeyboard(event, component, index)}
      >
        <circle cx="0" cy="-34" r="5" class="terminal" />
        <circle cx="0" cy="34" r="5" class="terminal" />
        <line x1="0" x2="0" y1="-34" y2="-24" class="component-wire" />
        <line x1="0" x2="0" y1="24" y2="34" class="component-wire" />

        {#if component.type === 'resistor'}
          <rect x="-18" y="-27" width="36" height="54" rx="5" class="symbol-bg" />
          <path d={resistorPath()} class="symbol-stroke" />
        {:else if component.type === 'capacitor'}
          <rect x="-24" y="-23" width="48" height="46" rx="5" class="symbol-bg" />
          <line x1="-14" x2="14" y1="-5" y2="-5" class="symbol-stroke" />
          <line x1="-14" x2="14" y1="5" y2="5" class="symbol-stroke" />
        {:else if component.type === 'battery'}
          <rect x="-25" y="-24" width="50" height="48" rx="5" class="symbol-bg" />
          <line x1="-15" x2="15" y1="-7" y2="-7" class="symbol-stroke strong" />
          <line x1="-9" x2="9" y1="7" y2="7" class="symbol-stroke" />
        {:else if component.type === 'voltmeter'}
          <circle cx="0" cy="0" r="23" class="symbol-bg meter" />
          <text x="0" y="6" text-anchor="middle" class="symbol-letter">V</text>
        {:else}
          <circle cx="0" cy="0" r="24" class="symbol-bg transistor" />
          <line x1="-7" x2="-7" y1="-13" y2="13" class="symbol-stroke" />
          <line x1="-7" x2="11" y1="-7" y2="-16" class="symbol-stroke" />
          <line x1="-7" x2="11" y1="7" y2="16" class="symbol-stroke" />
          <line x1="-31" x2="-7" y1="0" y2="0" class="component-wire" />
          <circle cx="-31" cy="0" r="5" class="terminal base-terminal" />
        {/if}

        <rect x="-42" y="43" width="84" height="21" rx="10" class="name-pill" />
        <text x="0" y="58" text-anchor="middle" class="component-name">{component.name}</text>
      </g>
    {/each}

    {#if circuit.components.length === 0}
      <g class="empty-board" pointer-events="none">
        <rect x="390" y="215" width="420" height="150" rx="16" />
        <text x="600" y="275" text-anchor="middle" class="empty-title">Drop your first component here</text>
        <text x="600" y="306" text-anchor="middle" class="empty-copy">Drag from the palette, then connect it using node selectors.</text>
        <text x="600" y="332" text-anchor="middle" class="empty-copy">Clicking a palette item also adds it automatically.</text>
      </g>
    {/if}

    {#if isDropTarget}
      <rect x="142" y="10" width={width - 152} height={height - 20} rx="14" class="drop-outline" pointer-events="none" />
    {/if}
  </svg>
</div>

<style>
  .schematic-scroll { overflow: auto; height: 100%; min-height: 300px; background: #0b1115; cursor: grab; overscroll-behavior: contain; }
  .schematic-scroll.panning { cursor: grabbing; user-select: none; }
  svg { display: block; min-width: 100%; min-height: 100%; touch-action: none; }
  .grid-line { fill: none; stroke: #17232a; stroke-width: 1; }
  .major-grid-line { fill: none; stroke: #1e2b31; stroke-width: 1; }
  .gesture-hint rect { fill: #142026; stroke: #2d3c43; }
  .gesture-hint text { fill: #758991; font: 11px var(--font-mono); }
  .node-bank > rect { fill: rgba(13, 21, 25, .94); stroke: #2a3940; }
  .bank-title { fill: #596c74; font: 600 9px var(--font-mono); letter-spacing: .12em; }
  .node-rail { stroke: #52646c; stroke-width: 2; }
  .node-dot, .terminal { fill: #76e6c2; stroke: #0b1115; stroke-width: 2; }
  .ground .node-rail { stroke: #66767c; }
  .ground .node-dot { fill: #a8b4b9; }
  .node-label { fill: #91a1a7; font-size: 11px; font-family: var(--font-mono); }
  .connection-wire { fill: none; stroke: #50636b; stroke-width: 1.5; stroke-linejoin: round; }
  .base-wire { stroke: #777fb4; }
  .component { cursor: grab; outline: none; }
  .component.dragging { cursor: grabbing; }
  .component-wire { stroke: #c0cdd1; stroke-width: 2; }
  .symbol-bg { fill: #101a1f; stroke: #8aa0a8; stroke-width: 1.5; filter: drop-shadow(0 5px 8px rgba(0, 0, 0, .35)); }
  .symbol-stroke { fill: none; stroke: #d9e4e7; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .symbol-stroke.strong { stroke-width: 3; }
  .symbol-letter { fill: #d9e4e7; font-size: 16px; font-weight: 700; pointer-events: none; }
  .meter { stroke: #f4c95d; }
  .transistor { stroke: #9fa8ff; }
  .name-pill { fill: #19252b; stroke: #2c3c43; }
  .component-name { fill: #afbec4; font-size: 11px; font-family: var(--font-mono); pointer-events: none; }
  .component:hover .symbol-bg, .component:focus-visible .symbol-bg, .component.selected .symbol-bg { stroke: #76e6c2; stroke-width: 2.5; }
  .component.selected .name-pill { fill: #15372e; stroke: #76e6c2; }
  .component.dragging .symbol-bg { filter: drop-shadow(0 9px 14px rgba(0, 0, 0, .55)); }
  .empty-board > rect { fill: rgba(16, 26, 31, .88); stroke: #314148; stroke-dasharray: 6 7; }
  .empty-title { fill: #dbe6e9; font-size: 18px; font-weight: 650; }
  .empty-copy { fill: #788b93; font-size: 12px; }
  .drop-outline { fill: rgba(118, 230, 194, .035); stroke: #76e6c2; stroke-width: 2; stroke-dasharray: 8 7; }
  .drop-target { box-shadow: inset 0 0 30px rgba(118, 230, 194, .08); }
</style>
