import { describe, expect, it } from 'vitest'
import { clonePreset } from './presets'
import { simulateCircuit } from './solver'
import type { Circuit } from './types'

describe('simulateCircuit', () => {
  it('solves a loaded resistor divider', () => {
    const result = simulateCircuit(clonePreset('divider'))

    expect(result.final.nodeVoltages.out).toBeCloseTo(5.997, 2)
    expect(result.final.meterReadings['meter-1']).toBeCloseTo(result.final.nodeVoltages.out, 8)
  })

  it('includes finite voltmeter input resistance in the circuit', () => {
    const circuit: Circuit = {
      id: 'meter-loading',
      name: 'Meter loading',
      description: '',
      nodes: ['0', 'supply', 'out'],
      duration: 0.01,
      timeStep: 0.01,
      components: [
        { id: 'b', type: 'battery', name: 'B1', positive: 'supply', negative: '0', voltage: 10, internalResistance: 0 },
        { id: 'r1', type: 'resistor', name: 'R1', nodeA: 'supply', nodeB: 'out', resistance: 1_000 },
        { id: 'r2', type: 'resistor', name: 'R2', nodeA: 'out', nodeB: '0', resistance: 1_000 },
        { id: 'vm', type: 'voltmeter', name: 'VM1', nodeA: 'out', nodeB: '0', resistance: 1_000 },
      ],
    }

    expect(simulateCircuit(circuit).final.meterReadings.vm).toBeCloseTo(10 / 3, 6)
  })

  it('models an RC charging transient', () => {
    const result = simulateCircuit(clonePreset('rc-charge'))
    const first = result.samples[0].meterReadings['meter-1']
    const final = result.final.meterReadings['meter-1']

    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(0.2)
    expect(final).toBeGreaterThan(4.9)
    expect(final).toBeLessThan(5)
  })

  it('switches the simplified NPN model from off to on', () => {
    const onCircuit = clonePreset('transistor-switch')
    const onResult = simulateCircuit(onCircuit)

    expect(onResult.final.transistorStates['q-1']).toBe(true)
    expect(onResult.final.nodeVoltages.collector).toBeLessThan(0.6)

    const offCircuit = clonePreset('transistor-switch')
    const drive = offCircuit.components.find((item) => item.id === 'bat-2')
    if (!drive || drive.type !== 'battery') throw new Error('Drive battery fixture missing')
    drive.voltage = 0
    const offResult = simulateCircuit(offCircuit)

    expect(offResult.final.transistorStates['q-1']).toBe(false)
    expect(offResult.final.nodeVoltages.collector).toBeGreaterThan(8.9)
  })

  it('rejects an impractically dense simulation', () => {
    const circuit = clonePreset('blank')
    circuit.duration = 10
    circuit.timeStep = 0.001

    expect(() => simulateCircuit(circuit)).toThrow(/2,000 samples/)
  })
})
