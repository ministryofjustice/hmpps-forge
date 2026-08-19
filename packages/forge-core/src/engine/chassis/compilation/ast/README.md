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
- Register the created AST nodes by ID, indexed type, and parent relationship.

## Data Model

An AST node has an `id`, a `type`, optional `diagnostics`, and optional `properties`.

The broad node type comes from `ASTNodeType`.  Some node families also have an indexed subtype:
- expressions use `expressionType`
- predicates use `predicateType`
- hooks use `hookType`
- outcomes use `outcomeType`
- blocks use `blockType`

`ASTNodeIndex` indexes the broad type for every node.
It also indexes the subtype fields listed above.

Template nodes use `ASTNodeType.TEMPLATE`, whose runtime value is `AstNode.Template`.
They preserve AST-like structure but are excluded from normal AST registration.

### Example

A `Test` predicate shows the transform. Authors usually write the chainable DSL form:

```ts
Answer('field').match(Condition.Equals(true))
```

The builders turn that into the authoring definition that `NodeFactory` receives:

```jsonc
{
  type: 'PredicateType.Test',
  subject: { type: 'ExpressionType.Reference', path: ['answers', 'field'] },
  negate: false,
  condition: { type: 'FunctionType.Condition', name: 'Equals', arguments: [true] },
}
```

which becomes this AST node:

```jsonc
{
  id: 'compile_ast:1',
  type: 'AstNode.Predicate',
  predicateType: 'PredicateType.Test',
  properties: {
    subject: {                                  // nested definition promoted to its own node
      id: 'compile_ast:2',
      type: 'AstNode.Expression',
      expressionType: 'ExpressionType.Reference',
      properties: { path: ['answers', 'field'], base: undefined },
      diagnostics: ...
    },
    condition: {
      id: 'compile_ast:3',
      type: 'AstNode.Expression',
      expressionType: 'FunctionType.Condition',
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

AST building is a two-pass process, driven in sequence by `CompilationPipeline.buildAstTree()`.
The first pass (`NodeFactory.createNode()`) builds the node tree from authoring definitions.
The second pass (`NodeRegistrationWalker.register()`) walks that tree to assign any missing compile IDs, resolve `Self()`, wire each node's `parent` link, and index each node.

```mermaid
flowchart TD
  authoringDefinition["Authoring definition"] -->|enter AST creation| nodeFactory["NodeFactory.createNode()"]
  nodeFactory -->|look up creator by type discriminant| nodeCreator["Node creator"]
  nodeCreator -->|create node and transform nested values| astNode["AST node"]
  astNode -->|attach source diagnostics| diagnosticNode["AST node with diagnostics"]
  diagnosticNode -->|start registration walk| registrationWalker["NodeRegistrationWalker"]
  registrationWalker -->|inspect value| templateCheck{"Template node?"}
  templateCheck -->|yes| skipTemplate["Skip node and children"]
  templateCheck -->|no| wireParent["Wire parent link"]
  wireParent -->|assign non-enumerable parent| registerNode["ASTNodeIndex"]
  registerNode -->|store frozen node by ID and type| walkProperties["Node properties"]
  walkProperties -->|walk descendants| templateCheck
```

- [NodeFactory.ts](nodes/NodeFactory.ts) starts node creation.
  `createNode()` checks that the input is an object, then looks up the creator for its `type` discriminant in the `creatorsByType` table.
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
  The walker skips template nodes, assigns a compile ID when an AST-shaped value has no ID, resolves `Self()` references, wires each node's `parent` link, and registers each ordinary AST node in `ASTNodeIndex`.

## Boundaries

- Node factories create node structure.
  They should not register nodes.
- `NodeRegistrationWalker` owns registration-time behavior.
  That includes missing compile IDs, parent links, and `Self()` resolution.
- Lookup and ancestry are separately handled.
  `ASTNodeIndex` owns lookup by type, and ancestry lives on each node's `parent` link.
- `compileTemplate` owns conversion of AST-shaped values into template nodes.
  Template nodes should not be treated as ordinary AST nodes.

## Quirks

- Templates are AST-shaped but not AST nodes.
  Iterate payloads describe forms that do not exist until runtime data provides collection items.
  They are kept as templates so compile-time planning does not treat those forms as already materialised.
- Templates are compiled at compile time, but the iterated form only exists at request time.
  `compileTemplate()` runs at compile time, freezing the iterator payload into a template.
  Templates are never rebuilt into AST nodes at request time. Lowering compiles the template's values inline into generated source (see `ScopedTemplateCompiler`), and the generated loop evaluates them once per collection item, using the template ID as the stable prefix for generated instance IDs.
  Deferring evaluation to runtime is the reason templates exist: the form is materialised only when the iterated collection is known.
- `Self()` is resolved during registration.
  Node factories can see the current DSL path, but they do not know the containing field stack.
  The registration walk has that context, so it replaces `Self()` while registering the tree.
- The index does not answer ancestry questions.
  `ASTNodeIndex` answers lookup questions by type.
  Ancestry questions are answered by walking the `parent` link carried on each registered node.

## Constraints

- Do not register template nodes.
  If these are registered, they are added to the AST tree and pulled into compilation plans,
  even though they are not materialized. The registration walk returns immediately
  for `isTemplateNode(value)`, and `isASTNode()` excludes `ASTNodeType.TEMPLATE`, to prevent that.
- Do not add `Self()` resolution to node factories.
  `Self()` resolution depends on the current field stack and the field whose `code` property owns the current traversal.
  That state exists in `NodeRegistrationWalker`, not in `NodeFactory`.
- Keep `Self()` valid for its resolution context.
  `NodeRegistrationWalker.resolveSelfReference()` throws in three cases:
  - `self_outside_field` when `Self()` is used with no containing field on the stack.
  - `self_inside_code` when the current code owner is the containing field (`Self()` inside that field's own `code`).
  - `missing_field_code` when the containing field has no `code` for `Self()` to resolve to.
- Do not mutate nodes after registration.
  `ASTNodeIndex.register()` stores `Object.freeze(node)`.
- Do not use one ID counter for compile AST nodes and template nodes.
  `NodeIDGenerator` has separate counters for `compile_ast` and `template`.
- Do not move semantic analysis before registration.
  It is tempting to reject a bad journey before building the tree, but semantic rules consume the registry and `parent` links that registration produces.
  `ASTSemanticValidator` queries `ASTNodeIndex` (e.g. every function node via `findByType`) and walks `parent` links (ancestry for scope rules), so those must already exist.
  The `Self()` errors that the walker throws are failures of a required normalization step, not free-standing validation that could run earlier.

## Editing Notes

- To add a new authoring node type, write a creator in its family file and add a row to the `creatorsByType` table.
  The completeness test in `NodeFactory.test.ts` fails until every value of the new discriminant enum has a row.
- To add a new expression, predicate, hook, outcome, or block subtype, return the broad `ASTNodeType` plus the subtype field used by that family.
  If the subtype should be queryable through `ASTNodeIndex.findByType()`, add it to `ASTNodeIndex.getNodeSubType()`.
- To transform nested authoring values, call back through `NodeBuildContext`.
  Use `createNode()` when the child must be an AST node.
  Use `transformValue()` when the child may be a primitive, array, object, or AST node.
- To add data that should not be transformed, assign it directly in the creator.
  Existing examples include `metadata`, `data`, and some config values.
- To change iterate template behavior, start in `createIterateNode` and `compileTemplate`.
  Do not make iterator payloads ordinary registered descendants unless the registration behavior is also changed.

## Entry Points

- [NodeFactory.ts](nodes/NodeFactory.ts) holds the `creatorsByType` registry of `type` discriminants and dispatches authoring definitions through it.
- [NodeRegistrationWalker.ts](ast-state/NodeRegistrationWalker.ts) registers nodes and handles `Self()`.
- [ASTNodeIndex.ts](ast-state/ASTNodeIndex.ts) registers frozen nodes and indexes them by type.
- [template.ts](nodes/template.ts) compiles AST-shaped values into template nodes.
