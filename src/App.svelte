<script lang="ts">
  import {
    Battery,
    CircuitBoard,
    Cpu,
    Gauge,
    Info,
    Plus,
    RotateCcw,
    Trash2,
    Waves,
    Zap,
  } from '@lucide/svelte'
  import CircuitCanvas from './lib/components/CircuitCanvas.svelte'
  import Waveform from './lib/components/Waveform.svelte'
  import { clonePreset, presets } from './lib/circuit/presets'
  import { simulateCircuit } from './lib/circuit/solver'
  import type { CircuitComponent, ComponentType, SimulationResult } from './lib/circuit/types'

  let circuit = clonePreset('divider')
  let selectedId: string | null = circuit.components[0]?.id ?? null
  let probeKey = 'meter:meter-1'
  let newNodeName = ''
  let idCounter = 0
  let result: SimulationResult | null = null
  let simulationError = ''

  $: selectedComponent = circuit.components.find((item) => item.id === selectedId) ?? null
  $: meters = circuit.components.filter((item) => item.type === 'voltmeter')
  $: {
    try {
      result = simulateCircuit(circuit)
      simulationError = ''
    } catch (error) {
      result = null
      simulationError = error instanceof Error ? error.message : 'The circuit could not be solved.'
    }
  }
  $: probeType = probeKey.startsWith('meter:') ? 'meter' : 'node'
  $: probeId = probeKey.slice(probeKey.indexOf(':') + 1)
  $: probeLabel =
    probeType === 'meter'
      ? (meters.find((item) => item.id === probeId)?.name ?? 'Meter')
      : `${probeId} node`
  $: finalReading = result
    ? probeType === 'meter'
      ? (result.final.meterReadings[probeId] ?? 0)
      : (result.final.nodeVoltages[probeId] ?? 0)
    : null

  function eventValue(event: Event): string {
    return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value
  }

  function eventNumber(event: Event): number {
    return Number(eventValue(event))
  }

  function loadPreset(id: string) {
    circuit = clonePreset(id)
    selectedId = circuit.components[0]?.id ?? null
    const firstMeter = circuit.components.find((item) => item.type === 'voltmeter')
    probeKey = firstMeter ? `meter:${firstMeter.id}` : `node:${circuit.nodes[1] ?? '0'}`
  }

  function updateCircuit(patch: Partial<typeof circuit>) {
    circuit = { ...circuit, ...patch }
  }

  function updateSelected(patch: Record<string, string | number | null>) {
    if (!selectedId) return
    circuit = {
      ...circuit,
      components: circuit.components.map((item) =>
        item.id === selectedId ? ({ ...item, ...patch } as CircuitComponent) : item,
      ),
    }
  }

  function nextId(type: ComponentType): string {
    idCounter += 1
    return `${type}-${Date.now().toString(36)}-${idCounter}`
  }

  function nextName(prefix: string): string {
    const count = circuit.components.filter((item) => item.name.startsWith(prefix)).length + 1
    return `${prefix}${count}`
  }

  function addComponent(type: ComponentType) {
    const nodeA = circuit.nodes.find((node) => node !== '0') ?? '0'
    const nodeB = '0'
    const id = nextId(type)
    let component: CircuitComponent

    if (type === 'resistor') {
      component = { id, type, name: nextName('R'), nodeA, nodeB, resistance: 1_000 }
    } else if (type === 'capacitor') {
      component = { id, type, name: nextName('C'), nodeA, nodeB, capacitance: 0.000001, initialVoltage: 0 }
    } else if (type === 'battery') {
      component = { id, type, name: nextName('B'), positive: nodeA, negative: nodeB, voltage: 5, internalResistance: 1 }
    } else if (type === 'voltmeter') {
      component = { id, type, name: nextName('VM'), nodeA, nodeB, resistance: null }
      probeKey = `meter:${id}`
    } else {
      let nodes = circuit.nodes
      const added: string[] = []
      while (nodes.length + added.length < 4) added.push(`n${nodes.length + added.length}`)
      if (added.length) nodes = [...nodes, ...added]
      component = {
        id,
        type,
        name: nextName('Q'),
        collector: nodes[1],
        base: nodes[2],
        emitter: '0',
        threshold: 0.7,
        onResistance: 20,
        offResistance: 1_000_000_000,
        baseResistance: 100_000,
      }
      circuit = { ...circuit, nodes }
    }

    circuit = { ...circuit, components: [...circuit.components, component] }
    selectedId = id
  }

  function removeComponent(id: string) {
    const remaining = circuit.components.filter((item) => item.id !== id)
    circuit = { ...circuit, components: remaining }
    selectedId = remaining[0]?.id ?? null
    if (probeKey === `meter:${id}`) probeKey = `node:${circuit.nodes[1] ?? '0'}`
  }

  function addNode() {
    const clean = newNodeName.trim().replace(/\s+/g, '_')
    if (!clean || clean === '0' || circuit.nodes.includes(clean)) return
    circuit = { ...circuit, nodes: [...circuit.nodes, clean] }
    newNodeName = ''
  }

  function formatVoltage(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '—'
    if (Math.abs(value) < 0.001) return `${(value * 1_000_000).toFixed(1)} µV`
    if (Math.abs(value) < 1) return `${(value * 1_000).toFixed(1)} mV`
    return `${value.toFixed(3)} V`
  }

  function componentSummary(component: CircuitComponent): string {
    if (component.type === 'resistor') return `${component.resistance.toLocaleString()} Ω`
    if (component.type === 'capacitor') return `${(component.capacitance * 1_000_000).toLocaleString()} µF`
    if (component.type === 'battery') return `${component.voltage} V · ${component.internalResistance} Ω internal`
    if (component.type === 'voltmeter') return component.resistance === null ? 'Ideal input' : `${component.resistance.toLocaleString()} Ω input`
    return `${component.threshold} V threshold`
  }
</script>

<svelte:head>
  <title>Circuit Lab — simple electric circuit modeling</title>
  <meta name="description" content="Build and simulate simple resistor, capacitor, battery, transistor, and voltmeter circuits in the browser." />
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <div class="brand">
      <span class="brand-mark"><CircuitBoard size={22} strokeWidth={1.8} /></span>
      <div>
        <strong>Circuit Lab</strong>
        <span>browser workbench</span>
      </div>
    </div>

    <div class="preset-control">
      <label for="preset">Circuit</label>
      <select id="preset" value={circuit.id} onchange={(event) => loadPreset(eventValue(event))}>
        {#each presets as preset}
          <option value={preset.id}>{preset.name}</option>
        {/each}
      </select>
    </div>

    <div class="topbar-actions">
      <span class:failed={Boolean(simulationError)} class="solver-status">
        <span class="status-light"></span>
        {simulationError ? 'Needs attention' : 'Solved locally'}
      </span>
      <button class="quiet-button" onclick={() => loadPreset(circuit.id)} title="Reset this preset">
        <RotateCcw size={16} /> <span>Reset</span>
      </button>
    </div>
  </header>

  <main class="workbench">
    <aside class="palette panel">
      <div class="panel-heading">
        <span>Component palette</span>
        <small>{circuit.components.length} placed</small>
      </div>

      <div class="palette-grid">
        <button onclick={() => addComponent('resistor')}>
          <span class="component-glyph resistor-glyph">R</span>
          <span><strong>Resistor</strong><small>Linear load</small></span>
          <Plus size={16} />
        </button>
        <button onclick={() => addComponent('capacitor')}>
          <span class="component-glyph capacitor-glyph">C</span>
          <span><strong>Capacitor</strong><small>Transient state</small></span>
          <Plus size={16} />
        </button>
        <button onclick={() => addComponent('battery')}>
          <span class="component-glyph"><Battery size={18} /></span>
          <span><strong>Battery</strong><small>Real or ideal</small></span>
          <Plus size={16} />
        </button>
        <button onclick={() => addComponent('voltmeter')}>
          <span class="component-glyph"><Gauge size={18} /></span>
          <span><strong>Voltmeter</strong><small>Optional loading</small></span>
          <Plus size={16} />
        </button>
        <button onclick={() => addComponent('transistor')}>
          <span class="component-glyph"><Cpu size={18} /></span>
          <span><strong>NPN switch</strong><small>Threshold model</small></span>
          <Plus size={16} />
        </button>
      </div>

      <div class="node-maker">
        <label for="new-node">Add a node</label>
        <div>
          <input id="new-node" bind:value={newNodeName} placeholder="e.g. output" onkeydown={(event) => event.key === 'Enter' && addNode()} />
          <button onclick={addNode} aria-label="Add node"><Plus size={17} /></button>
        </div>
        <p>Ground is always node <code>0</code>.</p>
      </div>

      <div class="placed-list">
        <h2>On the board</h2>
        {#each circuit.components as component (component.id)}
          <button class:selected={selectedId === component.id} class="placed-item" onclick={() => (selectedId = component.id)}>
            <span class="type-dot" data-type={component.type}></span>
            <span><strong>{component.name}</strong><small>{componentSummary(component)}</small></span>
            <span
              class="delete-action"
              role="button"
              tabindex="0"
              aria-label={`Delete ${component.name}`}
              onclick={(event) => { event.stopPropagation(); removeComponent(component.id) }}
              onkeydown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); removeComponent(component.id) } }}
            ><Trash2 size={15} /></span>
          </button>
        {:else}
          <p class="empty-list">Choose a component above to begin.</p>
        {/each}
      </div>
    </aside>

    <section class="center-stage">
      <div class="canvas-panel panel">
        <div class="canvas-heading">
          <div>
            <p class="eyebrow">Live schematic</p>
            <h1>{circuit.name}</h1>
            <p>{circuit.description}</p>
          </div>
          <div class="node-legend">
            {#each circuit.nodes as node}
              <span class:ground-node={node === '0'}>{node === '0' ? 'GND' : node}</span>
            {/each}
          </div>
        </div>
        <div class="canvas-wrap">
          <CircuitCanvas {circuit} {selectedId} onselect={(id) => (selectedId = id)} />
        </div>
      </div>

      <div class="scope-panel panel">
        <div class="scope-heading">
          <div>
            <p class="eyebrow"><Waves size={14} /> Transient scope</p>
            <h2>{probeLabel}</h2>
          </div>
          <select aria-label="Scope signal" bind:value={probeKey}>
            {#each meters as meter}
              <option value={`meter:${meter.id}`}>{meter.name} reading</option>
            {/each}
            {#each circuit.nodes as node}
              <option value={`node:${node}`}>{node === '0' ? 'Ground' : node} node</option>
            {/each}
          </select>
        </div>
        {#if result}
          <Waveform {result} meterId={probeType === 'meter' ? probeId : null} node={probeId} label={probeLabel} />
        {:else}
          <div class="chart-error"><Zap size={20} /><span>{simulationError}</span></div>
        {/if}
      </div>
    </section>

    <aside class="inspector panel">
      <div class="reading-card">
        <div><span>Final reading</span><Gauge size={17} /></div>
        <strong>{formatVoltage(finalReading)}</strong>
        <small>{probeLabel} at {circuit.duration.toFixed(2)} s</small>
      </div>

      {#if selectedComponent}
        <div class="panel-heading inspector-title">
          <span>Inspector</span>
          <small>{selectedComponent.type}</small>
        </div>
        <div class="fields">
          <label>Name<input value={selectedComponent.name} oninput={(event) => updateSelected({ name: eventValue(event) })} /></label>

          {#if selectedComponent.type === 'battery'}
            <div class="field-pair">
              <label>Positive<select value={selectedComponent.positive} onchange={(event) => updateSelected({ positive: eventValue(event) })}>{#each circuit.nodes as node}<option value={node}>{node}</option>{/each}</select></label>
              <label>Negative<select value={selectedComponent.negative} onchange={(event) => updateSelected({ negative: eventValue(event) })}>{#each circuit.nodes as node}<option value={node}>{node}</option>{/each}</select></label>
            </div>
            <label>Voltage <span>V</span><input type="number" step="0.1" value={selectedComponent.voltage} oninput={(event) => updateSelected({ voltage: eventNumber(event) })} /></label>
            <label>Internal resistance <span>Ω</span><input type="number" min="0" step="0.1" value={selectedComponent.internalResistance} oninput={(event) => updateSelected({ internalResistance: eventNumber(event) })} /></label>
          {:else if selectedComponent.type === 'transistor'}
            <div class="field-pair three">
              <label>Collector<select value={selectedComponent.collector} onchange={(event) => updateSelected({ collector: eventValue(event) })}>{#each circuit.nodes as node}<option value={node}>{node}</option>{/each}</select></label>
              <label>Base<select value={selectedComponent.base} onchange={(event) => updateSelected({ base: eventValue(event) })}>{#each circuit.nodes as node}<option value={node}>{node}</option>{/each}</select></label>
              <label>Emitter<select value={selectedComponent.emitter} onchange={(event) => updateSelected({ emitter: eventValue(event) })}>{#each circuit.nodes as node}<option value={node}>{node}</option>{/each}</select></label>
            </div>
            <label>Vbe threshold <span>V</span><input type="number" min="0" step="0.05" value={selectedComponent.threshold} oninput={(event) => updateSelected({ threshold: eventNumber(event) })} /></label>
            <label>On resistance <span>Ω</span><input type="number" min="0.001" value={selectedComponent.onResistance} oninput={(event) => updateSelected({ onResistance: eventNumber(event) })} /></label>
            <label>Off resistance <span>Ω</span><input type="number" min="1" value={selectedComponent.offResistance} oninput={(event) => updateSelected({ offResistance: eventNumber(event) })} /></label>
            <label>Base input resistance <span>Ω</span><input type="number" min="1" value={selectedComponent.baseResistance} oninput={(event) => updateSelected({ baseResistance: eventNumber(event) })} /></label>
            <div class="model-note"><Info size={15} /><span>This MVP uses a threshold-controlled collector switch, not a full Ebers–Moll BJT model.</span></div>
          {:else}
            <div class="field-pair">
              <label>Node A<select value={selectedComponent.nodeA} onchange={(event) => updateSelected({ nodeA: eventValue(event) })}>{#each circuit.nodes as node}<option value={node}>{node}</option>{/each}</select></label>
              <label>Node B<select value={selectedComponent.nodeB} onchange={(event) => updateSelected({ nodeB: eventValue(event) })}>{#each circuit.nodes as node}<option value={node}>{node}</option>{/each}</select></label>
            </div>
            {#if selectedComponent.type === 'resistor'}
              <label>Resistance <span>Ω</span><input type="number" min="0.001" value={selectedComponent.resistance} oninput={(event) => updateSelected({ resistance: eventNumber(event) })} /></label>
            {:else if selectedComponent.type === 'capacitor'}
              <label>Capacitance <span>F</span><input type="number" min="0.000000001" step="0.000001" value={selectedComponent.capacitance} oninput={(event) => updateSelected({ capacitance: eventNumber(event) })} /></label>
              <label>Initial voltage <span>V</span><input type="number" step="0.1" value={selectedComponent.initialVoltage} oninput={(event) => updateSelected({ initialVoltage: eventNumber(event) })} /></label>
            {:else if selectedComponent.type === 'voltmeter'}
              <label class="check-field"><input type="checkbox" checked={selectedComponent.resistance === null} onchange={(event) => updateSelected({ resistance: (event.currentTarget as HTMLInputElement).checked ? null : 10_000_000 })} /><span>Ideal meter (infinite input resistance)</span></label>
              {#if selectedComponent.resistance !== null}
                <label>Input resistance <span>Ω</span><input type="number" min="1" value={selectedComponent.resistance} oninput={(event) => updateSelected({ resistance: eventNumber(event) })} /></label>
              {/if}
            {/if}
          {/if}
        </div>
      {:else}
        <div class="nothing-selected"><CircuitBoard size={25} /><h2>No component selected</h2><p>Add or select a component to edit its model.</p></div>
      {/if}

      <div class="simulation-settings">
        <div class="panel-heading"><span>Simulation</span><small>Backward Euler</small></div>
        <div class="field-pair">
          <label>Duration <span>s</span><input type="number" min="0.001" step="0.1" value={circuit.duration} oninput={(event) => updateCircuit({ duration: eventNumber(event) })} /></label>
          <label>Time step <span>s</span><input type="number" min="0.000001" step="0.001" value={circuit.timeStep} oninput={(event) => updateCircuit({ timeStep: eventNumber(event) })} /></label>
        </div>
      </div>
    </aside>
  </main>
</div>
