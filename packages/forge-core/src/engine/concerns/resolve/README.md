# resolve

Resolve builds the `RenderContext` for one request. It evaluates the step's blocks and the step and ancestor
metadata, replaces nested work tasks hidden inside block properties with their completed outputs, combines the
inherited journey views into the effective step view, folds in the hydrated route tree, and attaches validation
failures to rendered blocks by block ID. What comes out is everything a renderer needs and nothing it has to
resolve for itself.

## Stage folders

- [analysis](analysis/README.md) gives resolve compilation the step, its ancestor journeys, and every iterate node under the step.
- [lowering](lowering/README.md) emits the `CompiledResolveFunction` that returns the block and metadata work.
- [runtime](runtime/README.md) runs that work, brands the blocks, and assembles `RenderContext`.
- `contracts` holds `resolveBlocksOutput.type.ts` and `resolveModel.type.ts`.

## Runtime phase

This concern owns `request.resolve`. It is terminal when no renderer was supplied - it returns the `RenderContext`
as the render result - and otherwise stores the context for [render](../render/README.md) to use. The child work
kinds are `resolve.blocks` and `resolve.block`.

## Cross-concern edges

- Resolve imports **validation** for the `validationResult` type it attaches to rendered fields.
- Resolve imports **render** for the render block brand.
- Resolve imports **reachability** for the backlink and redirect helpers and the evaluation type.
- No concern imports resolve.

Resolve is the engine's collection point, which is why it imports three concerns and exports to none. The zones
are in [eslint.config.mjs](../../../../eslint.config.mjs).
