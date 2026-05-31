# Forge: Architectural Overview

## Purpose

Forge is a compiled journey engine for Node.js. It provides a declarative
authoring API for defining multi-step user journeys: sequences of pages, forms,
hooks, validation, and navigation logic.

Forge validates each journey, builds an internal representation of its
structure, and mounts route handlers through a framework adapter.

The framework targets government digital services built on
[Express](https://expressjs.com/), Nunjucks, and the
[GOV.UK Design System](https://design-system.service.gov.uk/), while keeping
the core engine independent of Express, Nunjucks, and any specific UI library.
Forge handles the structural concerns of journey delivery: route mounting, step
sequencing, conditional navigation, field validation, answer preparation,
reachability analysis, and component rendering orchestration. Most framework
changes therefore need to preserve both the declarative authoring model and the
compiled runtime model.

## Design principles

### Deterministic core evaluation

Forge's core evaluation model is deterministic and context-driven. Given the
same compiled journey, registries, request context, and pure function
implementations, the engine should reach the same validation, navigation,
hook, and rendering decisions every time. Any non-determinism should live at
the edges: effects, external integrations, request/session state, framework
adapters, or application code that loads data into context.

### Declarative over imperative

Journeys are defined as data structures, not request handlers. The public
builder API produces inspectable definitions; the engine decides how to execute
those definitions. Internal changes should preserve that separation so
validation, compilation, diagnostics, and tooling can continue to reason about
journeys before request handling starts.

### Compilation over interpretation

Forge turns definitions into intermediate representation (IR) in the form of an
Abstract Syntax Tree (AST). From here, runtime plans are built and JavaScript
functions are generated for each of the different phases that make up the
evaluation of a request. Runtime handlers then execute those compiled artefacts,
removing the need to interpolate the definition on every request - and keeping
the framework performant.

### Framework independence at the core

`forge-core` has no dependency on Express, Nunjucks, GOV.UK Frontend, or MOJ
Frontend. Web framework integration is handled through the `FrameworkAdapter`
interface, and component rendering is handled through `ComponentRegistryEntry`
renderers.

### Stateless request evaluation

Forge does not keep durable journey state inside the framework runtime. Each
request is evaluated from the request, session, answers, data, and route context
provided to that request. If a journey needs persistence, caching, or external
state, that responsibility sits outside the core engine and is surfaced back to
Forge through the request evaluation context.

### Integration through context

Forge does not prescribe how services integrate with external systems. Data can
be loaded by application middleware, framework adapters, package functions, or
effects, but the engine only needs the resulting answers and data to be
represented in context. Once values are in context, Forge can evaluate
conditions, transformations, validation, reachability, hooks, and rendering
consistently across the request.

### Scoped isolation of packages

When multiple journeys are registered with a single `Forge` instance, each
package registration can carry its own functions and components without mutating
the global registries. A custom condition or component variant registered for
one package is not visible to another package unless it is registered globally.

### Fail fast, fail clearly

Journey definitions are validated before routes are mounted. Object definitions
are checked for JSON serialisability, string definitions are parsed as JSON.
Definitions are then validated using Zod schemas, and additional semantic based
rules are then checked (check that referenced functions exist, components are
registered, references are valid for their scope etc.)

Errors carry diagnostic metadata, such as DSL path, node ID, expected
value, function name, and component variant, so failures can be traced back to
the authored definition before runtime.

## High-Level architecture

### Four-phase pipeline

Every journey definition passes through four phases between authoring and
request handling:

```text
                 Intermediate
Authoring        representation   Compilation           Runtime
+-----------+    +-----------+    +----------------+    +------------+
| Builders  |    | Node      |    | Codegen        |    | Route      |
| and DSL   | -> | factories | -> | and plans      | -> | handlers   |
|           |    | and tree  |    |                |    | rendering  |
+-----------+    +-----------+    +----------------+    +------------+
```

1. **Authoring** describes a journey as a declarative object graph: journeys,
   steps, blocks, references, conditions, hooks, and outcomes.

2. **Intermediate representation** normalises that object graph into an indexed
   structure that the engine can validate, traverse, and compile.

3. **Compilation** turns the indexed structure into runtime plans and generated
   functions for the major evaluation phases.

4. **Runtime** uses those plans and functions to evaluate each request, decide
   access, navigation, validation, hooks, and rendering, then delegates the
   final HTTP response to the framework adapter.

### Package structure

The library is published as one npm package, `@ministryofjustice/hmpps-forge`,
with seven export entry points declared in `packages/package.json`:

| Entry point | Source area | Role |
|---|---|---|
| `./core` | `forge-core` | `Forge` class, global registries, selected runtime-facing types |
| `./core/authoring` | `forge-core` | Builder API, definition types, conditions, transformers, generators, effects helpers |
| `./core/components` | `forge-core` | Component system interfaces and built-in components |
| `./core/framework` | `forge-core` | Framework adapter interfaces, request/response types, render context types, path utilities |
| `./express-nunjucks` | `forge-express-nunjucks` | Express router adapter, Nunjucks renderer, Nunjucks helpers |
| `./govuk-components` | `forge-govuk-components` | GOV.UK Design System component implementations and authoring wrappers |
| `./moj-components` | `forge-moj-components` | MOJ Frontend component implementations and authoring wrappers |


```text
forge-core
  Standalone engine and public core APIs.
  No Express, Nunjucks, GOV.UK Frontend, or MOJ Frontend dependency.

forge-express-nunjucks
  Depends on forge-core, Express, Nunjucks, and http-errors.
  Implements FrameworkAdapter and Nunjucks component helper utilities.

forge-govuk-components
  Depends on forge-core and the express-nunjucks helper.
  Provides GOV.UK component registry entries and wrappers rendered with
  Nunjucks.

forge-moj-components
  Depends on forge-core and the express-nunjucks helper.
  Provides MOJ component registry entries and wrappers rendered with
  Nunjucks/templates.
```

`forge-core` is the only source area with deep internal layering. The adapter
and component source areas mostly implement public extension interfaces from the
core. The GOV.UK and MOJ component packages are not framework-independent leaves
today because their renderers use Nunjucks component helpers from
`./express-nunjucks`.

### Layer Boundaries Within forge-core

```text
+-------------------------------------------------------------+
| Authoring                                                   |
| Builders, conditions, transformers, generators, definitions |
| Public API consumed by journey definitions                  |
+-------------------------------------------------------------+
| Components                                                  |
| Component interfaces, built-in components, block types      |
| Shared by authoring definitions and runtime rendering       |
+-------------------------------------------------------------+
| Framework                                                   |
| FrameworkAdapter, request/response types, path utilities    |
| Integration boundary for web frameworks                     |
+-------------------------------------------------------------+
| Engine                                                      |
|   contracts/  — shared types (no logic)                     |
|   ast/        — AST construction (depends on contracts/)    |
|   lowering/   — codegen (depends on contracts/ + ast/)      |
|   runtime/    — execution (depends on contracts/ only)      |
|   + registries, validation, errors, diagnostics             |
|   Layer boundaries enforced by eslint                       |
+-------------------------------------------------------------+
| Shared                                                      |
| Generic type guards and utilities used across core layers   |
+-------------------------------------------------------------+
```

Together, these layers keep Forge's responsibilities narrow: authoring defines
the journey shape, the engine validates and compiles it, framework adapters
translate HTTP concerns, and component packages handle presentation. Changes to
Forge should preserve those boundaries so the core evaluation model remains
deterministic, stateless, and independent of any one web or rendering stack.
