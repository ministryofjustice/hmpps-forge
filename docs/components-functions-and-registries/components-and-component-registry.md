# Components and component registry

## Purpose

Components are how Forge turns evaluated blocks into renderable output.

A journey definition contains blocks. Each block has a `variant`. The component
registry maps that variant to a component renderer.

This keeps the definition and the rendering implementation separate. The
definition says what kind of block should appear. The registry provides the
renderer that knows how to turn that evaluated block into output for a
framework integration.

## Where this sits in the pipeline

Components are registered before a journey is validated and compiled.

The component model is then used across the pipeline:

1. Authoring creates block definitions with a block type, variant, and
   properties.

2. Validation checks that each block variant exists in the component registry.

3. Intermediate representation keeps block variants as part of block nodes.

4. Compilation emits render functions that evaluate block properties.

5. Runtime builds a render context containing evaluated blocks.

6. Framework rendering looks up each block variant and calls the registered
   component renderer.

This means the component variant is the stable link between the authored block
and the render implementation.

## Block definitions and component entries

A block definition belongs to the journey.

It records:

- the block structure type
- whether the block is a field block or a basic block
- the component variant
- the authored properties for that block

A component registry entry belongs to the rendering boundary.

It records:

- the variant it handles
- the renderer for evaluated blocks with that variant

These shapes are deliberately separate.

The block definition stays declarative. The component entry holds executable
rendering behaviour and any template-engine assumptions made by the component
package or framework integration.

## Component variants

The variant is the name that connects a block to a component renderer.

For example, a GOV.UK input wrapper can produce a block with a GOV.UK input
variant. The registry then needs a component entry for that same variant.

Variants are checked during DSL validation. If a block references a variant
that is not registered for that journey, validation fails before routes are
mounted.

This protects rendering from discovering missing components late in the request
path.

## Field blocks and basic blocks

Forge distinguishes field blocks from basic blocks.

Field blocks represent user input. They can have field codes, values,
formatters, parsers, validation rules, dependency rules, and field errors.

Basic blocks represent non-field content or layout. They can still have
dynamic properties and visibility rules, but they do not store submitted
answers in the same way field blocks do.

Both kinds of block use the same component registry boundary. The renderer
receives an evaluated block for its variant.

## Evaluated blocks

Forge does not pass authored block definitions directly to component renderers.

During runtime, compiled render functions evaluate block properties against the
current request context. References, conditions, generated values, validation
results, and nested structures are resolved before the framework integration
calls component renderers.

The renderer receives component-facing block data. That data keeps the block
variant and evaluated properties, and can include runtime additions such as
field values or validation errors.

This lets component renderers focus on presentation. They do not need to know
how to evaluate Forge expressions.

## Component registry

`ComponentRegistry` stores component entries by variant.

It is used by validation to check that authored block variants are available.
It is also used by framework rendering to resolve a renderer for each evaluated
block.

Registration should fail when:

- a component entry has no variant
- a component entry has no render function
- a variant is registered twice in the same registry

The registry does not validate component-specific props. It only validates the
registry entry shape and the uniqueness of variants.

## Built-in components

`forge-core` registers a small set of built-in components.

These cover core rendering primitives such as HTML passthrough, collection
blocks, and template wrappers.

Design-system components live outside the core. GOV.UK and MOJ component
packages provide their own variants and renderers, and those components are
registered through the same registry contract.

## Framework rendering

`forge-core` prepares render data, but framework integrations perform the final
rendering.

For the Express/Nunjucks integration, the page renderer looks up each evaluated
block by variant in the component registry. It then calls the component's
render function with the evaluated block and a Nunjucks renderer.

Other framework integrations can use the same core contract differently. The
important contract is that the adapter receives evaluated blocks and resolves
their variants through the component registry.

## Nested blocks

Blocks can appear inside component properties.

When a framework integration supports nested block rendering, it can render
those child blocks before passing data to the parent component. The
component-facing shape for nested blocks is different from the top-level render
context because nested blocks have already crossed part of the rendering
boundary.

The rendering docs cover this shape in more detail. The important point here is
that nested blocks still resolve through component variants and the component
registry.

## What can fail

Important failure cases include:

- a component entry is registered without the required shape
- a component variant is registered twice in the same registry
- a journey definition references an unregistered component variant
- a framework integration cannot find a component renderer for a block
- a component renderer throws while rendering
- nested block rendering receives data it cannot render

Registration and validation should catch missing or malformed component
registration before routes are mounted.

Renderer failures can still happen at runtime because they depend on evaluated
request data, template availability, and framework integration behaviour.

## Rules to preserve

Component variants are the stable link between authored blocks and renderers.

`forge-core` should own block evaluation and render-context construction.

Framework and component packages should own final rendering.

Component renderers should receive evaluated block data, not raw authored
expressions.

The component registry should remain a lookup and validation boundary, not a
component-specific props validator.

## Connection to other docs

The extension model doc explains how components fit alongside functions and
registries as Forge's extension surface.

The registry scoping doc explains how global and package-scoped component
registries affect which variants a journey can see.

The render context doc explains how `forge-core` builds evaluated render data.

The framework rendering doc explains how framework integrations turn evaluated
blocks into a response.
