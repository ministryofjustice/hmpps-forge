# Lowering

## Purpose

Lowering turns the intermediate representation into runtime plans and
per-phase execution plans containing compiled functions.

The IR tells Forge what the journey is. Lowering decides what each runtime
handler will need in order to evaluate a request.

This phase builds runtime plans and phase-specific execution plans. Runtime
plans describe the shape of the work (node IDs, topology, routing). Phase plans
contain the compiled functions that perform the repeated expression evaluation
work during request handling — one function per field, block, hook, or iterator
group.

## Why Forge compiles generated functions

Forge could interpret the journey definition on every request. Instead, it
compiles the repeated work up front.

This follows the same idea as many compilers. The framework takes a declarative
input, analyses it once, and produces a smaller set of executable plans and
functions. Runtime handlers can then use those outputs without walking the whole
definition again.

Generated functions are used for work that is both repeated and expression
heavy. This includes validation, answer preparation, reachability checks,
hooks, and rendering.

Forge compiles the call sites for registered conditions, transformers,
generators, and effects. It does not inline their implementations. Those
functions are resolved through the function registry at runtime.

    Note: 
    This approach was heavily influenced by systems that turn declarative input 
    into a more efficient runtime form. Nunjucks compiles templates into executable 
    render functions. AJV compiles JSON schemas into validation functions. Svelte 
    and Vue also show how much work can move out of the runtime path when a 
    framework can analyze structure ahead of time. All of these implement a 
    similar pipeline of Definition -> Parse -> IR -> Compilation -> Execution.

    This work, whilst adding some level of complexity to the project, pays 
    off hugely for runtime performance and ensuring incredibly large or complex 
    journeys can stay performant, even with all the validation, reachability and 
    rendering logic the engine performs.

## Pipeline position

Lowering runs after the intermediate representation has been built and semantic
analysis has passed.

It uses the `ASTNodeIndex` and `ASTNodeTree` from phase 2. The registry tells
compilers which nodes exist. The tree tells compilers where those nodes sit in
the journey.

The flow is:

1. `CompilationPlanner` builds runtime plans from the registry and tree.

2. `CodegenOrchestrator` drives the phase compilers. It compiles each distinct
   field, block, hook, and iterator group exactly once, deduplicating by node
   ID. The compiled entries are stored in hoisted lookup maps.

3. Expression compilers turn AST expressions into JavaScript source.

4. `GeneratedFunctionCompiler` turns that source into executable functions.

5. `CodegenOrchestrator` assembles per-step and per-journey phase plans by
   looking up the hoisted entries. Each step receives its own `ValidationPlan`,
   `AnswerPreparationPlan`, `RenderPlan`, `AccessLifecyclePlan`,
   `SubmitLifecyclePlan`, and `EntryValidationPlan` — but the compiled
   functions inside those plans are shared across steps that reference the same
   fields, blocks, or hooks.

## Inputs and outputs

The main inputs are:

- the root journey AST node
- the shared `ASTNodeIndex`
- the shared `ASTNodeTree`
- the step and journey indexes
- the function registry for the journey being compiled

The main outputs are:

- step runtime plans and per-phase execution plans (`CompiledStep`)
- journey runtime plans and per-phase execution plans (`CompiledJourney`)
- reachability runtime plans with compiled navigation functions

Each `CompiledStep` carries phase plans that contain the compiled functions for
that step's fields, blocks, hooks, and iterator groups. The plans are the
contract between compilation and runtime. Runtime does not need to inspect the
original DSL. It walks each phase plan and calls the compiled functions inside
it.

## Key concepts

### Runtime plans

Runtime plans are small objects that describe what a handler needs to do.

They store node IDs and topology, not generated source. For example, a step
runtime plan records the current step ID, the route path, and static data.

Phase plans sit alongside the runtime plan and contain the compiled functions
for each phase of the request lifecycle. For example, a `ValidationPlan`
contains a `FieldValidationEntry` per field and an `IteratorValidationGroup`
per MAP iterator, each holding a compiled function. An `AccessLifecyclePlan`
contains an `AccessHookEntry` per hook. A `RenderPlan` contains a
`RenderBlockEntry` per block plus optional step and ancestor metadata functions.

This keeps planning separate from code generation. The runtime plan says which
node this is. The phase plans say how to evaluate it — one compiled function per
unit of work.

### `CompilationPlanner`

`CompilationPlanner` builds plans from the registry and tree.

It uses the registry to find nodes by type, and the tree to answer ownership and
ancestry questions. For example, it can find field blocks under a step, iterator
nodes under a route, or the access chain for a nested journey.

The builder creates different plan shapes for different runtime jobs:

- step plans for GET and POST handling on a step route
- journey plans for journey-root handling
- reachability plans shared by the direct steps in a journey

Reachability plans are shared because navigation decisions need the shape of the
whole journey branch, not just the current step.

### Phase compilers

Phase compilers each own one part of request evaluation.

They receive AST nodes and produce per-entry compiled functions.
`CodegenOrchestrator` calls each compiler once per distinct node (field, block,
hook, or iterator group), deduplicating by node ID, then assembles the results
into per-step phase plans.

The main phase compilers are:

| Compiler | Output plan | Compiled per |
|----------|-------------|--------------|
| `StepValidationCompiler` | `ValidationPlan` / `EntryValidationPlan` | field, iterator group, domain rule, entry rule |
| `StepAnswerPreparationCompiler` | `AnswerPreparationPlan` | field, iterator group |
| `StepRenderCompiler` | `RenderPlan` | block, iterator group, step metadata, ancestor metadata |
| `HookLifecycleCompiler` | `AccessLifecyclePlan` / `SubmitLifecyclePlan` | hook |
| `ReachabilityCompiler` | compiled navigation function | journey branch (single function) |
| `StepFieldInventoryCompiler` | field inventory sources | step |

Each compiler should keep its responsibility narrow. Validation compiles
validation. Rendering compiles render-context evaluation. Reachability compiles
the expression values needed by navigation, while the graph policy stays in
ordinary TypeScript runtime code.

### `CodegenOrchestrator`

`CodegenOrchestrator` drives the full compilation pass.

Its `compileAll` method coordinates the phase compilers in two stages. First, it
compiles every distinct field, block, hook, and iterator group once, storing the
results in hoisted lookup maps keyed by node ID. Second, it assembles per-step
and per-journey phase plans by selecting entries from those maps.

This means a field shared by multiple steps is compiled once and referenced by
each step's plan. A journey-level access hook is compiled once and shared by
every step under that journey. Validation plans are compiled once and reused
both by step execution and by navigation reachability checks.

The hoisting pattern keeps compilation time proportional to the number of
distinct nodes, not the number of steps times nodes per step.

### Expression compilation

Most phase compilers need to evaluate authored expressions.

`ExpressionDispatcher` is the shared entry point for compiling expression
nodes. It dispatches to compilers for references, predicates, pipelines,
conditionals, matches, and function calls.

Keeping expression compilation behind one dispatcher means the same rules apply
across validation, rendering, reachability, hooks, and answer preparation.

The dispatcher also tracks temporary code-generation state, such as iterator
scope, `Self()` scope, diagnostics, and whether the generated function needs to
be async.

### Source generation

`CodeEmitter` helps compilers build JavaScript source.

It gives generated code stable indentation, unique variable names, scoped
blocks, loops, and conditionals. This keeps generated source inspectable, which
matters when a compilation failure or runtime diagnostic needs to point back to
the compiler that produced it.

Generated source is not a public API. It is an internal output of compilation.
The important contract is the compiled function shape that runtime handlers
call.

    Note:
    It is quite interesting to view the compiled source - seeing how the engine 
    has turned a definition into executable logic goes quite a long way for 
    understanding how evaluations are made at runtime, and can also be useful for 
    debugging why something maybe evaluating incorrectly. This can be done  
    by writing a dummy test and feeding structures into each Compiler class, then 
    logging its output.

### Generated functions

`GeneratedFunctionCompiler` turns source strings into executable functions.

It chooses between sync and async functions based on the expressions compiled
for that phase. Hook lifecycles can force async execution because effects must
complete before Forge inspects hook outcomes.

Generated functions are wrapped with runtime diagnostics. If generated code
throws, Forge can attach the phase, node ID, DSL path, formatted path, function
name, and function type where that information is available.

## What can fail

Compilation should fail if Forge cannot build a plan or compile a generated
function from the IR.

Important failure cases include:

- a plan refers to a node that is missing from the registry
- source generation produces invalid JavaScript
- a phase compiler receives a node shape it does not support
- generated-function construction fails

Some expression problems may still surface at runtime. For example, a registered
function can throw, or request context can contain a value a journey function
does not expect. Those failures are wrapped with runtime diagnostics where Forge
has enough metadata.

The main rule to preserve is that runtime handlers should use compiled plans
and functions. They should not reinterpret the original DSL.

## Connection to the next phase

After compilation, Forge has the plans needed by runtime route handlers.

Each step receives a `CompiledStep` containing its runtime plan and per-phase
execution plans: `AccessLifecyclePlan`, `AnswerPreparationPlan`,
`ValidationPlan`, `EntryValidationPlan`, `SubmitLifecyclePlan`, and
`RenderPlan`. Each journey root receives a `CompiledJourney` with its runtime
plan, `AccessLifecyclePlan`, and `AnswerPreparationPlan`.

Runtime walks these phase plans and calls the compiled functions inside them.
Each phase has a dedicated evaluator that knows the plan shape — for example,
`evaluateValidation` walks the validation plan's field entries and iterator
groups, calling each compiled function and collecting failures.

Runtime then evaluates each request using those plans, the request context, and
the registered functions and components for the journey.
