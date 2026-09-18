export type ComponentType = 'resistor' | 'capacitor' | 'battery' | 'voltmeter' | 'transistor'

interface BaseComponent {
  id: string
  name: string
  type: ComponentType
}

export interface Resistor extends BaseComponent {
  type: 'resistor'
  nodeA: string
  nodeB: string
  resistance: number
}

export interface Capacitor extends BaseComponent {
  type: 'capacitor'
  nodeA: string
  nodeB: string
  capacitance: number
  initialVoltage: number
}

export interface Battery extends BaseComponent {
  type: 'battery'
  positive: string
  negative: string
  voltage: number
  internalResistance: number
}

export interface Voltmeter extends BaseComponent {
  type: 'voltmeter'
  nodeA: string
  nodeB: string
  /** null models an ideal voltmeter with infinite input resistance. */
  resistance: number | null
}

/**
 * An intentionally simple educational model: the collector-emitter path switches
 * between two resistances when Vbe crosses the threshold. A base-emitter input
 * resistance keeps the control side electrically visible.
 */
export interface Transistor extends BaseComponent {
  type: 'transistor'
  collector: string
  base: string
  emitter: string
  threshold: number
  onResistance: number
  offResistance: number
  baseResistance: number
}

export type CircuitComponent = Resistor | Capacitor | Battery | Voltmeter | Transistor

export interface Circuit {
  id: string
  name: string
  description: string
  nodes: string[]
  components: CircuitComponent[]
  duration: number
  timeStep: number
}

export interface SimulationSample {
  time: number
  nodeVoltages: Record<string, number>
  meterReadings: Record<string, number>
  componentCurrents: Record<string, number>
  transistorStates: Record<string, boolean>
}

export interface SimulationResult {
  samples: SimulationSample[]
  final: SimulationSample
}
