# Chassis

This document covers packages/forge-core/src/engine/chassis.

The chassis is the machine the concerns plug into. It holds the two stage
pipelines and the substrate both stages run on. It runs concern code in the
right order without knowing what any concern means.

- [compilation](compilation) owns phase order, the AST, semantic analysis, plan assembly, the expression and emitter layers, and generated-function construction.
- [runtime](runtime) owns the request pipeline order, the compiled-function contexts, and request trace projection.
- [work](work) owns the stage-neutral work substrate: the executor, work context, and task helpers.
- [contracts](contracts) owns the kernel types every layer shares: AST, compiled functions, plans, work, and runtime plumbing.
- [registries](registries) owns function, component, and mount registries.
- [tracing](tracing) owns the shared trace substrate and the instrumentation fan-out.

Domain logic does not belong here. A new domain question becomes a folder under
[../concerns](../concerns), not a file in the chassis. Read
[../README.md](../README.md) for the two-axis model.
