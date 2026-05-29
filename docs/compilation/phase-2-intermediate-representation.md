# Intermediate representation

## Purpose

The intermediate representation is the compiled shape of a journey definition.

It gives Forge a typed, indexed structure that the rest of compilation can use.
The authored definition remains the input format. The IR is the engine format.

This phase turns the DSL into AST nodes, assigns compile-time IDs, records
parent-child relationships, and builds lookup indexes for later compilers.

## Why Forge builds an AST

An abstract syntax tree, or AST, is a common compiler structure.

Compilers usually start with a format that is convenient to write. That might
be source code, JSON, or a builder API. They then convert that input into a tree
that is easier for the compiler to inspect and transform.

Forge follows the same pattern. The authored DSL is designed for defining
journeys. The AST is designed for compiling them.

The authored definition is already tree-shaped, but it is not yet the engine's
tree. It contains plain objects, component props, builder output, references,
conditions, hooks, and literal values mixed together.

The AST makes those roles explicit. A step becomes a step node. A block becomes
a block node. A condition, reference, hook, or outcome becomes a typed node with
an ID. Literal values remain literal values.

That distinction matters because later phases need to ask structural questions:

- which field blocks belong to this step?
- which access hooks apply before this route can render?
- which expressions need generated code?
- which blocks can appear from iterator templates?
- which node should an error message point back to?

Those questions are easier to answer against an AST than against the original
DSL object. The AST gives Forge stable node IDs, known node types, and a tree of
parent-child relationships.

This does not mean the AST is a separate journey model with different
behaviour. It is the same journey, represented in the form the compiler needs.
This is why the phase is called the intermediate representation.

## Pipeline position

Intermediate representation construction runs after DSL validation and before
runtime plans or generated functions are built.

At this point Forge already knows that the definition has a valid DSL shape.
The IR phase changes that valid definition into the structure used by
compilation.

The flow is:

1. `NodeFactory` turns the raw definition into AST nodes.

2. Per-node factories build the typed shape for journeys, steps, blocks,
   expressions, predicates, hooks, and outcomes.

3. `NodeRegistrationWalker` walks the AST and records it in the shared
   compilation structures.

4. `NodeRegistry` and `ASTNodeTree` become the main inputs for plan building
   and code generation.

## Inputs and outputs

The main input is the validated `JourneyDefinition`.

The main outputs are:

- the root journey AST node
- a `NodeRegistry` containing registered AST nodes by ID
- an `ASTNodeTree` containing parent-child and property-edge information
- step and journey indexes used by later compilation phases

These outputs are part of the shared compiled form for a journey. Route-level
compilation reuses them when it builds step handlers and journey-root handlers.

The registry answers "which node is this?" and "which nodes match this type?".
The tree answers "where does this node sit?" and "which nodes belong under this
node?".

## Key concepts

### AST nodes

AST nodes are the engine's typed representation of the authored DSL.

Each node has:

- an ID
- an AST node type
- typed properties
- the raw authored value that produced it

The main AST node types are:

- journey
- step
- block
- expression
- predicate
- hook
- outcome
- template

Sub-types keep the original DSL meaning available. For example, an expression
node may represent a reference, pipeline, conditional, iterator, function call,
or validation expression.

### `NodeFactory`

`NodeFactory` is the entry point for turning authored DSL objects into AST
nodes.

It uses authoring type guards to decide which per-node factory should handle a
value. Those factories preserve the authored structure, but convert nested DSL
objects into AST nodes where needed.

Plain values stay plain. This matters because component properties can contain
both literal values and nested Forge expressions.

### Per-node factories

Per-node factories own the AST shape for each DSL concept.

They are where authored structures become engine structures. A journey
definition becomes a journey AST node. A step definition becomes a step AST
node. A field block becomes a block AST node with field-specific properties.

Factories should stay close to that translation boundary. They should not make
runtime decisions or compile generated functions.

### Compile-time IDs

Forge assigns compile-time IDs while building and registering AST nodes.

These IDs are used by registries, runtime plans, generated functions, and
diagnostics. They let later phases refer to a node without keeping the whole
authored path in every compiled structure.

IDs let later phases pass small references around instead of passing full node
objects. Runtime plans can store node IDs, generated functions can report node
IDs in diagnostics, and compilers can look the node back up when they need the
full AST shape.

Template IDs use a separate namespace from registered AST IDs. This keeps
iterator templates separate from the shared AST nodes used by runtime plans.

### `NodeRegistrationWalker`

`NodeRegistrationWalker` normalises and indexes the AST in one traversal.

`NodeFactory` builds node objects. `NodeRegistrationWalker` records how those
objects relate to each other. Keeping those jobs separate means factories can
focus on translation, while registration owns indexing, ancestry, and reference
normalisation.

It:

- assigns missing compile-time IDs
- resolves `Self()` references
- registers AST nodes in `NodeRegistry`
- records parent-child edges in `ASTNodeTree`
- records which properties contain child nodes of particular types

Template nodes are handled specially. Forge does not register template
descendants as runtime AST nodes, but the tree still records when a property can
produce blocks. Later compilers use that information when deciding which plan
owns nested blocks.

### `NodeRegistry`

`NodeRegistry` stores AST nodes by ID.

It also indexes nodes by broad AST type and by authoring sub-type. This lets
later compilers ask for groups such as all field blocks, all iterator
expressions, or all submit hooks without walking the raw AST again.

Registered nodes are frozen. This keeps the shared compiled AST stable for the
lifetime of the compiled journey.

### `ASTNodeTree`

`ASTNodeTree` stores relationships between registered nodes.

It records:

- root nodes
- parent-child edges
- child order
- node types
- property-level edges

The property-level edges are important. They let plan builders ask structural
questions without inspecting raw AST objects. For example, a compiler can check
which properties contain blocks, or whether one node is a descendant of another
node.

A normal parent-child tree can tell Forge that one node sits below another. A
property edge also records which property created that relationship. This means
Forge can distinguish blocks under `blocks`, hooks under `onAccess`, and
expressions nested inside component properties.

## What can fail

IR construction should fail if Forge cannot turn a validated definition into a
consistent AST.

Important failure cases include:

- an object reaches `NodeFactory` but does not match a known node type
- a node is missing structure needed by its factory
- a duplicate node ID is registered
- `Self()` cannot be resolved to the containing field code

Most of these cases should already be caught by DSL validation. Keeping the
checks in the IR phase gives Forge a clear failure point if invalid data reaches
compilation anyway.

The main rule to preserve is that every registered AST node must have a stable
compile-time ID and a clear position in the tree.

## Connection to the next phase

After the IR is built, Forge builds runtime plans from the registry and tree.

Plan building uses the registry to find relevant nodes and the tree to decide
ownership, ancestry, and nesting. Code generation then uses those plans to
compile the functions used during request evaluation.

The IR phase is therefore the handoff from "definition as authored" to
"definition as compiled structure". Later phases should use the registry and
tree instead of reinterpreting the original DSL.
