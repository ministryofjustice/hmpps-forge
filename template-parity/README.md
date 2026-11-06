# template-parity

A spike that tests whether the Rust port can keep the upstream GOV.UK Frontend and MOJ Frontend
Nunjucks macros, rendering them with [Runjucks](https://github.com/Nikolay-Pomytkin/runjucks)
instead of rewriting them as Rust components.

Each case is rendered through real Nunjucks (the reference) and through Runjucks, and the
two outputs are compared byte for byte.

## Result

**690 / 690 cases are byte-identical** (650 govuk-frontend 6.2.0 fixtures, 40 MOJ Frontend
9.0.0 cases), with the patched Runjucks in `../vendor/runjucks_core`.

Unpatched `runjucks_core` 0.1.9 got 1 / 690 exact. That score comes from eleven Nunjucks
compatibility gaps, each fixed in the vendored copy (see
`../vendor/runjucks-nunjucks-parity.patch`). These patches are meant to go upstream:

| Gap | Effect on govuk/MOJ |
|---|---|
| `{#-` / `-#}` comment whitespace control ignored | stray whitespace in every component using `govukAttributes` |
| `SafeString.val` not supported | `\| safe` attribute values lost |
| JS methods on values (`.concat`, `.includes`, `.slice`, …) | render errors in input, date-input, password-input, MOJ alert, banner, pagination |
| String filters (`trim`, `indent`, `upper`, …) drop `safe` | nested macro HTML double-escaped |
| Bare dict keys (`{ value: x }`) evaluated as variables | object literals lose their keys |
| `for k, v in undefined` iterates the internal sentinel | `__runjucks_undefined="true"` attributes |
| `for k, v in obj` sorts keys (JS uses insertion order) | attribute order differs |
| `undefined \| length` is 1; `safe \| length` is 1 | wrong branches (empty lists rendered) |
| `+` stringifies `undefined`/`null` as `""` (JS: `"undefined"`/`"null"`) | MOJ cookie-banner class differs |
| `a if b` with no `else` yields `null` (Nunjucks: `""`) | `"…null"` in class names |
| `.length` property on arrays/strings | wrong branches in summary-list, service-navigation, MOJ multi-file-upload |
| Block `{% set x -%}` trims its body (Nunjucks doesn't) | whitespace in pagination |

Runjucks' own test suite still passes with the patches applied (379 passed, 0 failed). Its
`conformance` and `tag_parity` suites can't run because the published crate doesn't ship
their fixture files.

## What the harness provides beyond Runjucks

- **`SearchPathLoader`**: multiple search roots, plus rewriting of `./` and `../` template paths.
  Runjucks resolves all names from the loader root. Nunjucks resolves these relative to the
  including template.
- **`mojDate` and `date` filters**: Rust ports of `@ministryofjustice/frontend/moj/filters/all.js`.
  These are UTC only for now; production needs Europe/London. `date` covers the common moment
  tokens only.
- `serde_json` with `preserve_order`. Without it, JS object key order is lost.

## Known gaps not covered by this corpus

- Mutating JS methods (`list.push(x)`) aren't supported. They're used only in examples-app's
  own views (`guide-step.njk`, `breadcrumb.njk`), which we control and can rewrite.
- The async renderer (`async` feature) has its own evaluator that hasn't been patched. The sync
  renderer is all we need.
- MOJ cases are hand-written (MOJ ships no fixtures), so coverage is broad but not exhaustive.

## Running

```sh
# from the repo root; needs examples-app/node_modules installed
TZ=UTC node rust/template-parity/corpus/generate.mjs > rust/template-parity/corpus/corpus.json
cd rust/template-parity
cargo run --release              # writes report/summary.md and report/failures.md
DUMP='govuk/tag/default' cargo run --release   # also writes both outputs for one case
cargo test                       # feature probes
```
