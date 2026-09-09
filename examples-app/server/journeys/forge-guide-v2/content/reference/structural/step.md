---
title: step()
slug: step
section: reference
path: reference/step
nav: Authoring API/Structural
order: 11
description: Defines a page and its blocks, hooks, validation, and reachability behaviour
teaches: [step, path, blocks, hooks, validation, backlink, reachability, cleardown]
prerequisites: [journey]
related:
  concept: how-journeys-and-steps-become-routes, how-blocks-resolution-and-rendering-connect, how-validation-works
  reference: journey, block, field, validation
---

# `step()`

`step()` defines one page within a journey.

```typescript
const contactDetailsStep = step({
  path: '/contact-details',
  title: 'Contact details',
  blocks: [emailAddressField, phoneNumberField, continueButton],
})
```

---

## Reference

### `step(definition)`

Call `step()` to create a step definition. The step becomes a route when it is listed in
a journey's `steps` array and that journey's package is registered with Forge.

[See more examples below.](#usage)

```typescript
function step<TBlocks = BlockDefinition[]>(
  definition: Omit<StepDefinition<TBlocks>, '_forge'>,
): StepDefinition<TBlocks>
```

#### Parameters

:::param
---
name: definition
type: Omit<StepDefinition<TBlocks>, '_forge'>
required: true
---
An object describing the page, its content, and its step-level behaviour. Its properties
are listed below.
:::

#### Definition properties

:::param
---
name: path
type: string
required: true
---
The step's route path, such as `'/contact-details'`. Forge appends it to the paths of its
journey ancestors. The path can contain route parameters, such as
`'/applications/:applicationId'`; use `'/'` when the step should occupy its parent
journey's composed route.

Forge combines this path with its ancestor paths before checking for conflicts. If the
resulting route conflicts with another journey or step, Forge reports
`Duplicate route path` and does not register the package.

[Learn how journeys and steps become routes.](../concepts/how-journeys-and-steps-become-routes)
:::

:::param
---
name: code
type: string
required: false
---
An optional identifier exposed in the current step's rendering context, reachability
projection, and request traces. Forge routing remains path-based when `code` is omitted.
:::

:::param
---
name: title
type: ResolvableString
required: true
---
The human-readable step title. Forge evaluates it for the current request and includes
it in the route tree and current step rendering context. Accepts a plain string or a
string expression such as `Format('Application %1', Params('applicationId'))`.
:::

:::param
---
name: description
type: ResolvableString
required: false
---
A description evaluated for the current request and included in the route tree and
current step rendering context.
:::

:::param
---
name: blocks
type: TBlocks (defaults to BlockDefinition[])
required: false
---
The [blocks](./block) and [fields](./field) that make up the page, in rendering order. When omitted, the step
has no blocks. A custom step renderer can accept a structured object of blocks,
including named regions, instead of an array.

[See defining a page from blocks below.](#define-a-page-from-blocks)
:::

:::param
---
name: onAccess
type: AccessHook[]
required: false
---
[Access hooks](./access) that run for this step after its journey ancestors' access hooks. They can
load data, perform effects, redirect, or return an authored error before answer
preparation, reachability, and rendering continue. When omitted, the step adds no access
hooks; hooks inherited from journey ancestors still run.

[See loading and saving around a form below.](#load-and-save-around-a-form)
:::

:::param
---
name: onSubmission
type: SubmitHook[]
required: false
---
[Submit hooks](./submit) evaluated on a `POST` after submitted answers have been prepared and stale
answers have been cleared. A hook can choose validation groups, run effects, and return a
redirect or authored error from its always, valid, or invalid branch. When omitted, the
step adds no submit hooks.

[See loading and saving around a form below.](#load-and-save-around-a-form)
:::

:::param
---
name: validateOnEntry
type: StepEntryValidation[]
required: false
---
Validation selections that can show existing failures when the step is opened with a
`GET`. Forge uses each active entry's `groups`; rules marked `submissionOnly` are not
included. When omitted, a normal `GET` does not show validation failures, although Forge
can still evaluate validity for reachability.

[See showing existing validation failures below.](#show-existing-validation-failures)
:::

:::param
---
name: groups
parent: validateOnEntry
type: string[]
required: true
---
One or more validation groups to show when this entry is active.
:::

:::param
---
name: when
parent: validateOnEntry
type: true | PredicateExpr | PredicateTestExprBuilder
required: true
---
Set to `true` to apply the entry on every `GET`, or provide a predicate to apply it only
for matching requests.
:::

:::param
---
name: renderer
type: RendererInvocation
required: false
---
An invocation produced by [`renderer()`](./renderer). Its factory receives
request dependencies, and its evaluator receives rendered children, resolved props,
and step context. Nested blocks render before the step renderer runs.
A step renderer replaces the inherited journey renderer as a whole. When omitted,
the nearest ancestor renderer applies. Without either, the adapter assembles the page.
:::

:::param
---
name: view
type: ViewConfig
required: false
---
Rendering configuration for the current step. Forge applies it after the view
configuration inherited from journey ancestors and passes the effective result to the
renderer. When omitted, the effective view comes from journey ancestors, if any.
:::

:::param
---
name: template
parent: view
type: string
required: false
---
A template identifier made available to the renderer. A template declared by the current
step replaces any template inherited from a journey ancestor. When omitted, the nearest
ancestor template remains in effect. If no ancestor declares one, the effective view has
no template and the renderer can choose a fallback.
:::

:::param
---
name: locals
parent: view
type: Record<string, unknown>
required: false
---
Values made available to the renderer for use as template locals. Forge merges them after
the locals inherited from journey ancestors, so step values replace inherited values with
the same key. When omitted, the step adds no locals of its own.
:::

<!-- TODO: Link to the Express-Nunjucks adapter documentation once it exists. -->
[See how the Express-Nunjucks adapter renders the effective view configuration.](#)

:::param
---
name: reachability
type: StepReachability
required: false
---
Controls how this step participates in the journey's reachability walk. When omitted,
the step is not declared as an entry point and has no tie-breaker rules; it can still
become reachable through the journey's forward paths.

[See declaring an entry point below.](#declare-an-entry-point)
:::

:::param
---
name: entryWhen
parent: reachability
type: true | PredicateExpr | PredicateTestExprBuilder
required: false
---
Declares the step as an entry point. Set it to `true` for an unconditional entry point,
or provide a predicate for an entry point that is active only while the predicate passes.
:::

:::param
---
name: tieBreakers
parent: reachability
type: TieBreaker[]
required: false
---
Prioritised [`tieBreaker()`](./tie-breaker) rules used when this step competes with other valid candidates for an entry,
backlink, or forward path. Forge reads the rules in order and uses the first matching
rule's priority. Higher priorities win; journey declaration order is the final
tie-breaker.
:::

:::param
---
name: backlink
type: string
required: false
---
An explicit backlink value made available in the current step rendering context. Setting
it suppresses Forge's automatic backlink derivation. When omitted, Forge uses the
previous step on the canonical reachable path when one exists. An empty string is still
an explicit value; the renderer decides how to present it.
:::

:::param
---
name: data
type: Record<string, unknown>
required: false
---
Static data available through [`Data()`](./data) while Forge evaluates this step. Forge merges data
from the root journey inwards, followed by the current step, so step values replace
ancestor values with the same key. Values must be JSON-compatible and cannot contain
Forge expressions such as `Data()`, `Answer()`, or `Query()`; load request-specific values
in an access-hook effect instead.
:::

:::param
---
name: metadata
type: RouteMetadata
required: false
---
Additional route information keyed by name, such as `navGroup: 'Applications'`. Values
can be static or value expressions. Forge evaluates them for the current request and
exposes them on the step's route-tree entry and current step rendering context.
:::

:::param
---
name: validWhen
type: ValidWhenInput[] | IterateExpr | ChainableIterable
required: false
---
Step-level [validation](./validation) for rules about the page as a whole or relationships between
several answers. Failures become domain validation errors rather than errors attached to
one field. When omitted, the step adds no domain validation; field-level validation on
its blocks still applies.

[See validating several answers together below.](#validate-several-answers-together)
:::

:::param
---
name: cleardownFieldCodes
type: string[]
required: false
---
Regular-expression patterns for additional answer keys that belong to this step. When
the step becomes unreachable, Forge automatically clears answers for its declared fields
and also clears existing answer keys matched by these patterns. Use this for dynamic
field codes that Forge cannot discover statically. Forge treats each value as a
JavaScript regular-expression pattern and matches it against existing answer keys;
matches are unanchored unless the pattern uses `^` and `$`.

[See clearing dynamic answer keys below.](#clear-dynamic-answer-keys)
:::

#### Returns

`step()` returns a step definition ready to add to a journey's `steps` array.

#### Caveats

- A step's `code` does not affect routing. Forge uses the composed `path` to match
  requests. `code` is only an identifier for rendering context, reachability projection,
  and traces.

- Step structure cannot be generated or changed at request time. Iterators, generator
  functions, and expressions can produce values inside a registered route, but cannot
  produce routes themselves. Forge registers stable paths and computes reachability from
  that structure. Use path parameters, access hooks, redirects, and reachability rules to
  vary the request.

- Avoid using `path: '/'` for a step in a flow. It makes the step occupy its parent
  journey's base route, which redirect and reachability calculations cannot reliably
  target. Give each flow step its own unique path.

---

## Usage

### Define a page from blocks

Put blocks in the order the renderer should receive them:

```typescript
const contactDetailsStep = step({
  path: '/contact-details',
  title: 'Contact details',
  blocks: [
    GovUKTextInput({
      code: 'emailAddress',
      label: 'Email address',
    }),
    GovUKTextInput({
      code: 'phoneNumber',
      label: 'Phone number',
    }),
    GovUKButton({ text: 'Continue' }),
  ],
})
```

Forge preserves the authored block order while resolving the page. Field blocks create
answers under their field codes; presentational blocks add content without creating an
answer.

For the block and field mental model, see
[How blocks, resolution, and rendering connect](../concepts/how-blocks-resolution-and-rendering-connect)
and [How answers work](../concepts/how-answers-work).

### Load and save around a form

Use an access hook to load request data before the page is evaluated, then a submit hook
to validate, save, and choose the next route:

```typescript [[1, 4, "onAccess: ["], [1, 6, "effects: [ContactEffects.LoadDetails()]"], [2, 10, "onSubmission: ["], [2, 14, "effects: [ContactEffects.SaveDetails()]"], [2, 15, "next: [redirect({ goto: 'check-answers' })]"]]
const contactDetailsStep = step({
  path: '/contact-details',
  title: 'Contact details',
  onAccess: [
    access({
      effects: [ContactEffects.LoadDetails()],
    }),
  ],
  blocks: [emailAddressField, phoneNumberField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [ContactEffects.SaveDetails()],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
```

The <s1>access hook loads details before the page continues</s1>. On submission, the
<s2>valid branch saves the prepared answers and redirects to the next route</s2>. If
validation fails, Forge renders the step with its failures instead of running `onValid`.

For the full lifecycle, see [How Forge runs a request](../concepts/how-forge-runs-a-request)
and the [`submit()` reference](../reference/submit).

### Declare an entry point

Use `entryWhen: true` for a step that always starts a journey, or a predicate for an entry
that is available only in matching request state:

```typescript
const standardStartStep = step({
  path: '/start',
  title: 'Start your application',
  reachability: { entryWhen: true },
  blocks: [startButton],
})

const premiumStartStep = step({
  path: '/premium',
  title: 'Premium application',
  reachability: {
    entryWhen: Data('isPremium'),
    tieBreakers: [tieBreaker({ priority: 100 })],
  },
  blocks: [premiumStartButton],
})
```

While `isPremium` is `true`, the second step is an active conditional entry. Its higher
tie-breaker priority makes it win when both entries are valid candidates.

For the wider model, see
[How Forge decides where users can go](../concepts/how-forge-decides-where-users-can-go).

### Validate several answers together

Put a validation on the step when no single field owns the rule:

```typescript
const travelDatesStep = step({
  path: '/travel-dates',
  title: 'Travel dates',
  blocks: [departureDateField, returnDateField, continueButton],
  validWhen: [
    validation({
      condition: Answer('returnDate').match(
        Condition.Date.IsAfter(Answer('departureDate')),
      ),
      message: 'The return date must be after the departure date',
    }),
  ],
})
```

The failure belongs to the step and appears as a domain validation error. Keep rules
about one answer on that answer's field instead.

### Show existing validation failures

Add `validateOnEntry` when opening the page should show selected existing failures:

```typescript
const contactDetailsStep = step({
  path: '/contact-details',
  title: 'Contact details',
  blocks: [emailAddressField, phoneNumberField, continueButton],
  validateOnEntry: [
    {
      groups: ['default'],
      when: Query('review').match(Condition.Equals('true')),
    },
  ],
})
```

Here, a `GET` with `?review=true` shows failures from the `default` group. Other `GET`
requests still render without showing those failures.

For validation timing, see
[How validation works](../concepts/how-validation-works).

### Clear dynamic answer keys

Forge discovers ordinary field codes from the step's blocks. Add patterns only for
answer keys created dynamically:

```typescript
const travellerDetailsStep = step({
  path: '/traveller-details',
  title: 'Traveller details',
  blocks: travellerFields,
  cleardownFieldCodes: ['^traveller_\\d+_passportNumber$'],
})
```

If this step becomes unreachable, the pattern clears existing keys such as
`traveller_0_passportNumber` and `traveller_1_passportNumber`. It does not create keys or
affect answers while the step remains reachable.

For why Forge clears branch answers, see
[Clearing answers that no longer apply](../concepts/clearing-answers-that-no-longer-apply).

---

## Troubleshooting

### Forge reports `Duplicate route path`

The step's path has composed with its journey ancestors to the same route as another
step or journey. Check the full branch rather than only comparing local `path` values.

Give each route a distinct composed path. A step with the path `/` is allowed to occupy
its parent journey's composed route when that overlap is deliberate.

### A request redirects away from the step

The step is not reachable in the current request state. Its conditional `entryWhen` may
be false, or no reachable submit outcome may lead to it. Forge redirects unreachable
requests according to the parent journey's reachability configuration.

Make sure ancestor access hooks load the answers and data used by reachability, then
check the step's entry predicate and the redirect outcomes that lead to it.

### Validation failures do not appear on a `GET`

A normal `GET` evaluates validity for journey progress without automatically showing
failures. Add a `validateOnEntry` entry for the groups that should be visible and make
sure its `when` predicate passes.

Rules marked `submissionOnly` remain hidden on entry validation and run only when a
submit hook requests validation.

### Dynamic answers remain after a branch closes

Forge automatically clears declared field codes on unreachable steps, but it may not be
able to discover answer keys produced dynamically. Add an anchored
`cleardownFieldCodes` pattern to the step that owns those keys.

Make sure the relevant answers are loaded before reachability and cleardown run; Forge
can only clear existing answer keys available in the current request.
