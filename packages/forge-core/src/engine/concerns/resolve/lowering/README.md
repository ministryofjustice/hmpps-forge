# Resolve Compiler

## Scope

This document covers `packages/forge-core/src/engine/concerns/resolve/lowering`.

This code compiles step resolve/render preparation.
It emits a `CompiledResolveFunction` that returns block and metadata `WorkTask`s for rendering.

This document does not cover component rendering or runtime resolve handler execution.

## Inputs

`StepResolveCompiler.compile()` receives:
- the step node.
- ancestor journey nodes.
- iterate nodes under the step.

Dependency analysis provides those inputs.
The compiler emits evaluated step metadata, ancestor metadata, registered blocks, and iterator-yielded blocks.

## Work Returned

The compiled function returns:
- `ctx.workTasks.resolveBlocks(blocks, step, ancestors)`.

Each block is built as:
- `ctx.workTasks.resolveBlock(id, variant, blockType, properties)`.

Resolve builds renderable block work.
The runtime resolve and render phases execute the tasks and render components.

## Rules

- Block properties are evaluated through `RuntimeValueCompiler`.
  Static values emit as literals; dynamic values emit as expression-backed assignments.
- Step and journey metadata skip executable structure.
  Hooks, child structure, blocks, and reachability belong to other phases.
- Field values and field failures are resolved through `_forgeHelpers`.
  Generated code should not duplicate those helper rules.
- Template block IDs come from `ScopedTemplateCompiler.compileTemplateInstanceIdExpression()`.
  Resolve and validation must use the same expression so field failures attach to the rendered block by block ID.
- Field code stays on block props for answer lookup and component data.
  It must not be used as render block identity.
- Map iterators that yield blocks emit loops that push resolve-block tasks.
- Inline iterators used inside property values are tracked so the same iterator is not emitted again as top-level block output.

## Editing Notes

- To change step metadata output, start in `compileStepMetadata()`.
- To change ancestor metadata output, start in `compileAncestorMetadata()`.
- To change block property handling, start in `compileBlockProperties()` and `RuntimeValueCompiler` policy hooks.
- To change iterator-yielded block behavior, start in `compileIterateBlocks()` and `compileTemplateBlock()`.
- To change template block identity, update `ScopedTemplateCompiler` and check validation at the same time.
- To inspect generated source, use `generateSource()` in the tests.

## Entry Points

- [StepResolveCompiler.ts](StepResolveCompiler.ts) emits resolve source and compiles it.
