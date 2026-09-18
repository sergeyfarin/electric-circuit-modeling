import { Matrix, solve } from 'ml-matrix'
import type {
  Battery,
  Capacitor,
  Circuit,
  CircuitComponent,
  SimulationResult,
  SimulationSample,
  Transistor,
} from './types'

const GROUND = '0'
const MIN_RESISTANCE = 1e-9
const GMIN = 1e-12

function conductance(resistance: number): number {
  return 1 / Math.max(Math.abs(resistance), MIN_RESISTANCE)
}

function stampConductance(
  matrix: number[][],
  nodeIndex: Map<string, number>,
  nodeA: string,
  nodeB: string,
  value: number,
) {
  const a = nodeIndex.get(nodeA)
  const b = nodeIndex.get(nodeB)

  if (a !== undefined) matrix[a][a] += value
  if (b !== undefined) matrix[b][b] += value
  if (a !== undefined && b !== undefined) {
    matrix[a][b] -= value
    matrix[b][a] -= value
  }
}

function stampCurrent(
  rhs: number[],
  nodeIndex: Map<string, number>,
  from: string,
  to: string,
  amperes: number,
) {
  const a = nodeIndex.get(from)
  const b = nodeIndex.get(to)
  if (a !== undefined) rhs[a] -= amperes
  if (b !== undefined) rhs[b] += amperes
}

function voltageAt(solution: number[], nodeIndex: Map<string, number>, node: string): number {
  if (node === GROUND) return 0
  const index = nodeIndex.get(node)
  return index === undefined ? 0 : solution[index]
}

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`)
  return value
}

function validateCircuit(circuit: Circuit) {
  if (!circuit.nodes.includes(GROUND)) throw new Error('Every circuit needs a ground node named 0.')
  if (circuit.timeStep <= 0) throw new Error('Time step must be greater than zero.')
  if (circuit.duration <= 0) throw new Error('Duration must be greater than zero.')
  if (circuit.duration / circuit.timeStep > 2_000) {
    throw new Error('Choose a larger time step; simulations are limited to 2,000 samples.')
  }

  const knownNodes = new Set(circuit.nodes)
  const requireNode = (node: string, component: CircuitComponent) => {
    if (!knownNodes.has(node)) throw new Error(`${component.name} refers to unknown node “${node}”.`)
  }

  for (const component of circuit.components) {
    if (component.type === 'battery') {
      requireNode(component.positive, component)
      requireNode(component.negative, component)
      finiteNumber(component.voltage, `${component.name} voltage`)
      if (component.internalResistance < 0) throw new Error('Internal resistance cannot be negative.')
    } else if (component.type === 'transistor') {
      requireNode(component.collector, component)
      requireNode(component.base, component)
      requireNode(component.emitter, component)
      if (
        component.onResistance <= 0 ||
        component.offResistance <= 0 ||
        component.baseResistance <= 0
      ) {
        throw new Error(`${component.name} resistances must be greater than zero.`)
      }
    } else {
      requireNode(component.nodeA, component)
      requireNode(component.nodeB, component)
      if (component.type === 'resistor' && component.resistance <= 0) {
        throw new Error(`${component.name} resistance must be greater than zero.`)
      }
      if (component.type === 'capacitor' && component.capacitance <= 0) {
        throw new Error(`${component.name} capacitance must be greater than zero.`)
      }
      if (component.type === 'voltmeter' && component.resistance !== null && component.resistance <= 0) {
        throw new Error(`${component.name} input resistance must be greater than zero.`)
      }
    }
  }
}

interface StepSolution {
  values: number[]
  nodeIndex: Map<string, number>
  sourceIndex: Map<string, number>
  transistorStates: Map<string, boolean>
}

function solveStep(
  circuit: Circuit,
  previousCapacitorVoltages: Map<string, number>,
  previousTransistorStates: Map<string, boolean>,
): StepSolution {
  const batteries = circuit.components.filter((item): item is Battery => item.type === 'battery')
  const expandedNodes = circuit.nodes.filter((node) => node !== GROUND)

  for (const battery of batteries) {
    if (battery.internalResistance > MIN_RESISTANCE) expandedNodes.push(`__${battery.id}_source`)
  }

  const nodeIndex = new Map(expandedNodes.map((node, index) => [node, index]))
  const sourceIndex = new Map(batteries.map((battery, index) => [battery.id, expandedNodes.length + index]))
  const transistorStates = new Map(previousTransistorStates)
  for (const transistor of circuit.components.filter(
    (item): item is Transistor => item.type === 'transistor',
  )) {
    if (!transistorStates.has(transistor.id)) transistorStates.set(transistor.id, false)
  }

  let solution = Array(expandedNodes.length + batteries.length).fill(0)

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const size = expandedNodes.length + batteries.length
    const matrix = Array.from({ length: size }, () => Array(size).fill(0))
    const rhs = Array(size).fill(0)

    for (let index = 0; index < expandedNodes.length; index += 1) matrix[index][index] += GMIN

    for (const component of circuit.components) {
      if (component.type === 'resistor') {
        stampConductance(matrix, nodeIndex, component.nodeA, component.nodeB, conductance(component.resistance))
      }

      if (component.type === 'voltmeter' && component.resistance !== null) {
        stampConductance(matrix, nodeIndex, component.nodeA, component.nodeB, conductance(component.resistance))
      }

      if (component.type === 'capacitor') {
        const g = component.capacitance / circuit.timeStep
        const previousVoltage = previousCapacitorVoltages.get(component.id) ?? component.initialVoltage
        stampConductance(matrix, nodeIndex, component.nodeA, component.nodeB, g)
        stampCurrent(rhs, nodeIndex, component.nodeA, component.nodeB, -g * previousVoltage)
      }

      if (component.type === 'transistor') {
        const isOn = transistorStates.get(component.id) ?? false
        stampConductance(
          matrix,
          nodeIndex,
          component.collector,
          component.emitter,
          conductance(isOn ? component.onResistance : component.offResistance),
        )
        stampConductance(
          matrix,
          nodeIndex,
          component.base,
          component.emitter,
          conductance(component.baseResistance),
        )
      }
    }

    for (const battery of batteries) {
      const sourceNode =
        battery.internalResistance > MIN_RESISTANCE ? `__${battery.id}_source` : battery.positive

      if (battery.internalResistance > MIN_RESISTANCE) {
        stampConductance(
          matrix,
          nodeIndex,
          sourceNode,
          battery.positive,
          conductance(battery.internalResistance),
        )
      }

      const row = sourceIndex.get(battery.id)!
      const positive = nodeIndex.get(sourceNode)
      const negative = nodeIndex.get(battery.negative)
      if (positive !== undefined) {
        matrix[positive][row] += 1
        matrix[row][positive] += 1
      }
      if (negative !== undefined) {
        matrix[negative][row] -= 1
        matrix[row][negative] -= 1
      }
      rhs[row] = battery.voltage
    }

    try {
      solution = solve(new Matrix(matrix), Matrix.columnVector(rhs)).to1DArray()
    } catch {
      throw new Error('This circuit could not be solved. Check that every active node has a path to ground.')
    }

    let changed = false
    for (const transistor of circuit.components.filter(
      (item): item is Transistor => item.type === 'transistor',
    )) {
      const vbe =
        voltageAt(solution, nodeIndex, transistor.base) - voltageAt(solution, nodeIndex, transistor.emitter)
      const nextState = vbe >= transistor.threshold
      if (nextState !== transistorStates.get(transistor.id)) {
        transistorStates.set(transistor.id, nextState)
        changed = true
      }
    }
    if (!changed) break
  }

  return { values: solution, nodeIndex, sourceIndex, transistorStates }
}

function componentCurrent(
  component: CircuitComponent,
  solution: StepSolution,
  previousCapacitorVoltages: Map<string, number>,
  timeStep: number,
): number {
  const v = (node: string) => voltageAt(solution.values, solution.nodeIndex, node)

  if (component.type === 'resistor') return (v(component.nodeA) - v(component.nodeB)) / component.resistance
  if (component.type === 'voltmeter') {
    return component.resistance === null ? 0 : (v(component.nodeA) - v(component.nodeB)) / component.resistance
  }
  if (component.type === 'capacitor') {
    const previous = previousCapacitorVoltages.get(component.id) ?? component.initialVoltage
    return (component.capacitance * (v(component.nodeA) - v(component.nodeB) - previous)) / timeStep
  }
  if (component.type === 'transistor') {
    const resistance = solution.transistorStates.get(component.id)
      ? component.onResistance
      : component.offResistance
    return (v(component.collector) - v(component.emitter)) / resistance
  }
  return -solution.values[solution.sourceIndex.get(component.id)!]
}

export function simulateCircuit(circuit: Circuit): SimulationResult {
  validateCircuit(circuit)
  const capacitors = circuit.components.filter((item): item is Capacitor => item.type === 'capacitor')
  const capacitorVoltages = new Map(capacitors.map((item) => [item.id, item.initialVoltage]))
  let transistorStates = new Map<string, boolean>()
  const samples: SimulationSample[] = []
  const steps = Math.max(1, Math.ceil(circuit.duration / circuit.timeStep))

  for (let step = 1; step <= steps; step += 1) {
    const previousCapacitorVoltages = new Map(capacitorVoltages)
    const solution = solveStep(circuit, previousCapacitorVoltages, transistorStates)
    transistorStates = solution.transistorStates
    const nodeVoltages: Record<string, number> = { [GROUND]: 0 }
    for (const node of circuit.nodes) {
      nodeVoltages[node] = voltageAt(solution.values, solution.nodeIndex, node)
    }

    const meterReadings: Record<string, number> = {}
    const componentCurrents: Record<string, number> = {}
    for (const component of circuit.components) {
      if (component.type === 'voltmeter') {
        meterReadings[component.id] = nodeVoltages[component.nodeA] - nodeVoltages[component.nodeB]
      }
      componentCurrents[component.id] = componentCurrent(
        component,
        solution,
        previousCapacitorVoltages,
        circuit.timeStep,
      )
      if (component.type === 'capacitor') {
        capacitorVoltages.set(component.id, nodeVoltages[component.nodeA] - nodeVoltages[component.nodeB])
      }
    }

    samples.push({
      time: Math.min(step * circuit.timeStep, circuit.duration),
      nodeVoltages,
      meterReadings,
      componentCurrents,
      transistorStates: Object.fromEntries(transistorStates),
    })
  }

  return { samples, final: samples[samples.length - 1] }
}
