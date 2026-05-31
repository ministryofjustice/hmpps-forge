# ast - building the tree

The `ast/` layer turns an author's definitions into a normalised, frozen tree of
nodes that every later layer can walk without knowing anything about the
authoring API. Authoring shapes go in, uniform `ASTNode`s come out.

## Why the tree is a boundary

The AST is the **only** thing the rest of the engine ever sees. `lowering/` and
`runtime/` never touch the authoring API - no `journey()`, no `field()`, no
`Self()`. They read `ASTNode`s and nothing else. That buys the framework two
things:

- **Internals can change without breaking any app built on Forge.** As long as
  authoring keeps producing the same tree, lowering and runtime can be rewritten
  freely - new codegen, a different execution model, performance work - and not
  one journey anyone has written needs to change.
- **New ways to author can be added without touching the engine.** A different
  builder DSL, a config format, an importer, a visual editor - anything that
  emits the AST is a valid front-end.

The authoring API and the engine evolve on their own clocks and meet only at
this tree.

## Watch one field become nodes

An author writes a journey with one step and one validated field - note
`Self()`:

```ts
journey({ code: 'demo', path: '/demo', title: 'Demo', steps: [
  step({ path: '/name', title: 'Your name', blocks: [
    field({ code: 'visitorName', validWhen: [
      validation({ condition: Self().match(Condition.IsRequired()), message: 'Enter your full name' }),
    ] }),
  ] }),
] })
```

Construction happens in two passes (both kicked off from
`JourneyCompiler.buildAstTree`):

1. [`NodeFactory.createNode(definition)`](./nodes/NodeFactory.ts) recurses the
   authored object, dispatches each piece to a per-kind factory (journey, step,
   block, reference, predicate, …), and builds the typed nodes.
2. [`NodeRegistrationWalker.register(root)`](./ast-state/NodeRegistrationWalker.ts)
   walks the tree once: assigns ids, resolves `Self()` against the enclosing
   field, records parent/child edges, and registers each node into
   [`ASTNodeIndex`](./ast-state/ASTNodeIndex.ts) - which `Object.freeze`s it.

The result:

```
AstNode.Journey  (compile_ast:7)
└─ properties
   ├─ code: "demo"
   ├─ path: "/demo"
   ├─ title: "Demo"
   └─ steps
       └─ [0] AstNode.Step  (compile_ast:6)
          └─ properties
             ├─ path: "/name"
             ├─ title: "Your name"
             └─ blocks
                 └─ [0] AstNode.Block  (compile_ast:5)
                    ├─ blockType: "BlockType.field"
                    └─ properties
                       ├─ code: "visitorName"
                       └─ validWhen
                           └─ [0] AstNode.Expression  (compile_ast:4)
                              ├─ expressionType: "ExpressionType.Validation"
                              └─ properties
                                 ├─ message: "Enter your full name"
                                 └─ condition
                                     └─ AstNode.Predicate  (compile_ast:1)
                                        ├─ predicateType: "PredicateType.Test"
                                        └─ properties
                                           ├─ negate: false
                                           ├─ subject
                                           │   └─ AstNode.Expression  (compile_ast:2)
                                           │      ├─ expressionType: "ExpressionType.Reference"
                                           │      ├─ path: ["answers", "visitorName"]   // Self() resolved
                                           │      └─ raw.path: ["answers", "@self"]     // original preserved
                                           └─ condition
                                               └─ AstNode.Expression  (compile_ast:3)
                                                  ├─ expressionType: "FunctionType.Condition"
                                                  └─ properties
                                                     ├─ name: "IsRequired"
                                                     └─ arguments: []
```

The same tree as actual node data (trimmed - every node also carries a `raw`
copy of what it was authored as, shown only on the reference where it matters):

```jsonc
{
  "id": "compile_ast:7",
  "type": "AstNode.Journey",
  "properties": {
    "code": "demo",
    "steps": [
      {
        "id": "compile_ast:6",
        "type": "AstNode.Step",
        "properties": {
          "path": "/name",
          "blocks": [
            {
              "id": "compile_ast:5",
              "type": "AstNode.Block",
              "blockType": "BlockType.field",
              "properties": {
                "code": "visitorName",
                "validWhen": [
                  {
                    "id": "compile_ast:4",
                    "type": "AstNode.Expression",
                    "expressionType": "ExpressionType.Validation",
                    "properties": {
                      "message": "Enter your full name",
                      "condition": {
                        "id": "compile_ast:1",
                        "type": "AstNode.Predicate",
                        "predicateType": "PredicateType.Test",
                        "properties": {
                          "negate": false,
                          "subject": {
                            "id": "compile_ast:2",
                            "type": "AstNode.Expression",
                            "expressionType": "ExpressionType.Reference",
                            "properties": { "path": ["answers", "visitorName"] },  // Self() resolved
                            "raw":        { "path": ["answers", "@self"] }         // original kept
                          },
                          "condition": {
                            "id": "compile_ast:3",
                            "type": "AstNode.Expression",
                            "expressionType": "FunctionType.Condition",
                            "properties": { "name": "IsRequired", "arguments": [] }
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}
```

What happened:

- **`Self()` was resolved.** The author wrote `["answers", "@self"]`; the node
  holds `["answers", "visitorName"]` - the placeholder replaced with the
  enclosing field's code, once, at build time. The original is kept in `raw`.
  Nothing downstream ever has to know what `@self` meant.
- **Every node got an id** (`compile_ast:1…7`), assigned deepest-first during
  the registration walk. These are the engine's coordinate system - the same ids
  appear in the generated code (see [`lowering/`](../lowering/README.md)) and in
  runtime error messages. Ids are deterministic: the same authored journey
  always produces the same numbering, because
  [`NodeIDGenerator`](./ast-state/NodeIDGenerator.ts) is a counter, not random.
- **Authoring shapes became uniform nodes.** `StructureType.Journey →
  AstNode.Journey`, `ExpressionType.Validation → AstNode.Expression` (kind kept
  in `expressionType` / `predicateType`). Everything is `{ id, type, properties }`
  - a single tree-walk handles any node.
- **`raw` records the source.** Every node remembers what it was authored as,
  which is how diagnostics point back at the author's code.
- **The tree is frozen.** After registration every node is `Object.freeze`d -
  it's shared, read-only input from here on.

## Semantic validation

After the tree is built and registered, `JourneyCompiler` runs
[`ASTSemanticValidator`](./validation/ASTSemanticValidator.ts) on the frozen AST.
This validates rules that need typed nodes and ancestry information:

- **Reference scopes** - `Self()` only inside field blocks, `Item()` and `Loop`
  only inside iterators with sufficient nesting depth.
- **Effect scope** - effect functions only inside access/submit hooks.
- **Registered functions** - every condition, transformer, generator, and effect
  name exists in the function registry.
- **Registered components** - every block variant exists in the component
  registry.

Rules query the `ASTNodeIndex` and `ASTNodeTree` directly instead of
re-walking raw objects. Template subtrees (inside iterate `yieldTemplate` /
`predicateTemplate`) are not registered in the index, so a focused
[template walker](./validation/rules/templateWalker.ts) handles them separately.

## Key files

| File | Role |
|------|------|
| [`nodes/NodeFactory.ts`](./nodes/NodeFactory.ts) | Dispatcher; routes authored input to per-kind factories under `nodes/` (`structures/`, `expressions/`, `predicates/`, `outcomes/`, `hooks/`, `template/`) |
| [`ast-state/NodeRegistrationWalker.ts`](./ast-state/NodeRegistrationWalker.ts) | One-pass normalisation walk: assigns ids, resolves `Self()`, records parent edges, registers + freezes nodes |
| [`ast-state/ASTNodeIndex.ts`](./ast-state/ASTNodeIndex.ts) | Node registry; lookup by id and by type (`findByType`). This is what `lowering/` and `validation/` query |
| [`ast-state/ASTNodeTree.ts`](./ast-state/ASTNodeTree.ts) | Parent/child edges for ancestry queries |
| [`ast-state/NodeIDGenerator.ts`](./ast-state/NodeIDGenerator.ts) | Deterministic id counter (`compile_ast:` and `template:` namespaces) |
| [`validation/ASTSemanticValidator.ts`](./validation/ASTSemanticValidator.ts) | Runs semantic rules on the frozen AST (reference scopes, effect scope, function/component registration) |
| [`testing-helpers/`](./testing-helpers/) | `ASTTestFactory` and matchers for building/asserting nodes in tests (exempt from layer boundaries) |

`ast/` may depend on `contracts/` and `authoring/`, never on `lowering/` or
`runtime/` - it's upstream of both. Enforced by eslint.
