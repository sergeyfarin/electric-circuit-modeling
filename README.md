# Circuit Lab

Circuit Lab is a small, browser-based electric circuit modeler built with Svelte 5 and TypeScript. Start from a blank board or load a voltage divider, RC charge circuit, or NPN switch. Component edits are solved immediately and shown as a schematic, probe reading, and transient voltage trace.

## What it models

- Resistors
- Capacitors with initial voltage
- Ideal batteries or batteries with series internal resistance
- Ideal voltmeters or meters with finite input resistance
- An educational NPN threshold-switch model
- Named circuit nodes with node `0` as ground

The numerical engine uses Modified Nodal Analysis and backward Euler for capacitor transients. [`ml-matrix`](https://github.com/mljs/matrix) handles the dense linear solve. See [docs/PLAN.md](docs/PLAN.md) for the scope and the TypeScript-versus-Wasm decision.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL printed by Vite.

## Validate

```bash
npm test
npm run check
npm run build
```

## Architecture

- `src/lib/circuit/types.ts` — circuit and component domain types
- `src/lib/circuit/solver.ts` — MNA stamps and transient simulation
- `src/lib/circuit/presets.ts` — editable starter circuits
- `src/lib/components/` — generated schematic and scope
- `src/App.svelte` — workbench state and component inspector

## Current limits

The transistor is deliberately a threshold-controlled collector-emitter switch, not a full semiconductor model. The schematic is automatically laid out from node connections rather than freely positioned. Simulations are capped at 2,000 time samples to keep edits responsive.

## License

MIT
