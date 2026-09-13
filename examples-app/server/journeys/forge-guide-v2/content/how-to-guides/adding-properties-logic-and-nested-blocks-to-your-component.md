---
title: Adding properties, logic and nested blocks to your component
slug: adding-properties-logic-and-nested-blocks-to-your-component
section: how-to-guides
path: how-to-guides/adding-properties-logic-and-nested-blocks-to-your-component
nav: Extending Forge/Components
order: 2
description: Give a custom component authored properties, typed presentation logic, and child blocks authors can place inside it
teaches: [component-props, component, plain-props, component-logic, resolved-props, nested-blocks, rendered-children]
prerequisites: [creating-your-own-custom-component]
related:
  concept: how-blocks-resolution-and-rendering-connect
  how-to: [creating-your-own-custom-component, creating-your-own-field-component]
---

# Adding properties, logic and nested blocks to your component

As you build out your service, you’ll eventually want to create components that are a little more dynamic. We covered a simple, static component in [Creating your own custom component](./creating-your-own-custom-component), but now it’s time to build something with a bit more going on.

In this how-to, we’ll build a component that accepts properties, contains presentation logic, and renders nested blocks. Let’s start with a new example: a booking card.

## Start with the booking card

Here's the booking card our designers have drawn up for a booking overview page:

```html
<div class="app-booking-card">
  <h2 class="app-booking-card__title">Visit to HMP Leeds</h2>
  <dl class="app-booking-card__details">
    <dt class="app-booking-card__label">Date</dt>
    <dd class="app-booking-card__value">12 May 2026</dd>
    <dt class="app-booking-card__label">Visitor</dt>
    <dd class="app-booking-card__value">Alex Smith</dd>
  </dl>
</div>
```

The content of the card is mostly dynamic: the title, date and visitor are all driven by data in the current request. By using props, authors can supply those details as part of the definition without having to worry about any of the card's markup. Let's start by describing the properties they can provide.

## Describe the block and its properties

Create `appBookingCard.ts` and describe the values an author can provide:

```typescript [[1, 9, "title: string"], [1, 10, "details: AppBookingCardDetail[]"]]
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

export interface AppBookingCardDetail {
  label: string
  value: string
}

export interface AppBookingCardProps {
  title: string
  details: AppBookingCardDetail[]
}
```

The <s1>component properties</s1> are fairly small for now: authors give the card a title and a list of label-and-value rows.
The component builder includes the familiar properties shared by every authored block, such as `visibleWhen`.

These types describe the plain values the evaluator receives. The builder also accepts
Forge expressions, so a page showing a real booking can write `Data('booking.title')`
anywhere this example writes a string - we'll see why the component doesn't need to care
when we reach the evaluator.

That's the authored side. Now the designers' markup needs to ask for those values instead
of hardcoding them.

## Write the template around the properties

Under one of our application's Nunjucks search paths, create
`server/views/components/app-booking-card/template.njk` - the designers' markup, with the
fixed text swapped for the values the block carries:

```nunjucks [[2, 2, "{{ title }}"], [2, 4, "for detail in details"]]
<div class="app-booking-card">
  <h2 class="app-booking-card__title">{{ title }}</h2>
  <dl class="app-booking-card__details">
    {% for detail in details %}
      <dt class="app-booking-card__label">{{ detail.label }}</dt>
      <dd class="app-booking-card__value">{{ detail.value }}</dd>
    {% endfor %}
  </dl>
</div>
```

With the <s2>properties in the template</s2>, it can show any booking, not just the hardcoded values. `{{ title }}` takes care of the heading, and the loop builds a row for each item in `details`. All the template asks for is a title and a list of details, so let's update the component's evaluator to hand them over.

## Hand the evaluated properties to the template

The component entry joins the two sides, just as it did for the panel - but this time the
evaluator has something to read from the block:

```typescript [[3, 4, "title: props.title"], [3, 5, "details: props.details"]]
export const AppBookingCard = nunjucksComponent<AppBookingCardProps>('appBookingCard', {
  factory: ({ nunjucksEnv }) => props =>
    nunjucksEnv.render('components/app-booking-card/template.njk', {
      title: props.title,
      details: props.details,
    }),
})
```

By the time the evaluator runs, the resolving is already done. That
means `props.title` and each `detail.value` are <s3>evaluated properties</s3>: they arrive as plain values, ready to hand
to the template. The component doesn't need to worry about whether an author supplied a
value directly or pulled it from request data.

The package collects `AppBookingCard` from the journey,
[exactly as it does for the panel](./creating-your-own-custom-component).

## Use it in a step

And the overview step can show its own booking:

```typescript [[1, 6, "AppBookingCard({"], [1, 7, "title: 'Visit to HMP Leeds'"], [1, 8, "details: ["]]
export const bookingOverviewStep = step({
  path: '/overview',
  title: 'Booking overview',
  blocks: [
    GovUKHeading({ text: 'Booking overview', size: 'l' }),
    AppBookingCard({
      title: 'Visit to HMP Leeds',
      details: [
        { label: 'Date', value: '12 May 2026' },
        { label: 'Visitor', value: 'Alex Smith' },
      ],
    }),
  ],
})
```

Load the page and there’s our new card, filled with the details from the step!
The author only decides what the card should say; its markup stays tucked away in the component.
Best of all, if the design changes later, there’s just the one template to update!

## Adding logic into your components

So, our card renders, but it's a little naive once real bookings start arriving. A booking with no
visitor assigned yet comes through as an empty string, and the card dutifully renders a label
with nothing after it. We may also want our component to take dates in one format, and render them out
in a more human-friendly fashion.

Both are problem's the component can solve. Start on the authored side: extend the card's
<s1>component properties</s1> with an optional date alongside `title`:

```typescript [[1, 3, "date?: string"]]
export interface AppBookingCardProps {
  title: string
  date?: string
  details: AppBookingCardDetail[]
}
```

The evaluator can deal with the rest:

```typescript [[4, 1, "new Intl.DateTimeFormat"], [4, 9, "const dateDetails"], [4, 12, "const filteredDetails"]]
const bookingDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export const AppBookingCard = nunjucksComponent<AppBookingCardProps>('appBookingCard', {
  factory: ({ nunjucksEnv }) => props => {
    const dateDetails = props.date
      ? [{ label: 'Date', value: bookingDateFormat.format(new Date(props.date)) }]
      : []
    const filteredDetails = [...dateDetails, ...props.details].filter(detail => detail.value !== '')

    return nunjucksEnv.render('components/app-booking-card/template.njk', {
      title: props.title,
      details: filteredDetails,
    })
  },
})
```

All of that <s4>presentation logic</s4> - formatting the date, dropping the empty rows - runs before the
template sees anything. The template stays a loop over rows that definitely have something in
them, and the step just passes `date: '2026-05-12'` and says nothing about how it should look.

Both of these could have gone in the template. Nunjucks has `{% if %}`, and dates could be
handled by registering a filter on the environment - though that filter would then belong to
every template in the application, not just this card.

Keeping them in the component makes them ordinary TypeScript. The compiler knows `details` is an
`AppBookingCardDetail[]`, so a typo in `value` fails the build instead of quietly blanking a row.
The formatter is a normal function you can pull out and test. And as the rules get fussier -
sorting the details, hiding the card when nothing's left in it - none of that fussiness leaks
into the markup. The template stays a description of what the card looks like, and the thinking
happens where the types are.

That leaves the overview step to catch up: the Date row moves out of `details`, and the
author now supplies the raw date for the <s4>presentation logic</s4> to format:

```typescript [[4, 3, "date: '2026-05-12'"]]
AppBookingCard({
  title: 'Visit to HMP Leeds',
  date: '2026-05-12',
  details: [
    { label: 'Visitor', value: 'Alex Smith' },
  ],
})
```

Load the page: the same card, but the Date row is now the component's work - formatted from
the kind of value a booking record actually holds, with any empty rows quietly gone.

## Display child blocks inside your component

One of the booking pages now wants a "Change booking" link inside the card, sitting under
the details. We could add a `changeHref` property - but the next page wants two links, and
another wants a warning about visiting hours. Down that road, the card slowly grows a
property for every block that might ever sit inside it.

There's a more honest way to say what we mean: let authors put blocks in the card. Add an
`actions` area to the props, typed as the blocks it holds:

```typescript [[5, 5, "actions?: BlockDefinition[]"]]
export interface AppBookingCardProps {
  title: string
  date?: string
  details: AppBookingCardDetail[]
  actions?: BlockDefinition[]
}
```

The new property introduces <s5>nested blocks</s5> - it's typed with
`BlockDefinition`. Any block an author could put on a page, they can now put in the card's actions
area.

That raises a question for the evaluator: does it need to render those child blocks too?
Thankfully, no. Children render before their parent.

By the time the card's evaluator runs, every block in `actions` has already been through
its own component. Each one arrives as a rendered wrapper, pairing its original definition with
its finished HTML as `{ block, html }`.

You can see that handover in the types. The evaluator receives rendered children in
`props.actions`, rather than the `BlockDefinition[]` the author supplied.

So the card's only job is to place its children:

```typescript [[5, 11, "actions: props.actions ?? []"]]
export const AppBookingCard = nunjucksComponent<AppBookingCardProps>('appBookingCard', {
  factory: ({ nunjucksEnv }) => props => {
    const dateDetails = props.date
      ? [{ label: 'Date', value: bookingDateFormat.format(new Date(props.date)) }]
      : []
    const filteredDetails = [...dateDetails, ...props.details].filter(detail => detail.value !== '')

    return nunjucksEnv.render('components/app-booking-card/template.njk', {
      title: props.title,
      details: filteredDetails,
      actions: props.actions ?? [],
    })
  },
})
```

The only new line is the last property: the <s5>nested blocks</s5> pass straight through,
defaulting to an empty list so the template can always loop. The template gives them a home:

```nunjucks [[5, 11, "for action in actions"], [6, 11, "action.html"]]
<div class="app-booking-card">
  <h2 class="app-booking-card__title">{{ title }}</h2>
  <dl class="app-booking-card__details">
    {% for detail in details %}
      <dt class="app-booking-card__label">{{ detail.label }}</dt>
      <dd class="app-booking-card__value">{{ detail.value }}</dd>
    {% endfor %}
  </dl>
  {% if actions.length %}
    <div class="app-booking-card__actions">
      {% for action in actions %}{{ action.html | safe }}{% endfor %}
    </div>
  {% endif %}
</div>
```

Each action has already been rendered by this point. The template loops over the
<s5>nested blocks</s5>, taking each piece of <s6>rendered child HTML</s6> from
`action.html` and placing it inside the card.

We mark that HTML with `| safe` so Nunjucks renders it as markup instead of escaping it
into text.

:::note
---
---
Be careful where you use `| safe`: it disables Nunjucks' automatic escaping for that
value. Only use it for HTML produced by a trusted component. Marking user-controlled or
otherwise untrusted content as safe can introduce a cross-site scripting (XSS)
vulnerability.
:::

Now the overview page can put its link in the card:

```typescript [[5, 7, "actions: ["], [5, 8, "GovUKLinkButton"]]
AppBookingCard({
  title: 'Visit to HMP Leeds',
  date: '2026-05-12',
  details: [
    { label: 'Visitor', value: 'Alex Smith' },
  ],
  actions: [
    GovUKLinkButton({ text: 'Change booking', href: '/booking/change' }),
  ],
})
```

These <s5>nested blocks</s5> read like any other list of blocks, because that's exactly what they are.
`GovUKLinkButton` renders through its own registered component before the card ever sees
it - the card neither knows nor cares what its children are. Tomorrow's page can put a
warning or a tag in the same area, and the card doesn't change at all. A property typed as
a single `BlockDefinition` works the same way, arriving as one rendered wrapper.

## Recap

You've built the booking card: a component with properties, presentation logic, and child
blocks - on wiring no different from the contact panel's.

Let's recap the key points.

- Props are the component's public vocabulary - what goes in the card, never how it looks.
- The component builder includes standard block props, like `visibleWhen`.
- Describe props with plain value types. The builder accepts literal values or expressions;
  by render time, the evaluator sees only plain values.
- Presentation logic belongs in the evaluator, where it's ordinary TypeScript - typed
  by the compiler and testable as a plain function - so the template stays a description of
  what the card looks like.
- A property typed as `BlockDefinition[]` lets authors put any block on the page inside
  your component; children render first, so each arrives as a rendered wrapper - the
  definition paired with its finished HTML - and the component's only job is to place them.
- The template injects each child's `html` marked `| safe`, because it's markup another
  component already produced.

The card shows things. The next guide builds a component that asks for something instead.
[Creating your own field component](./creating-your-own-field-component) turns custom markup
into a field that collects an answer, keeps its value, and shows its own validation errors.
