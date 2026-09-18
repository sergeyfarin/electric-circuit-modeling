import type { Circuit } from './types'

export const presets: Circuit[] = [
  {
    id: 'divider',
    name: 'Loaded voltage divider',
    description: 'See how a real meter slightly changes a two-resistor divider.',
    nodes: ['0', 'supply', 'out'],
    duration: 0.1,
    timeStep: 0.01,
    components: [
      { id: 'bat-1', type: 'battery', name: 'B1', positive: 'supply', negative: '0', voltage: 9, internalResistance: 1 },
      { id: 'res-1', type: 'resistor', name: 'R1', nodeA: 'supply', nodeB: 'out', resistance: 1_000 },
      { id: 'res-2', type: 'resistor', name: 'R2', nodeA: 'out', nodeB: '0', resistance: 2_000 },
      { id: 'meter-1', type: 'voltmeter', name: 'VM1', nodeA: 'out', nodeB: '0', resistance: 10_000_000 },
    ],
  },
  {
    id: 'rc-charge',
    name: 'RC charge curve',
    description: 'Charge a capacitor through a resistor and watch the voltage rise.',
    nodes: ['0', 'supply', 'capacitor'],
    duration: 5,
    timeStep: 0.02,
    components: [
      { id: 'bat-1', type: 'battery', name: 'B1', positive: 'supply', negative: '0', voltage: 5, internalResistance: 1 },
      { id: 'res-1', type: 'resistor', name: 'R1', nodeA: 'supply', nodeB: 'capacitor', resistance: 10_000 },
      { id: 'cap-1', type: 'capacitor', name: 'C1', nodeA: 'capacitor', nodeB: '0', capacitance: 0.0001, initialVoltage: 0 },
      { id: 'meter-1', type: 'voltmeter', name: 'VM1', nodeA: 'capacitor', nodeB: '0', resistance: null },
    ],
  },
  {
    id: 'transistor-switch',
    name: 'NPN transistor switch',
    description: 'Drive a simplified NPN model and inspect its collector voltage.',
    nodes: ['0', 'supply', 'drive', 'base', 'collector'],
    duration: 0.1,
    timeStep: 0.01,
    components: [
      { id: 'bat-1', type: 'battery', name: 'Supply', positive: 'supply', negative: '0', voltage: 9, internalResistance: 1 },
      { id: 'bat-2', type: 'battery', name: 'Drive', positive: 'drive', negative: '0', voltage: 5, internalResistance: 1 },
      { id: 'res-1', type: 'resistor', name: 'Load', nodeA: 'supply', nodeB: 'collector', resistance: 330 },
      { id: 'res-2', type: 'resistor', name: 'Rbase', nodeA: 'drive', nodeB: 'base', resistance: 10_000 },
      { id: 'q-1', type: 'transistor', name: 'Q1', collector: 'collector', base: 'base', emitter: '0', threshold: 0.7, onResistance: 20, offResistance: 1_000_000_000, baseResistance: 100_000 },
      { id: 'meter-1', type: 'voltmeter', name: 'VM1', nodeA: 'collector', nodeB: '0', resistance: 10_000_000 },
    ],
  },
  {
    id: 'blank',
    name: 'Blank circuit',
    description: 'Start from ground and one working node.',
    nodes: ['0', 'n1'],
    duration: 1,
    timeStep: 0.01,
    components: [],
  },
]

export function clonePreset(id: string): Circuit {
  const preset = presets.find((item) => item.id === id) ?? presets[0]
  return structuredClone(preset)
}
