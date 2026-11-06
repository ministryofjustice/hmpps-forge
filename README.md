# Porting HMPPS Forge to Rust

The whole [HMPPS Forge](https://github.com/ministryofjustice/hmpps-forge) framework (all `packages/*` plus `examples-app`) is being rewritten in Rust, on
[Topcoat](https://github.com/tokio-rs/topcoat) for HTTP and [Runjucks](https://github.com/Nikolay-Pomytkin/runjucks)
for templates, so the upstream GOV.UK Frontend and MOJ Frontend Nunjucks macros are used as they are.

## Standalone workspace

It builds, runs, tests and packages on its own; nothing in it reads the TS repository. The examples app owns
its runtime files in `examples-app/` (`views/`, `content/` with the guide Markdown and the pattern sources its code
panels show, `assets/`, and `package.json` / `package-lock.json` for GOV.UK Frontend, MOJ Frontend and highlight.js),
and `forge-moj-components/` holds Forge's MOJ component `templates/` and `styles/`.

```sh
make install                         # npm ci in examples-app (frontend packages, needed by the app and the tests)
cargo run -p forge-examples-app      # http://localhost:3000/forge-developer-guide (HOST/PORT as Topcoat reads them)
TZ=UTC cargo test --workspace
make up                              # Docker: build the image and start the app with Redis
```

The binary locates its files through `FORGE_APP_ROOT` (default: the `examples-app` crate directory) and
`FORGE_MOJ_COMPONENTS` (default: the `forge-moj-components` crate directory).

The guide's content is owned here and documents the Rust API; nothing is synced from the TS repository. Its
code blocks are Rust, and the pattern demos' code panels show `.rs` display sources under
`content/sections/patterns` (and `content/components/lottery_ball.rs`), written against the public API with plain
`step(...)`. The effects panels show `content/sections/patterns/effects.rs`, a copy of `src/effects.rs` (a test
keeps them equal), selecting effects by name (`{ "path": "/effects.rs", "effects": [...] }`). The
express-nunjucks pages became the Topcoat Adapter pages, now at `packages/topcoat/*` (and the setup page at `get-started/using-forge-with-topcoat-and-runjucks`).

## Tests

Two kinds of test, by what they compare against.

**Reference implementations** — compared against the real thing, regenerated from this workspace
(`make install` first; run from `rust/`):

| Test | Compares | Status |
|---|---|---|
| `template-parity/` | govuk-frontend / MOJ Frontend macros rendered by Runjucks vs real Nunjucks (every upstream fixture plus MOJ cases) | 756/756 with govuk-frontend 6.5.1 / MOJ Frontend 11.1.0 |
| `examples-app/tests/highlight.rs` | The highlight.js port vs highlight.js on this workspace's sources, in every registered grammar, `ignoreIllegals` on and off (`highlight.ndjson`) | 482/482 identical |
| `examples-app/tests/stylesheet.rs` | The app stylesheet from grass vs dart-sass (`stylesheet.css`), rule by rule after normalising equivalent spellings | 2233/2233 rules |

```sh
(cd template-parity && TZ=UTC node corpus/generate.mjs > corpus/corpus.json)      # template-parity corpus
(cd template-parity && cargo run --release -p template-parity)                     # report in template-parity/report
node highlight-port/export.cjs > examples-app/src/highlight/grammars.json         # highlight.js grammars
node highlight-port/samples.cjs > fixtures/highlight.ndjson                       # highlight.ndjson
(cd examples-app && npx --yes sass@1.104.1 --style=compressed --no-source-map --load-path=. \
  --load-path=node_modules --load-path=../forge-moj-components/styles --quiet-deps --silence-deprecation=import \
  assets/scss/index.scss ../fixtures/stylesheet.css)                              # stylesheet.css (dart-sass)
```

**Recorded fixtures** (`fixtures/`) — inputs with expected outputs that are snapshots of this implementation's
behaviour. They were first recorded from the TypeScript Forge the port started from (so they began as parity
checks); they are owned here now. When a behaviour change is intended, rewrite the expectations and review the diff:

```sh
UPDATE_FIXTURES=1 TZ=UTC cargo test --workspace      # then once more for TZ=Europe/London (builtins)
UPDATE_FIXTURES=1 TZ=Europe/London cargo test -p forge-core --test builtins
TZ=UTC cargo test --workspace                        # reports land in target/fixture-reports/
```

Authored expectations are never rewritten: the contract verdicts in `contracts.json`, and the journeys the
`authoring` test rebuilds with the builders.

| Test | Fixture | Status |
|---|---|---|
| `forge-core/tests/contracts.rs` | `contracts.json`: journeys and requests with authored verdicts and the full outcome (render context, redirect, error, headers, session) | 299/299 verdicts, 299/299 outcomes |
| `forge-core/tests/narrative.rs` | `narrative.ndjson`: package registrations (result or error, so DSL validation and semantic analysis; compilation trace) and test-client requests | 521/521 registrations, 521/521 compilation traces, 486/486 requests (4 unrepresentable) |
| `forge-core/tests/traces.rs` | `traces.ndjson`: the request trace each contract row hands instrumentation sinks, timings compared by presence | 299/299 |
| `forge-devtools/tests/messages.rs` | `traces.ndjson`: the devtools wire message for each recorded trace (the Chrome panel's format) | 299/299 |
| `forge-core/tests/builtins.rs` | `builtins.<TZ>.ndjson`: built-in function calls and results, per timezone | 954/954 (UTC and Europe/London) |
| `forge-core/tests/ast_ids.rs` | `contracts.json`: AST node IDs vs the IDs in the recorded render outputs | 675/675 |
| `forge-core/tests/authoring.rs` | `contracts.json`: the builders rebuild the recorded journeys exactly | byte-identical |
| `forge-govuk-components/tests/recorded.rs`, `forge-moj-components/tests/recorded.rs` | `components.ndjson`: block → template, params and HTML | 459/459, 300/300 |
| `forge-govuk-components/tests/jsx.rs` | `jsx.ndjson`: JSX component props → HTML | 33/33 |
| `examples-app/tests/markdown.rs` | `markdown.ndjson`: Markdown → `govukMarkdown` HTML (the fixture holds its own Markdown) | 147/147 |

**Behaviour tests** — `examples-app/tests/app.rs` (pages render, assets, CSRF, a pattern form flow, the llms routes),
`examples-app/tests/crawl.rs` (every route in the topology without a server error),
`examples-app/tests/guide_examples.rs` (the guide's complete examples, compiled and run: keep them in sync with the
pages they name), `examples-app/tests/pattern_sources.rs` (every code-panel source compiles; modules a panel imports
but no panel shows are stubbed),
`forge-devtools/tests/{server,channel}.rs` (auth codes, sessions, cookie-scoped dispatch, the Redis channel; the live
Redis check runs when `FORGE_DEVTOOLS_REDIS_URL` is set), and the crates' unit tests.

## Docker

`Dockerfile` builds a static (musl) release binary and a `FROM scratch` image holding only the binary, a CA bundle
and the files the app reads under `/app` (views, content, assets, the npm packages `examples-app/package-lock.json`
pins, the MOJ component templates and styles). `docker-compose.yml` runs it with Redis (devtools traces); the
`Makefile` drives both: `make up` (build, start, wait for healthy), `start`, `down`, `logs`, `ps`, `health`, `clean`,
and `install` (the local npm install). `APP_PORT` picks the host port (default 3000). The build context is this
directory (`.dockerignore` keeps `target/`, corpora and tooling out).

## Layout

- `forge-core/src/value.rs` — JS-semantics value (`undefined` vs `null`, `===` identity, truthiness, UTF-16
  length, `?.` on strings/arrays). The TS engine's behaviour is JS behaviour, so everything runs on this.
- `forge-core/src/engine/ast.rs` — `NodeFactory` port; reproduces TS node/template IDs exactly.
- `forge-core/src/engine/expr.rs` — lowering of expressions (`ExpressionDispatcher` and node compilers) into a
  pre-resolved tree plus an async evaluator. Where TS emits JavaScript, Rust builds this tree once at compile time.
- `forge-core/src/engine/value_expr.rs` — authored values (`AuthoredValueClassifier` + `RuntimeValueCompiler`).
- `forge-core/src/engine/analysis.rs` — ownership, field models, field occurrence loops.
- `forge-core/src/engine/concerns/*` — one module per TS concern (hooks, answer preparation, validation,
  reachability, answer cleardown, route, resolve).
- `forge-core/src/engine/runtime/{context,pipeline}.rs` — `RuntimeContext` behind a shared lock (effects and
  expressions interleave, as in TS), and the fixed phase order.
- `forge-core/src/engine/{mount,forge}.rs` — package compilation, mounting, topology, `execute`.
- `forge-core/src/engine/tracing.rs` — request tracing (`chassis/tracing` + `RequestPipelineTraceProjector`):
  `Span` handles over a per-request arena, opened where TS schedules a work task, with the same keys, kinds and
  begin/complete fields; `InstrumentationSink` / `Instrumentation` (`ForgeTraceSinkDispatcher`, with per-request
  `should_trace`); the projection into the JS-shaped `RequestTraceEvent`. Untraced requests use disabled spans
  and never build field values. Sinks go on `ForgeOptions::instrumentation` or `Forge::add_instrumentation_sink`.
  Package compilation emits a `CompilationTraceEvent` to `InstrumentationSink::on_compilation_trace` (phases in
  `CompilationPipelineBootstrap` order, recorded by `mount::compile_and_mount_traced`).
- `forge-devtools` — the devtools bridge (`forge-devtools/src/server`): an instrumentation sink that traces only
  requests carrying the `__forgeDevtools` cookie, one-time auth codes, per-panel cookies, and a Topcoat websocket
  route at `<path>/ws`. It speaks the existing Chrome extension's protocol, so the extension is used as it is.
  With `redis_url` (or a custom `TraceChannel`) every instance publishes its traces, gzipped JSON on
  `__forgeDevtools:traces` exactly as TS does (so Rust and TS replicas can share the channel), and dispatches
  only what it hears back. The examples app mounts it (`noAuth` outside production, as in TS) and reads the TS
  app's `REDIS_ENABLED` / `REDIS_HOST` / `REDIS_PORT` / `REDIS_AUTH_TOKEN` / `REDIS_TLS_ENABLED`.
- `forge-core/src/builtins/*` — every built-in condition, transformer and generator; `jsdate.rs` models JS `Date`
  (local-time construction/overflow, ISO parsing, the `Intl` slice the built-ins use).
- `forge-core/src/authoring/*` — the DSL: `obj!{}` literals, `Ex` chainables (`.path/.pipe/.each/.matches/.not`),
  structures, hooks, combinators, and generated `condition::` / `transformer::` / `generator::` namespaces.
- `forge-runjucks` — Runjucks environment (search-path loader, `mojDate`/`date`, `getErrorSummaryList`) and
  `RunjucksRenderer` (the `NunjucksRenderer` port).
- `forge-govuk-components`, `forge-moj-components` — component schemas and param mappings, checked against
  `components.ndjson` (params and rendered HTML).
- `forge-topcoat` — the HTTP adapter (`forge-express-nunjucks` port). `mount()` turns each topology node into
  a Topcoat `Route` (`:param` becomes `{param}`). Each request is turned into a `RequestSnapshot` (qs-style query
  and urlencoded bodies, cookies, lowercased headers). Sessions go through a `SessionStore` (in-memory by default,
  `forge.sid` cookie). The `Outcome` becomes a 302 redirect, an error status or an HTML response. Non-form POSTs
  get 415. Optional synchronizer-token CSRF (`csrf-sync` semantics, `_csrf` field), per-request CSP nonces
  (`cspNonce`, `{nonce}` in configured headers) and templated error pages. Request state is
  `AdapterOptions::state` merged with per-request state from `AdapterOptions::with_request_state` (the Express
  `res.locals` / `req.state` middleware role; opaque values carry request-scoped objects such as API clients). Topcoat is pinned to `=0.11.0`; only
  this crate and the app's binary depend on it.
- `examples-app` (`forge-examples-app`) — the Forge Developer Guide: data stores (Markdown content, form answers,
  mock APIs), keyword search (BM25+ with MiniSearch's boosts), the guide's components (`govukMarkdown` on
  pulldown-cmark with a markdown-it-shaped writer and linkify-it fuzzy links, table of contents, lottery ball, rich
  text editor), the highlight.js port (`src/highlight`), all 38 effects and transformers, and the app shell (Runjucks page environment with the TS views,
  health routes, error pages, static assets). `/assets/js/index.js` is served without a bundler: its package
  imports are rewritten to the ES module builds GOV.UK Frontend and MOJ Frontend ship.
- `examples-app/src/guide` — the guide's journey, in Rust: `modules/` holds its sections, steps and pattern
  demos (originally translated one to one from the 405 TS journey modules); `dsl.rs` is the definition-time vocabulary (`D` keeps the builder kind, so `.path()` extends a
  reference but wraps an expression, as the TS builders do); `support.rs` holds the hand-ported helpers
  (`patternStep` with its source reader and highlighter, `loadContent`, the guide's component
  builders). Each generated module has a `__init()` that evaluates it in TS module order (imports first, in
  import order, then its consts), because `patternStep`'s first-wins demo-source registry, which llms.txt reads,
  depends on that order. `forge-govuk-components` gained `GovUKValidations` (`validations::date_input_full`) and
  `GovUKUtilityClasses` (`utility_classes()`), and forge-core the core component builders (`HTML`, ...).
- `examples-app/src/highlight` — a port of the highlight.js 11 engine (`engine.rs`: `compileLanguage`'s
  `ResumableMultiRegex` matcher, `_highlight`, the token-tree emitter and HTML renderer, the five grammar callbacks)
  running the grammars highlight.js itself compiled (`grammars.json`, exported by `highlight-port/export.cjs` from
  the installed highlight.js, so grammars are data and follow upgrades). `jsregex.rs` runs JS regex sources on
  fancy-regex with JS semantics (ASCII `\w`/`\d`/`\b`, JS `\s`, literal `{`, JS character classes) and ports
  `countMatchGroups` / `_rewriteBackreferences`.
- `vendor/runjucks_core` additionally: top-level code in templates that `{% extends %}` (sets, imports, loops run
  before the parent renders), multi-level `extends` rendering the root layout, `list.push(x)` mutating the
  template binding, imported macros closing over their template's imports (govuk/header's `govukLogo` calls
  `govukAttributes`), blocks nested in other blocks taking part in inheritance (Nunjucks registers every block in a
  template, so a layout can override and `super()` into GOV.UK's `govukFooter` inside `footer`),
  `Array.prototype.join`, `not` binding looser than `in` / `is` / comparisons, and `sameas`
  as reference identity: object values carry an origin (context path, list-literal element, or a fresh id for
  anything built while rendering) through `set`, `for` and macro arguments, so objects with equal contents
  stay distinct, as govuk-frontend's date input needs (all vendored changes: `vendor/runjucks_core.patch`;
  regression tests in `forge-runjucks/tests/runjucks_fixes.rs`).
- `vendor/grass_compiler` (`vendor/grass_compiler.patch`): import-only files only for `@import`;
  Sass extension appending (`breakpoints.mixin` -> `breakpoints.mixin.scss`); modules identified by canonical path
  (MOJ Frontend reaches its GOV.UK `@forward ... with` index through several relative paths, and re-executing it
  left the configuration unconsumed); dart-sass 1.92+ declaration ordering (`_copyParentAfterSibling`: a
  declaration after a nested rule goes into a copy of the parent rule placed after it, instead of being hoisted);
  comments other than `/*!` invisible in compressed output (rules holding only comments are dropped).

## Rust API additions

Beyond the one-to-one port, for the Rust guide:

- `forge_core` re-exports `FunctionEntry`, `ComponentEntry`, `EffectContext`, `ForgeError` and `ForgeResult`.
- `forge_core::authoring::Functions` collects function entries, named or anonymous (`__anon_N`), returning
  `FunctionHandle`s whose `call()` builds the expression (the TS `ConditionRegistry` / `TransformerRegistry` / ...
  and anonymous `register(factory)`). Pass it to `ForgePackage::with_functions(&functions)`.
- `forge_core::testing::TestEffectContext` runs an effect's closure outside a request (seeded answers, data,
  session and request values) for unit tests; `FunctionEntry::call` / `run_effect` evaluate entries directly.
- `forge_runjucks::generators::string` builds `NunjucksGenerators.String` and rejects forbidden tags when the
  definition is built (the runtime check remains).
- `Value: From<[T; N]>`, `From<Match>`, `From<When>`.

## Deliberate differences

- Sessions: TS effects mutate the session object in place; Rust effects use `EffectContext::update_session` and the
  final session is returned on `Outcome::session`.
- Work executor / trace spans: the TS `WorkTask` tree exists to order, trace and fold phase work. Rust runs phases
  directly and opens the same spans explicitly. Span self time is duration minus children (TS measures the
  synchronous handler slices), and execution slices are the stretches before the first and after the last child.
  `resolve.block` spans are built from the resolved blocks, since TS evaluates block properties while building
  the tasks and its block spans only record structure.
- Compilation traces: Rust inserts routes before code generation, so the `routes` span is opened last but its work
  ran earlier, and the `codegen.journey` / `codegen.step` units are built from the compiled model. A route clash
  still yields a `compiled` trace with the error returned afterwards, as TS detects clashes when mounting.
- Traces mirror TS's by-reference fields: the snapshot's `session` and `answer.preparation`'s `answers` show the
  state at the end of the request.
- highlight.js: positions are UTF-8 byte / character based where highlight.js counts UTF-16 units, and `i`
  regexes use Unicode simple case folding (JS non-`u` folding excludes a few non-ASCII equivalents such as `ſ`).
- Devtools: no permessage-deflate on the websocket (Topcoat's websocket does not negotiate it). The Redis channel
  takes a URL rather than the app's client (the Rust app has no shared Redis client) and opens its own publish and
  subscribe connections, reconnecting with the app's backoff (20ms doubling, capped at 30s).
- Effects that throw in TS map to `ForgeError` (with `ForgeError::Http` carrying a status).
- Custom functions have no `deps` argument and no registries: a `FunctionEntry` closure captures the services it
  needs when the package is built, and typed helper functions around `condition::call` & co. play the part of
  registry handles and `prepare` hooks. There is no `createTestPackage`; tests build the package with stub
  services or swap an entry by name.
- examples-app: guide search is keyword-only (the TS hybrid adds a local embedding model) and stems with Snowball
  English rather than Porter; pattern form answers are kept in process (TS uses Redis, and without Redis TS keeps
  none; `FORM_DATA_STORE=none` makes Rust match). The stylesheet is compiled with grass at startup; it differs from dart-sass's only in
  value spellings (hex length, `rgb()` percentages, leading zeros, whitespace) that mean the same CSS.
