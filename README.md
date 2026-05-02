# HMPPS Forge

HMPPS Forge is a declarative, stateless framework for building multi-page 
journeys, handling routing, rendering, validation, and navigation.

Define your journeys as plain data structures. Forge compiles them into routes, 
renders GOV.UK-styled pages, validates submissions, builds a route tree, and 
manages page flow - so you focus on what to ask, not how to wire it up.

> Note: 'Forge' is temporary name, if you can think of a better one, please 
> suggest it!

## What it does

- **Declarative journeys** - describe pages, fields, validation rules, and 
  navigation as data. No imperative request handlers.
- **GOV.UK and MOJ components** - built-in blocks for text inputs, radios, 
  checkboxes, date inputs, summary lists, task lists, and more. All render 
  through the GOV.UK Design System and MOJ Frontend.
- **Validation pipeline** - field-level and step-level rules with formatters, 
  conditional validation, cross-field checks, and error summaries wired to the 
  right fields automatically.
- **Hooks and lifecycle** - `onAccess` and `onSubmission` let you load data,
  handle POST intents, and control what happens on form submission.
- **Reachability** - prevents users skipping ahead, clears stale answers when 
  the path changes, and supports resuming partially-completed journeys.
- **Route tree** - automatically built from mounted URL folders and 
  available in templates for sidebars, breadcrumbs, and menus.
- **Expression language** - references (`Answer()`, `Data()`, `Params()`, 
  `Session()`), conditionals, iterators, combinators, and pluggable functions 
  (conditions, transformers, generators, effects) let you express dynamic 
  behaviour without leaving the declarative model.
- **Framework agnostic core** - the engine is decoupled from any web framework. 
  An Express + Nunjucks adapter is provided out of the box.

## What a journey looks like

```typescript
import { journey, step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput, GovUKButton, GovUKPanel } from '@ministryofjustice/hmpps-forge/govuk-components'

export const feedbackJourney = journey({
  code: 'feedback',
  title: 'Give feedback',
  path: '/feedback',
  view: { template: 'partials/form-step' },
  steps: [
    step({
      path: '/',
      title: 'What is your name?',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'fullName', label: { text: 'What is your name?', isPageHeading: true, classes: 'govuk-label-l' } }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({ validate: true, onValid: { next: [redirect({ goto: 'confirmation' })] } }),
      ],
    }),
    step({
      path: '/confirmation',
      title: 'Thank you',
      blocks: [GovUKPanel({ titleText: 'Feedback sent' })],
    }),
  ],
})
```

Forge compiles this into `GET /feedback` and `GET /feedback/confirmation` routes, 
renders the GOV.UK components, validates on submission, and redirects on success.

## Packages

| Package                  | Import path | Purpose |
|--------------------------|--|--|
| Core                     | `@ministryofjustice/hmpps-forge/core/authoring` | Authoring API, expression language, engine |
| Components               | `@ministryofjustice/hmpps-forge/core/components` | Built-in block primitives (`HtmlBlock`, `CollectionBlock`, `TemplateWrapper`) |
| Framework                | `@ministryofjustice/hmpps-forge/core/framework` | Framework adapter interface |
| Express-Nunjucks Adapter | `@ministryofjustice/hmpps-forge/express-nunjucks` | Express adapter with Nunjucks rendering |
| GOV.UK Components        | `@ministryofjustice/hmpps-forge/govuk-components` | GOV.UK Design System blocks and fields |
| MOJ Components           | `@ministryofjustice/hmpps-forge/moj-components` | MOJ Frontend blocks |

## Requirements

- Node.js 20, 22, or 24
- [GOV.UK Frontend](https://github.com/alphagov/govuk-frontend) 6.x
- [Express](https://expressjs.com/) 4.x or 5.x
- [Nunjucks](https://mozilla.github.io/nunjucks/) 3.x

## Getting started

Install the package and peer dependencies:

```bash
npm install @ministryofjustice/hmpps-forge express nunjucks express-session govuk-frontend
```

Set up the framework adapter and register your journeys:

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'

const forge = new Forge({
  frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
})

forge.registerGlobalComponents(govukComponents)
forge.registerPackage(myJourneyPackage)

app.use(forge.getRouter())
```

## Developer guide

We have an interactive [Forge Developer Guide](https://forge-developer-guide-dev.hmpps.service.justice.gov.uk) 
which covers the full API surface:

- **Building journeys** - defining journeys, steps, blocks, fields, validation, 
  routing, hooks, and navigation
- **Authoring language** - references, expressions, conditionals, iterators, and 
  combinators
- **Functions** - conditions, transformers, generators, and effects (built-in 
  and custom)
- **Custom components** - building your own blocks and fields with the component 
  system
- **Patterns** - single question per page, branching, reveal fields, composite 
  fields, and resuming partially-completed journeys etc.
- **Packages** - using the built-in GOVUK and MOJ components packages, how the 
  express-nunjucks adapter shapes existing Express/Nunjucks approaches to Forge etc.

The guide lives in [`examples-app/server/journeys/forge-developer-guide/`](examples-app/server/journeys/forge-developer-guide/)  and is itself built with Forge, so each pattern page includes a runnable demo.

## Development

The repository contains the framework packages and an examples app:

```
packages/              Framework source
  forge-core/          Engine, authoring API, expression language
  forge-express-nunjucks/  Express + Nunjucks adapter
  forge-govuk-components/  GOV.UK Design System components
  forge-moj-components/    MOJ Frontend components
examples-app/          Interactive examples and developer guide
```

Build the packages and install into the examples app:

```bash
make build
```

Run the examples app in development mode:

```bash
make dev-up
```

Run tests:

```bash
make test
```

Run linting:

```bash
make lint-fix
```

## Licence

[MIT](LICENCE)
