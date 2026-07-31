# HMPPS Forge

[![Ministry of Justice Repository Compliance Badge](https://github-community.service.justice.gov.uk/repository-standards/api/hmpps-forge/badge)](https://github-community.service.justice.gov.uk/repository-standards/hmpps-forge)
[![npm](https://img.shields.io/npm/v/@ministryofjustice/hmpps-forge?style=for-the-badge)](https://www.npmjs.com/package/@ministryofjustice/hmpps-forge)
[![build](https://img.shields.io/github/actions/workflow/status/ministryofjustice/hmpps-forge/pipeline.yml?style=for-the-badge&branch=main)](https://github.com/ministryofjustice/hmpps-forge/actions/workflows/pipeline.yml)
[![licence](https://img.shields.io/npm/l/@ministryofjustice/hmpps-forge?style=for-the-badge)](LICENSE.md)

Forge is a declarative framework for building server-rendered web
applications.

- **Declarative** - pages, content, validation, and navigation are plain data
  structures. Forge derives the routing, rendering, and page flow from them -
  there are no request handlers to write.
- **Compiled** - definitions compile to plain JavaScript functions once at
  startup. Requests execute compiled functions; nothing is parsed or
  interpreted per request.
- **Stateless** - every request is evaluated fresh from a snapshot. Same
  definitions, same snapshot, same outcome - deterministic, and testable
  without ever touching HTTP.
- **Bring your own stack** - the engine returns outcomes (render, navigate,
  error); adapters own the framework. An Express + Nunjucks adapter and
  GOV.UK/MOJ component packages ship out of the box, and any design system or
  framework can sit in their place.

The interactive [Forge Developer Guide](https://forge-developer-guide-dev.hmpps.service.justice.gov.uk)
covers the full API surface - building journeys, the authoring language,
components, and patterns. It's itself built with Forge, so every pattern page
includes a runnable demo.

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

## Features

- **Validation pipeline** - field and step rules with formatters, conditional
  validation, cross-field checks, and error summaries wired to the right fields
- **Reachability** - prevents users skipping ahead, clears stale answers when
  the path changes, and supports resuming partially-completed journeys
- **Route tree** - built from mounted route paths, available in templates for
  sidebars, breadcrumbs, and menus
- **Expression language** - references (`Answer()`, `Data()`, `Params()`,
  `Session()`), conditionals, iterators, combinators, and pluggable functions
- **Hooks** - `onAccess` and `onSubmission` for loading data, handling POST
  intents, and controlling what happens on form submission
- **GOV.UK and MOJ components** - text inputs, radios, checkboxes, date inputs,
  summary lists, task lists, and more

## Getting started

Forge runs on Node.js 20, 22, or 24. Install the package and peer dependencies:

```bash
npm install @ministryofjustice/hmpps-forge express nunjucks express-session govuk-frontend
```

The bundled adapter and components work with [Express](https://expressjs.com/)
4.x or 5.x, [Nunjucks](https://mozilla.github.io/nunjucks/) 3.x, and
[GOV.UK Frontend](https://github.com/alphagov/govuk-frontend) 6.x.

Create the engine, register your journeys, and mount the Express router:

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'

const forge = new Forge({ logger })
  .registerGlobalComponents(govukComponents)
  .registerPackage(myJourneyPackage)

app.use(createExpressRouter(forge, { nunjucksEnv }))
```

## Packages

| Package                  | Import path | Purpose                                                                       |
|--------------------------|--|-------------------------------------------------------------------------------|
| Authoring                | `@ministryofjustice/hmpps-forge/core/authoring` | Authoring API, expression language, engine                                    |
| Components               | `@ministryofjustice/hmpps-forge/core/components` | Built-in block primitives (`HtmlBlock`, `CollectionBlock`, `TemplateWrapper`) |
| Framework                | `@ministryofjustice/hmpps-forge/core/framework` | Framework adapter interface                                                   |
| Express-Nunjucks Adapter | `@ministryofjustice/hmpps-forge/express-nunjucks` | Express adapter with Nunjucks rendering                                       |
| GOV.UK Components        | `@ministryofjustice/hmpps-forge/govuk-components` | GOV.UK Design System blocks and fields                                        |
| MOJ Components           | `@ministryofjustice/hmpps-forge/moj-components` | MOJ Frontend blocks and fields                                                |
| JSX Components           | `@ministryofjustice/hmpps-forge/jsx-components` | JSX-to-HTML component authoring, no framework underneath (experimental)       |

## Development

The repository contains the framework packages and an examples app:

```bash
packages/                   # Framework source
  forge-core/               # Engine, authoring API, expression language
  forge-express-nunjucks/   # Express + Nunjucks adapter
  forge-govuk-components/   # GOV.UK Design System components
  forge-moj-components/     # MOJ Frontend components
  forge-jsx-components/     # JSX-to-HTML component authoring (experimental)
examples-app/               # Interactive examples and developer guide
```

The engine internals are documented layer by layer - start at the
[engine README](packages/forge-core/src/engine/README.md), which covers the
compilation pipeline and runtime, and links down into each layer.

```bash
make build      # build the packages and install them into the examples app
make dev-up     # run the examples app in development mode
make test       # run tests
make lint-fix   # run linting
```

## Contributing & Licence

Issues and pull requests are welcome. Branch off `development` (PRs target it,
not `main`), and run linting, typechecking and test suites before opening!

Licence is [MIT](LICENSE.md).
