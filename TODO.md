# ResponseBindings: adapter-owned effect IO

Replace the engine-owned response buffer (`RecordingStepResponse` / `ForgeEffects`) with
adapter-provided callbacks that effect hooks call directly. The adapter owns what
"response IO" means; the engine just passes bindings through to effects.

## The problem today

- `RecordingStepResponse` buffers response writes (headers, cookies) in-memory
  during evaluation, then `toEffects()` extracts them onto the `ForgeOutcome`
- The adapter calls `flushEffects(outcome.effects, res)` to replay them onto the
  real response after the fact
- The names are bad (`RecordingStepResponse`, `ForgeEffects`) and the `effects`
  token collides with the AST's "declared effect functions"
- There's an asymmetry: session is already a live adapter-owned reference, but
  headers/cookies are a buffered bag the engine manages and returns
- The engine hardcodes HTTP response semantics (headers + cookies) — a future
  React/CLI adapter would have entirely different "response IO"

## The design

The adapter provides a `ResponseBindings` to `forge.evaluate()`. The engine wires
it into effect hooks at the chokepoint. The outcome carries NO response data.

```ts
interface ResponseBindings {
  setHeader(name: string, value: string): void
  getHeader(name: string): string | undefined
  setCookie(name: string, value: string, options?: CookieOptions): void
  getCookie(name: string): CookieMutation | undefined
}

// evaluate signature
evaluate(snapshot: RequestSnapshot, bindings?: { response?: ResponseBindings }): Promise<ForgeOutcome>

// outcome becomes pure — no response mutations
type ForgeOutcome =
  | { kind: 'render'; context: RenderContext; componentRegistry: ComponentRegistry }
  | { kind: 'navigate'; url: string }
  | { kind: 'error'; error: ForgeError }
```

## Key architectural facts (verified against the code)

### Only effect hooks touch the response
- The response is reachable solely through `buildCompiledHookLifecycleContext`
  (`compiledEvaluationContext.ts:101-104`) — the ONLY builder that includes
  `context.response`
- Called from exactly two phases: `accessLifecyclePhase` (hookType `'access'`)
  and `submitPhase` (hookType `'submit'`)
- NOT touched by: answerPreparationPhase, entryValidationPhase, navigationPhase,
  stepRenderTerminal, journeyRedirectTerminal, RequestOrchestrator, ContextPreparer
- Consequence: the change is scoped NARROWLY to effect invocation

### Request reads stay snapshot data — do NOT make them callbacks
- ~12 request read methods (getRequestHeader, getQueryParam, getPostData,
  getState, getRequestCookie, etc.) read inert fields off the immutable
  `RequestSnapshot` via `SnapshotStepRequest`
- Making them callbacks would RE-INTRODUCE the live-framework access the snapshot
  was explicitly built to remove, for zero gain
- Non-effect phases (navigation, render, answer-prep) also read from the request
  — they must stay snapshot-based

### Session stays a live reference — do NOT promote it
- `snapshot.session = req.session` (verbatim, by reference)
- Engine mutates it in place; express-session persists by observing the mutation
- Promoting it to a recorded draft breaks: (a) express-session's `Session`
  prototype (.save/.regenerate/.cookie), (b) intra-request read consistency
  because `buildCompiledBaseContext` snapshots session by value per phase
  (`compiledEvaluationContext.ts:53`)
- Leave it as the documented live caller-owned reference

### The single injection chokepoint
- `buildCompiledHookLifecycleContext` (`compiledEvaluationContext.ts:88-106`)
- The ONLY place `EffectFunctionContext` is constructed
- Compiler emits only `ctx.effectFunctionContext` and `ctx.validate`
  (`HookLifecycleCompiler.ts:252`) — so swapping the backing implementation
  requires NO codegen changes and NO compiled-function output changes

### Stop threading response through the full pipeline
- Today: evaluate → ContextPreparer.prepare(runtimePlan, request, response)
  → RuntimeEvaluationContext(request, response) → phases → only hooks use it
- New: pass bindings on PipelineState directly, consumed only by the two hook phases
- ContextPreparer drops the `response` parameter
- RuntimeEvaluationContext drops the `response` field
- RuntimeEvaluationContext becomes purely engine-internal state (answers, data,
  reachability, validation) with no IO surface mixed in

### Error path / atomicity
- `halt-error` THROWS at `RequestOrchestrator.ts:30` — it does not return a result
- The throw unwinds past effect attachment (ForgeEvaluator.ts:116-127)
- With live bindings: if a hook writes a cookie then errors, the write already
  happened on the real response. This is acceptable — it was also true in the
  pre-refactoring architecture (old `ExpressFrameworkAdapter` wrote live to res)
- In practice, an error sends a 500 and the browser discards partial headers/cookies
- The `kind: 'error'` outcome only comes from pre-orchestrator checks
  (node-not-found, method-not-supported) — before any hooks run

### Read-after-set
- Express `res.cookie()` has NO getter — read-back requires a local cache
- The adapter's `ResponseBindings` implementation must handle this internally
  (Express adapter keeps a cookieCache Map alongside the live res.cookie calls)
- The engine does NOT need to layer anything on top — it trusts the bindings
  implementation to be coherent (set then get returns what was set)

## What the Express adapter provides

```ts
function createExpressResponseBindings(res: express.Response): ResponseBindings {
  const cookieCache = new Map<string, CookieMutation>()

  return {
    setHeader: (name, value) => { res.setHeader(name, value) },
    getHeader: (name) => res.getHeader(name) as string | undefined,
    setCookie: (name, value, opts) => {
      res.cookie(name, value, opts ?? {})
      cookieCache.set(name, { value, options: opts })
    },
    getCookie: (name) => cookieCache.get(name),
  }
}
```

## What the test client provides

```ts
function createTestResponseBindings(): TestResponseBindings {
  const headers = new Map<string, string>()
  const cookies = new Map<string, CookieMutation>()

  return {
    setHeader: (n, v) => { headers.set(n, v) },
    getHeader: (n) => headers.get(n),
    setCookie: (n, v, o) => { cookies.set(n, { value: v, options: o }) },
    getCookie: (n) => cookies.get(n),
    // extra for test assertions:
    getAllHeaders: () => headers,
    getAllCookies: () => cookies,
  }
}
```

## What gets deleted

- `engine/runtime/snapshot/RecordingStepResponse.ts`
- `ForgeEffects` interface (outcome.type.ts)
- `ForgeEvaluator.emptyEffects()` helper
- `StepResponse` interface (framework/types/response.type.ts)
- `flushEffects()` in `createExpressRouter.ts`
- `response` field from `RuntimeEvaluationContext`
- `response` parameter from `ContextPreparer.prepare()`
- `response` field from `EffectEvaluationContext`
- `effects` field from all `ForgeOutcome` variants

## What gets added

- `ResponseBindings` interface (framework/types/responseBindings.type.ts)
- `responseBindings` field on `PipelineState`
- `createExpressResponseBindings()` in the Express adapter
- `createTestResponseBindings()` in the test client
- `noopResponseBindings` default (for callers that don't care about response IO)

## What gets changed

- `Forge.evaluate()` / `ForgeEvaluator.evaluate()` — gains optional bindings arg
- `ForgeEvaluator.evaluate()` — stops constructing RecordingStepResponse, stops
  calling toEffects(), outcome drops effects/response field
- `PipelineState` type (orchestrator/types.ts) — gains `responseBindings?` field
- `buildCompiledHookLifecycleContext` (compiledEvaluationContext.ts:101-104) —
  reads from state.responseBindings instead of context.response
- `EffectFunctionContext` (the 4 response methods) — delegates to
  state.responseBindings instead of context.response
- `EffectFunctionContext` JSDoc (lines ~269, ~296) — fix stale claims about
  "written directly to the response via the framework adapter"
- `createExpressRouter.ts` — builds bindings per request, passes to evaluate,
  removes flushEffects call
- `ForgeTestClient` — creates test bindings, passes to evaluate, reads
  headers/cookies from bindings for TestResult
- `framework/index.ts` — stop exporting `ForgeEffects`, `StepResponse`;
  start exporting `ResponseBindings`

## Migration order

1. Add `ResponseBindings` interface
2. Add `noopResponseBindings` (silent drop)
3. Add `responseBindings?` to `PipelineState`
4. Wire the chokepoint: `buildCompiledHookLifecycleContext` reads bindings from
   state instead of context.response
5. Retarget `EffectFunctionContext`'s 4 response methods to use bindings
6. Update `ForgeEvaluator.evaluate()`: accept bindings arg, pass on PipelineState,
   remove RecordingStepResponse construction, remove toEffects(), simplify outcome
7. Drop `response` from ContextPreparer / RuntimeEvaluationContext /
   EffectEvaluationContext
8. Update `createExpressRouter.ts`: create bindings per request, pass to evaluate,
   remove flushEffects
9. Update `ForgeTestClient`: create test bindings, pass to evaluate, source
   TestResult.headers/cookies from bindings
10. Delete: RecordingStepResponse, ForgeEffects, StepResponse, emptyEffects()
11. Update framework/index.ts re-exports
12. Fix stale EffectFunctionContext JSDoc

## Constraints to preserve

1. Read-after-set within a request (adapter implementation responsibility)
2. Sync + async effects both work (hooks are forceAsync:true; both must work)
3. Effects fire on GET as well as POST (access hooks run on GET too)
4. No codegen changes (chokepoint swap is invisible to generated code)
5. Serialisability of RequestSnapshot (request reads stay pure data)
6. Engine-internal state stays engine-side (answers/data/reachability untouched)
7. Test ergonomics (test client provides its own recorder for assertions)
8. Author-facing API unchanged (setResponseCookie etc. still exist on context)
