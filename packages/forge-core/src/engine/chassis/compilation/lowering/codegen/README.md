# Codegen

## Scope

This document covers `packages/forge-core/src/engine/chassis/compilation/lowering/codegen`.

This code is the typed IR that lowering builds generated JavaScript out of: safe source fragments, statement nodes, the builder that assembles them, and the renderer that prints them as source with source maps.

It knows nothing about Forge. There are no AST nodes, no `CompilationModel`, no `WorkTask`s, and no concern logic here - only how to assemble JavaScript source safely. Everything Forge-specific about generated code lives in the rest of `lowering/` and in `concerns/<name>/lowering`.

## Background

Phase compilers used to be able to assemble source as strings. That makes every call site responsible for escaping, and a stray authored value can silently become executable code.

This module takes the approach Ajv uses in its `codegen` module instead. Compilers build typed values, and the type system decides what is executable: a `CodeFragment` or `IdentifierName` interpolated into the ``code`...` `` tag stays executable source, whilst every other value is encoded as a JavaScript literal. Turning raw text into source requires the explicit `CodeFragment.trusted()` escape hatch.

The `new Function` boundary is deliberately not here. `GeneratedFunctionCompiler` in `lowering/` compiles rendered source; this module only builds and prints it.

## Layout

- `CodeGenerator.ts` - the builder phase compilers drive. It owns the statement tree, lexical scopes, and collision-free variable naming (`const()`, `if()`, `forRange()`, `function()`, and friends).
- `SourcePosition.type.ts` - the authored file/line/column shape carried by positioned fragments and nodes.
- `fragments/` - expression-level pieces that interpolate into ``code`...` ``: `CodeFragment`, `IdentifierName`, and the structured `*ExpressionToken` values (arrays, calls, objects, function expressions, positioned code).
- `statements/` - the node tree `CodeGenerator` builds. Every class extends `CodeNode`: declarations, assignments, control flow, comments, and blank lines.
- `rendering/` - `SourceRenderer` walks the node tree and prints readable JavaScript plus source-map segments in one pass; `sourceMapEncoder` turns those segments into an inline source map.

## Boundaries

- Leaf module: nothing here imports from the compilation stages, the rest of `lowering/`, or `runtime/`. The eslint zones in `eslint.config.mjs` enforce this.
- Consumers are `lowering/` (orchestrator, expressions, emitters, structures) and the concern compilers under `concerns/<name>/lowering`.

## Editing notes

- To add a statement kind, add a `statements/` node class, a `CodeGenerator` method that pushes it, and a `SourceRenderer` arm that prints it.
- To add a fragment kind, extend `CodeItem` in `fragments/CodeFragment.ts` and handle it in `SourceRenderer` - `CodeFragment.toString()` only handles simple tokens.
- Keep this module Forge-agnostic. If a change needs compiler context, it belongs in `lowering/`, not here.
