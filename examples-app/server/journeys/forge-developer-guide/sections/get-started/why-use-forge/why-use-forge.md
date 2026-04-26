---
title: Why use Forge
section: get-started
path: get-started/why-use-forge
teaches: [why-use-forge, declarative-journeys]
prerequisites: []
---

<p class="govuk-caption-xl">Get started</p>

# Why use Forge

Forge replaces the per-route procedural code that every GOV.UK
service writes by hand with a single declarative definition per
step. You describe what the page contains and what should happen.
Forge decides how and when.

{{slot:toc}}

---

## The problem

A typical GOV.UK service builds journeys by hand. Each step is an
Express route with its own GET and POST handler. Each handler loads
data, reads the session, validates input, decides where to redirect,
and renders a template.

A single step - one select input and two date fields - requires
a route file, a template, and the wiring between them:

```javascript
router.get('/add-trip', async (req, res) => {
  const countries = await caseApi.getReferenceData('countries')
  const saved = req.session.answers ?? {}

  res.render('pages/add-trip', {
    countries,
    tripCountry: saved.tripCountry,
    tripDepartureDate: saved.tripDepartureDate,
    tripReturnDate: saved.tripReturnDate,
    errors: {},
    errorSummary: [],
    backLink: '/travel-declaration/your-trips',
    csrfToken: req.csrfToken(),
  })
})

router.post('/add-trip', async (req, res) => {
  const { tripCountry, tripDepartureDate, tripReturnDate } = req.body
  const errors: Record<string, { text: string; href: string }> = {}
  const errorSummary: Array<{ text: string; href: string }> = []

  if (!tripCountry) {
    const error = { text: 'Select a country', href: '#tripCountry' }
    errors.tripCountry = error
    errorSummary.push(error)
  }

  if (!tripDepartureDate) {
    const error = { text: 'Enter a departure date', href: '#tripDepartureDate' }
    errors.tripDepartureDate = error
    errorSummary.push(error)
  } else if (!isValidDate(tripDepartureDate)) {
    const error = { text: 'Enter a valid departure date', href: '#tripDepartureDate' }
    errors.tripDepartureDate = error
    errorSummary.push(error)
  }

  if (!tripReturnDate) {
    const error = { text: 'Enter a return date', href: '#tripReturnDate' }
    errors.tripReturnDate = error
    errorSummary.push(error)
  } else if (!isValidDate(tripReturnDate)) {
    const error = { text: 'Enter a valid return date', href: '#tripReturnDate' }
    errors.tripReturnDate = error
    errorSummary.push(error)
  } else if (
    isValidDate(tripDepartureDate) &&
    new Date(tripReturnDate) <= new Date(tripDepartureDate)
  ) {
    const error = {
      text: 'Return date must be after the departure date',
      href: '#tripReturnDate',
    }
    errors.tripReturnDate = error
    errorSummary.push(error)
  }

  if (errorSummary.length) {
    const countries = await caseApi.getReferenceData('countries')

    return res.render('pages/add-trip', {
      countries,
      tripCountry,
      tripDepartureDate,
      tripReturnDate,
      errors,
      errorSummary,
      backLink: '/travel-declaration/your-trips',
      csrfToken: req.csrfToken(),
    })
  }

  req.session.answers = {
    ...req.session.answers,
    tripCountry,
    tripDepartureDate,
    tripReturnDate,
  }

  res.redirect('/travel-declaration/check-answers')
})
```

And the template that goes with it:

```nunjucks
{% extends "partials/layout.njk" %}

{% block content %}
  <div class="govuk-grid-row">
    <div class="govuk-grid-column-two-thirds">

      {% if errorSummary | length %}
        {{ govukErrorSummary({
          titleText: "There is a problem",
          errorList: errorSummary
        }) }}
      {% endif %}

      <form method="post" novalidate>
        <input type="hidden" name="_csrf" value="{{ csrfToken }}">

        {{ govukSelect({
          id: "tripCountry",
          name: "tripCountry",
          label: { text: "Which country did you visit?" },
          items: countries,
          value: tripCountry,
          errorMessage: errors.tripCountry
        }) }}

        {{ govukDateInput({
          id: "tripDepartureDate",
          namePrefix: "tripDepartureDate",
          fieldset: {
            legend: { text: "Departure date" }
          },
          value: tripDepartureDate,
          errorMessage: errors.tripDepartureDate
        }) }}

        {{ govukDateInput({
          id: "tripReturnDate",
          namePrefix: "tripReturnDate",
          fieldset: {
            legend: { text: "Return date" }
          },
          value: tripReturnDate,
          errorMessage: errors.tripReturnDate
        }) }}

        {{ govukButton({ text: "Save and continue" }) }}
      </form>
    </div>
  </div>
{% endblock %}
```

That is roughly 120 lines across two files for a single page with
three fields. It handles validation, error display, re-population
of submitted values, and a redirect on success. And it is still
missing reachability checks, date parsing, field formatting, and
accessible error binding for composite date inputs.

Multiply this across 10, 20, or 40 steps and patterns emerge:

- **Repeated plumbing.** Every route loads data, handles validation,
  re-renders on error with the right field state, saves, and
  redirects. The structure is the same; the details change.
- **Scattered validation.** Rules live inside POST handlers, mixed
  with error object construction and rendering logic. Changing a
  rule means finding the right handler and reading through the
  imperative flow.
- **Fragile navigation.** Redirect targets are hardcoded strings.
  Rename a path and every reference breaks silently. Branching
  logic lives in if-chains inside individual handlers, invisible
  to the rest of the application.
- **No reachability.** Nothing stops a user from typing a URL
  directly and skipping to step 8. Resuming a partially-completed
  journey means writing bespoke "where were they up to?" logic.
- **Template per page.** Every page needs its own template wiring
  up GOV.UK macros, binding error messages to the right fields,
  repopulating submitted values, and adding conditional error
  classes - all by hand, for every page.
- **Difficult to review.** Understanding the journey as a whole
  means reading every handler and every template, then mentally
  stitching the flow together.

---

## What Forge does instead

Forge replaces the per-route procedural code with a single
declarative definition. The same step:

```typescript
const addTripStep = step({
  path: '/add-trip',
  title: 'Add a trip',
  blocks: [
    GovUKSelectInput({
      code: 'tripCountry',
      label: { text: 'Which country did you visit?' },
      items: Data('countries'),
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: 'Select a country',
        }),
      ],
    }),
    GovUKDateInputFull({
      code: 'tripDepartureDate',
      fieldset: {
        legend: { text: 'Departure date' },
      },
      validWhen: [
        ...GovUKValidations.DateInputFull({
          empty: 'Enter a departure date',
          missingDay: 'Departure date must include a day',
          missingMonth: 'Departure date must include a month',
          missingYear: 'Departure date must include a year',
          invalid: 'Enter a valid departure date',
        }),
      ],
    }),
    GovUKDateInputFull({
      code: 'tripReturnDate',
      fieldset: {
        legend: { text: 'Return date' },
      },
      validWhen: [
        ...GovUKValidations.DateInputFull({
          empty: 'Enter a return date',
          missingDay: 'Return date must include a day',
          missingMonth: 'Return date must include a month',
          missingYear: 'Return date must include a year',
          invalid: 'Enter a valid return date',
        }),
        validation({
          condition: Self().match(
            Condition.Date.IsAfter(Answer('tripDepartureDate')),
          ),
          message: 'Return date must be after the departure date',
        }),
      ],
    }),
    GovUKButton({ text: 'Save and continue' }),
  ],
  onAccess: [
    access({
      effects: [MyEffects.LoadCountries()],
    }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [MyEffects.SaveAnswers()],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
```

No template. No GET and POST handlers. No error object
construction. No re-rendering logic. No manual field repopulation.

The definition describes what the page contains and what should
happen. Forge decides how and when:

- **Fields and their validation rules** - Forge runs validation,
  collects errors, renders error state on the correct fields, and
  displays the error summary.
- **Effects that load data** - Forge calls them at the right point
  in the lifecycle and makes results available to blocks through
  `Data()`.
- **Effects that save answers** - Forge runs them after successful
  validation, before the redirect.
- **A redirect target** - Forge builds the URL and issues the
  redirect.
- **Entry points and step ordering** - Forge evaluates reachability,
  handles resume logic, and prevents skipped steps.
- **Blocks with component variants** - Forge renders the right
  GOV.UK or MOJ markup, repopulates values, and binds accessibility
  attributes.

---

## When to use Forge

Forge was designed for multi-page form journeys with structured
navigation, but its model is more general than that. Any service
built from pages with content, data loading, and navigation between
steps fits naturally. The documentation you are reading now is itself
a Forge journey.

That said, Forge adds structure. If your service is a single endpoint
returning JSON, or a static page with no data loading or navigation,
Express routes on their own are simpler. Forge earns its keep when
you have enough pages and enough shared concerns that the declarative
model saves you from repeating yourself.

As adoption grows, teams can share journeys and patterns as reusable
modules, publish integrations as effect packages, and move between
services that share a common structure.
