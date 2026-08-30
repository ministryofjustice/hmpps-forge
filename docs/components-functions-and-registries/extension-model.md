# Extension model

## Purpose

Forge has six function declaration families:

- conditions decide
- transformers change values
- generators produce values
- effects perform hook work
- components present blocks and fields
- renderers compose complete steps

They share one extension lifecycle. Each declaration produces a callable authoring
handle, package finalisation collects the declaration from its invocation, compilation
uses its static metadata, and request preparation binds its factory into the active
`FunctionRegistry`.

## Definitions and implementations

Journey definitions remain declarative data. Function declarations provide the
executable behaviour those definitions name.

Keeping the two separate allows Forge to inspect and compile journeys before request
handling starts, detect missing names early, isolate extensions by package, and build
request-specific evaluators without embedding application objects in the AST.

## Function entries

Every function entry carries a name, a Forge function-kind discriminator, a factory,
and any static schemas or metadata relevant to its kind.

`FunctionDefinitionCatalog` holds the unbound metadata used by validation and
compilation. `FunctionRegistry` holds the request-bound rows whose factories have
already received the active dependency object.

Generated expression code invokes conditions, transformers, generators, and effects
through that request registry. Render work performs the same lookup for component
and renderer entries and invokes the resolved evaluator directly.

## Components and renderers

A component declaration builds basic or field block invocations. A renderer declaration
builds the invocation used by a journey or step to compose its rendered blocks.

`component()` and `renderer()` are separate authoring primitives because they have
different contracts and valid placements. Helpers such as `nunjucksComponent()` and
`jsxComponent()` keep the component factory contract while adapting its dependencies
or output for a rendering technology. There is no component-specific registry.

Component declarations retain field metadata that must be inspected statically,
including the input schema, `multiple`, and error anchoring. Component evaluators
receive block context; renderer evaluators receive step context and rendered children.
Both capture the same merged package, adapter, and request dependencies as the other
function kinds.

## Registries and package scope

A package exposes function builders and entries through `functions`. Embedded
invocations are collected automatically; explicit listing supports serialized or
otherwise name-only journeys.

All names are package-scoped. Two packages may register different entries with the
same local name. Reusing one entry across packages registers it separately in each
scope.

The deprecated `components` package field accepts component entries, but it feeds the
same entry collector and adds no separate lifecycle.

## What Forge does not define

Forge defines how extension declarations are collected, validated, bound, resolved,
and invoked. It does not prescribe:

- how application services load data
- how external systems are integrated
- how component packages structure templates
- how adapters turn rendered values into responses
- what side effects an effect performs

Those choices stay at the engine boundary and enter through package, adapter, or
request dependencies and the page-assembly renderer.

## What can fail

Important failure cases include malformed or duplicate entries, references to names
outside the active package, an entry used in the wrong semantic position, factory
binding failures, and evaluator failures.

Static name and shape errors should fail before routes mount. Failures depending on
request data, external services, or templates remain runtime errors.

## Rules to preserve

- Sibling function kinds share one declaration and binding lifecycle.
- Structural differences reflect real semantic differences, not separate plumbing.
- Package scope determines visibility.
- Compilation never needs to execute a factory.
- Request evaluators are isolated to one request.
- Components and renderers remain ordinary function entries rather than parallel registries.
