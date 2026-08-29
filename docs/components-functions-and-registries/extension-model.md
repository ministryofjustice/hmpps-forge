# Extension model

## Purpose

Forge has a small core engine. It does not hard-code every condition,
transformation, effect, generator, or renderable component.

Those behaviours enter Forge through extensions.

The extension model is made of three parts:

- components, which provide renderable block variants
- functions, which provide executable behaviour for expressions and hooks
- registries, which make components and functions available to the engine

The important separation is between names in a journey definition and the
implementations those names resolve to.

A journey definition can say that a block uses a given component variant, or
that an expression calls a named function. The registry decides whether that
variant or function exists, and provides the implementation when the engine
needs it.

## Where this sits in the pipeline

Extensions are registered before a journey is validated and compiled.

They then stay visible across the rest of the pipeline:

1. Validation checks that referenced functions and component variants exist.

2. Intermediate representation keeps the function names, function types, and
   component variants as part of the node structure.

3. Compilation emits generated function call sites and render data that still
   refer to those registered names.

4. Runtime evaluation calls registered functions through the function registry.

5. Rendering dispatches evaluated blocks to component renderers through the
   component registry.

This lets Forge validate and compile declarative definitions without embedding
application code or presentation code into the definition itself.

## Why definitions and implementations are separate

Journey definitions are declarative data. They describe structure, navigation,
validation, hooks, and rendering intent - the recipe.

Functions and components are executable code. They depend on application
services, template engines, design-system packages, or framework integrations
- the ingredients.

Keeping them separate gives Forge a stable compilation model:

- Definitions can be inspected before request handling starts
- Missing functions and components surface during registration
- Generated code resolves functions by registry lookup
- Render data stays framework-independent until the adapter handles it
- Package-specific extensions stay isolated from other journeys

It also means the core never becomes the place where application integrations
or component packages have to live.

At request time, Forge combines the two: definitions govern how data, flows,
and views are structured, while functions and components supply the
computation, side-effects, and rendering. Recipe meets ingredients, Forge bakes 
it... and mmm, cake!!

## Components

Components are presentation extensions.

A block definition carries a component variant. The component registry maps that
variant to a component renderer.

During runtime, Forge evaluates block properties into render data. It does not
produce the final HTML itself. The framework integration takes the render
context, looks up each block variant in the component registry, and calls the
matching component renderer.

This keeps block evaluation inside `forge-core`, while allowing component
packages to decide how their markup is produced.

Component renderers may use Nunjucks, another template engine, plain string
rendering, or a different response model supplied by the framework adapter.
That choice belongs outside the core engine.

## Functions

Functions are evaluation extensions.

Forge uses registered functions for conditions, transformers, generators, and
effects. In the definition, these appear as typed function expressions with a
name and arguments.

The function registry maps each name to an evaluator. The registry entry also
records whether the function is asynchronous, which lets generated functions
preserve the correct evaluation flow.

The engine does not inline application function code into generated source.
Generated code keeps the decision about when a function should run. The
registry supplies the function that runs at that point.

Different function types have different roles:

- conditions answer a question used by validation, reachability, or hooks
- transformers change values as part of expression evaluation
- generators produce values, often for defaults or derived content
- effects run from hooks and may interact with application state or services

Effects are the main place where application side effects enter Forge. The core
only controls where effect expressions are allowed to appear and how they are
called. It does not prescribe what the effect does.

## Registries

Registries are lookup and validation boundaries.

`FunctionRegistry` stores function entries by name. A function entry needs a
name, an evaluator, and async metadata.

`ComponentRegistry` stores component entries by variant. A component entry
needs a variant and a renderer.

Registration fails if an entry is missing the required shape or if the same
name or variant is registered twice in the same registry.

Validation uses the registries to reject journey definitions that reference
unknown function names or component variants. Runtime and rendering use the
same registries to resolve the implementations.

This means a registry is not just a container. It defines the extension
environment that a journey is allowed to use.

## Scoping

Extension registration is package-scoped.

A package's functions and components go into registries owned by that package.
Nothing is registered globally, so every entry visible to a journey arrives
through that journey's package.

This gives packages local extension names without mutating a shared registry.
It also means one package can register a custom function or component variant
without making it visible to another package.

The rule to preserve is that package extensions should be visible to the
journey they are registered with and invisible to unrelated journeys. Built-in
entries follow the same rule as application entries: using their builder in a
TypeScript journey registers them automatically, while name-only packages can
list `builtInFunctions` and `builtInComponents` explicitly.

## What Forge does not define

The extension model is deliberately narrow.

Forge defines how extensions are named, registered, validated, resolved, and
called. It does not define:

- how application services load data
- how external systems are integrated
- how component packages render their internal templates
- how framework adapters turn render contexts into responses
- what side effects an effect function performs

Those choices sit at the edge of the engine. Once values are loaded into the
request context, registered functions and component renderers give Forge a
consistent way to use them during the evaluated request.

## What can fail

Important failure cases include:

- a function entry is registered without a name or evaluator
- a component entry is registered without a variant or renderer
- a name or variant is registered twice in the same registry
- a definition references an unregistered function
- a definition references an unregistered component variant
- an effect function is used outside a hook
- a package registry does not contain the expected extension
- a function or component renderer throws when it is called

The first group should fail during registration/validation. Runtime failures
should be reserved for code that can only fail when executed, such as an effect
calling an application service or a component renderer throwing. 

## Connection to other docs

The component registry doc explains component entries, block variants, built-in
components, and render-facing contracts in more detail.

The function registry doc explains function entries, sync and async metadata,
function families, and generated-function call sites.

The registry scoping doc explains package registries, explicit built-in
registration, and isolation rules.

The framework rendering doc explains how evaluated blocks are dispatched to
component renderers by framework integrations.
