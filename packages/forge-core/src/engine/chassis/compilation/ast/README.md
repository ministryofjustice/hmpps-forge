# AST Compilation

## Scope

This document covers `packages/forge-core/src/engine/chassis/compilation/ast`.

This code creates AST nodes from authoring definitions and registers those nodes for later compiler work.

This document does not cover expression evaluation, runtime execution, or generated output.

## Background

An AST is an Abstract Syntax Tree. It is the engine's intermediate representation of a journey as a big tree of nodes.

Authors write journeys in a DSL that is easy to read and write. That format is good for authoring, but not so good for
compiling. So to make later stages easier, we convert it into a tree of typed nodes, where each node has an ID and
a known role. That tree is much easier to inspect and transform than the original definition.

You might be thinking 'But... the authored definition is already tree-shaped!' and whilst true, it mixes plain objects,
references, conditions, and literals all together. The AST pulls those apart. A step becomes a step node.
A condition becomes a condition node. Importantly, a literal stays a literal.

That matters because later phases ask structural questions - 'which fields are in this step?', 'which expressions need
generated code?', 'which node an error should point back to?'. Those are easy to answer against an AST,
but super awkward to answer against the raw definition.

## Responsibilities

- Turn recognised authoring objects into AST nodes.
- Attach source diagnostics to those nodes while the original DSL path is still known.
- Register materialised AST nodes by ID, exact kind, immediate family, and parent relationship.
- Index template contents by kind and family in `TemplateNodeIndex`, without registering them as materialised nodes.

## Data Model

An AST node has an `id`, one exact semantic `kind`, a required `isTemplate` state, optional `diagnostics`, and optional
`properties`. The `kind` is the supported AST subset of the same taxonomy used by authored `_forge` tags. For example,
`ExpressionType.REFERENCE`, `FunctionCallType.CONDITION`, and `ComponentCallType.FIELD` remain those exact values in the AST.

`ASTNodeIndex` indexes materialised nodes by exact kind and by the kind's immediate taxonomy family. A reference can
therefore be queried as `ExpressionType.REFERENCE` through `findByKind()`, or with all value expressions through
`findByFamily(ASTNodeFamily.EXPRESSION)`.

Template state is orthogonal to semantic identity. Materialised nodes carry `isTemplate: false` and a `compile_ast` ID;
template nodes carry `isTemplate: true` and a `template` ID. Both retain the same `kind`.

### Example

A `Test` predicate shows the transform. Authors usually write the chainable DSL form:

```ts
Answer('field').match(Condition.Equals(true))
```

The builders turn that into the authoring definition that `NodeFactory` receives:

```jsonc
{
  _forge: 'predicate.test',
  subject: { _forge: 'expression.reference', path: ['answers', 'field'] },
  negate: false,
  condition: { _forge: 'function.call.condition', name: 'Equals', arguments: [true] },
}
```

which becomes this AST node:

```jsonc
{
  id: 'compile_ast:1',
  kind: 'predicate.test',
  isTemplate: false,
  properties: {
    subject: {                                  // nested definition promoted to its own node
      id: 'compile_ast:2',
      kind: 'expression.reference',
      isTemplate: false,
      properties: { path: ['answers', 'field'], base: undefined },
      diagnostics: ...
    },
    condition: {
      id: 'compile_ast:3',
      kind: 'function.call.condition',
      isTemplate: false,
      properties: { name: 'Equals', arguments: [true] },
      diagnostics: ...
    },
    negate: false,
  },
  diagnostics: {
    source: {
      path: ['steps', 0, 'blocks', 0, 'validWhen', 0],
      formattedPath: 'travel-declaration > personal-details > blocks[0] (…) > validWhen[0]',
    },
  },
}
```

## Flow

AST building is a two-pass process, driven in sequence by `CompilationAstWorkHandler`.
The first pass (`NodeFactory.createNode()`) builds the node tree from authoring definitions.
The second pass (`NodeRegistrationWalker.register()`) walks that tree to wire each node's `parent` link and index each node.

```mermaid
flowchart TD
  authoringDefinition["Authoring definition"] -->|enter AST creation| nodeFactory["NodeFactory.createNode()"]
  nodeFactory -->|look up creator by authored _forge tag| nodeCreator["Node creator"]
  nodeCreator -->|create node and transform nested values| astNode["AST node"]
  astNode -->|attach source diagnostics| diagnosticNode["AST node with diagnostics"]
  diagnosticNode -->|start registration walk| registrationWalker["NodeRegistrationWalker"]
  registrationWalker -->|inspect value| templateCheck{"Template node?"}
  templateCheck -->|yes| indexTemplate["Index contents in TemplateNodeIndex"]
  templateCheck -->|no| wireParent["Wire parent link"]
  wireParent -->|assign non-enumerable parent| registerNode["ASTNodeIndex"]
  registerNode -->|store frozen node by ID, kind, and family| walkProperties["Node properties"]
  walkProperties -->|walk descendants| templateCheck
```

- [NodeFactory.ts](nodes/NodeFactory.ts) starts node creation.
  `createNode()` checks that the input is an object, then looks up the creator for its `_forge` tag in the `creatorsByForgeTag` table.
  The table has one row per discriminant enum value; discriminant values are namespaced strings, so one flat map covers every node family.
- The creator builds one AST node.
  Node-specific values go under `properties`.
  Creators are grouped into one file per family (`structures.ts`, `expressions.ts`, `predicates.ts`, `hooks.ts`, `outcomes.ts`).
- Creators call back into the walker through their `NodeBuildContext` for nested values that may contain another node.
  The members are `createNode()` (child must be a node), `transformValue()` (child may be a primitive, array, object, or node), `nextId()`, `compileTemplate()`, and `diagnosticsFor()`.
- Inline-only types (condition combinators, iterator configs) have table rows that always throw.
  They are consumed by the match and iterate creators directly and are never standalone AST nodes; the throwing row keeps a stray one failing compilation with an error that says where it belongs.
- `withDiagnostics()` reads the `__source`/`__callsite` stamps off the authored object to attach source information to the node.
- [NodeRegistrationWalker.ts](ast-state/NodeRegistrationWalker.ts) starts registration.
  The walker wires each node's `parent` link and registers each ordinary AST node in `ASTNodeIndex`.
  When the walker meets a template node, it indexes the template contents in `TemplateNodeIndex` against the registered node that carries the template, and does not descend further as an ordinary registration.

## Boundaries

- Node factories create node structure.
  They should not register nodes.
- `NodeRegistrationWalker` owns registration-time behavior.
  That includes parent links and the diversion of template contents into `TemplateNodeIndex`.
- `Self()` is not an AST concern.
  Semantic analysis validates its placement (`validateSelfScope`), and lowering resolves it against the field code bound through `ExpressionDispatcher.withSelfCodeExpression()`.
- Lookup and ancestry are separately handled.
  `ASTNodeIndex` owns lookup by kind or family, and ancestry lives on each materialised node's `parent` link.
- `compileTemplate` owns conversion of AST-shaped values into template nodes.
  Template nodes should not be treated as ordinary AST nodes.

## Quirks

- Templates and materialised nodes are both AST nodes, distinguished by `isTemplate`.
  Iterate payloads describe forms that do not exist until runtime data provides collection items.
  They are kept as templates so compile-time planning does not treat those forms as already materialised.
- Templates are compiled at compile time, but the iterated form only exists at request time.
  `compileTemplate()` runs at compile time, freezing the iterator payload into a template.
  Templates are never rebuilt into AST nodes at request time. Lowering compiles the template's values inline into generated source (see `ScopedTemplateCompiler`), and the generated loop evaluates them once per collection item, using the template ID as the stable prefix for generated instance IDs.
  Deferring evaluation to runtime is the reason templates exist: the form is materialised only when the iterated collection is known.
- The index does not answer ancestry questions.
  `ASTNodeIndex` answers lookup questions by kind and family.
  Ancestry questions are answered by walking the `parent` link carried on each registered node.

## Constraints

- Do not register template nodes in `ASTNodeIndex`.
  If these are registered, they are added to the AST tree and pulled into compilation plans,
  even though they are not materialized. The registration walk diverts template nodes into
  `TemplateNodeIndex`; `isMaterialisedASTNode()` prevents template nodes crossing the registration boundary.
- Do not consume `TemplateNodeIndex` outside semantic analysis.
  The index exists so semantic rules can query template contents by type.
  Analysis and lowering must not plan against unmaterialised nodes.
- Do not mutate nodes after registration.
  `ASTNodeIndex.register()` stores `Object.freeze(node)`.
- Do not use one ID counter for compile AST nodes and template nodes.
  `NodeIDGenerator` has separate counters for `compile_ast` and `template`.
- Do not move semantic analysis before registration.
  It is tempting to reject a bad journey before building the tree, but semantic rules consume the registry and `parent` links that registration produces.
  `ASTSemanticValidator` queries `ASTNodeIndex` (e.g. every function node via `findByKind`) and walks `parent` links (ancestry for scope rules), so those must already exist.

## Editing Notes

- To add a new authoring node type, write a creator in its family file and add a row to the `creatorsByForgeTag` table.
  The completeness test in `NodeFactory.test.ts` fails until every value of the new discriminant enum has a row.
- To add a new AST kind, include it in `ASTNodeKind`, return it directly from the creator, and ensure its immediate prefix is represented by `ASTNodeFamily`.
- To transform nested authoring values, call back through `NodeBuildContext`.
  Use `createNode()` when the child must be an AST node.
  Use `transformValue()` when the child may be a primitive, array, object, or AST node.
- To add data that should not be transformed, assign it directly in the creator.
  Existing examples include `metadata`, `data`, and some config values.
- To change iterate template behavior, start in `createIterateNode` and `compileTemplate`.
  Do not make iterator payloads ordinary registered descendants unless the registration behavior is also changed.

## Entry Points

- [NodeFactory.ts](nodes/NodeFactory.ts) holds the `creatorsByForgeTag` registry and dispatches authoring definitions by `_forge` tag.
- [NodeRegistrationWalker.ts](ast-state/NodeRegistrationWalker.ts) registers nodes and wires parent links.
- [ASTNodeIndex.ts](ast-state/ASTNodeIndex.ts) registers frozen materialised nodes and indexes them by kind and family.
- [TemplateNodeIndex.ts](ast-state/TemplateNodeIndex.ts) indexes template contents by kind and family for semantic analysis.
- [template.ts](nodes/template.ts) compiles AST-shaped values into template nodes.
