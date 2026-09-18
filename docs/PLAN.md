# Circuit Lab implementation plan

## Product goal

Create an approachable browser workbench for students and hobbyists who want to build a small circuit, adjust real-world imperfections, and immediately see node voltages over time.

## MVP scope

1. Offer a blank board and three useful starters: a loaded voltage divider, an RC charging circuit, and an NPN transistor switch.
2. Let users drag resistors, capacitors, batteries, voltmeters, and transistors from a palette onto a pannable board, reposition them directly, and add named nodes.
3. Let users connect each terminal by node name and edit electrical values.
4. Solve the circuit locally, draw an auto-layout schematic, show the final probe value, and chart voltage over time.
5. Model battery internal resistance and voltmeter input resistance, including ideal zero/infinite choices.
6. Clearly identify the transistor as an educational threshold-switch approximation.
7. Cover the numerical engine with deterministic unit tests and keep the interface responsive.

## Solver decision

Start in TypeScript with Modified Nodal Analysis (MNA). Linear resistive elements and ideal voltage sources are stamped into a matrix; capacitors use backward-Euler companion models; batteries with internal resistance use a hidden Thevenin node; voltmeters either add their input resistance or remain electrically invisible. The current NPN model iterates a base-emitter threshold and collector-emitter on/off resistance.

`ml-matrix` provides the tested linear algebra primitive. Keeping the domain model and stamps in TypeScript makes the first solver easy to inspect, test, and run without a Wasm toolchain.

Rust/Wasm becomes worthwhile when profiling demonstrates a need—likely after adding large netlists, nonlinear Newton-Raphson devices, adaptive time stepping, AC sweeps, or Monte Carlo analysis. The component types and solver function already form a boundary that can later be moved behind a worker or Wasm adapter.

## Delivery stages

- **Concept:** one-page Svelte 5 workbench, TypeScript solver, draggable/pannable SVG schematic, and scope.
- **Reliability:** divider, meter loading, RC transient, transistor state, and safety-limit tests.
- **Next:** wire drawing, undo/redo, import/export, SPICE-like nonlinear devices, AC analysis, and worker/Wasm benchmarking.
