---
title: Creating your own custom component
slug: creating-your-own-custom-component
section: how-to-guides
path: how-to-guides/creating-your-own-custom-component
nav: Extending Forge/Components
order: 1
description: Create and use an application-owned component with Forge's Nunjucks renderer
teaches: [nunjucksComponent, custom-components, component-registration, component-builders, renderer-boundary]
prerequisites: [block, create-forge-package, using-forge-with-express-and-nunjucks]
related:
  concept: how-blocks-resolution-and-rendering-connect
  how-to: [adding-properties-logic-and-nested-blocks-to-your-component]
---

# Creating your own custom component

Sooner or later, your designers hand you a piece of UI no component package produces - a contact panel, a booking card, or some other cool component unique to your service. And it *is* cool, which is exactly why hacking it together from existing components would be a shame. So let's define it once as a custom component, and make it something authors can easily use over and over.

In this how-to, we'll turn a contact panel into an `AppContactPanel` component, wired end-to-end from authored block to rendered HTML. Let's begin with the markup.

## Start with the markup you want to reuse

Here's the panel our designers have drawn up. It sits at the bottom of every page in the
booking service:

```html
<div class="app-contact-panel">
  <h2 class="app-contact-panel__title">Need help with your booking?</h2>
  <p class="app-contact-panel__phone">Call 0306 999 0117</p>
  <p class="app-contact-panel__hours">Monday to Friday, 9am to 5pm</p>
</div>
```

No component package produces that. It isn't a panel with a heading bolted on, or an inset
text with different classes - it's markup our service invented, and only our service knows
about it. We could paste it into each page with `HtmlBlock`, but then every one of those pages carries the class
names and the phone number, and a change to either means updating them all manually!

What we want instead is a block an author can drop onto any page: the author asks for the
panel, and the component takes care of everything it shows. Before we can write that,
though, there's a question worth answering: what does a component actually hand back to
Forge?

## Find out what a component needs to return

Components live on the rendering side of Forge, so the answer depends on the renderer our
application uses. The renderer decides what output it needs from a component.

With Forge's Express and Nunjucks adapter, the contract is straightforward: a component's
factory receives a Nunjucks environment, and its evaluator returns an HTML string. We build
one with `nunjucksComponent()`, and the templates it renders come from the same
search paths as the rest of the application - the `nunjucksEnv` we passed to
`createExpressRouter()` back in
[Using Forge with Express and Nunjucks](../get-started/using-forge-with-express-and-nunjucks).

So there are two pieces to write: a Nunjucks template holding the markup, and the
component that renders it. Calling the component creates its authored block, and
`createForgePackage()` collects the component entry from the journey automatically.

The panel has nothing to configure - same phone number, same hours, same everywhere -
so those two pieces are the whole component. All that remains is to connect them.
Let's start with the template.

## Create the component

Because we're using a Nunjucks renderer, we'll start with building our Nunjucks template, based on the HTML our
designers shared.

We'll add a new file, `server/views/components/app-contact-panel/template.njk`, and in it, we'll write:

```nunjucks
<div class="app-contact-panel">
  <h2 class="app-contact-panel__title">Need help with your booking?</h2>
  <p class="app-contact-panel__phone">Call 0306 999 0117</p>
  <p class="app-contact-panel__hours">Monday to Friday, 9am to 5pm</p>
</div>
```

This file is covered under our Nunjucks search paths, and because our content is completely static, our
template is super simple! Just the HTML shared earlier!

Now create `appContactPanel.ts`:

```typescript [[2, 3, "'appContactPanel'"], [3, 3, "nunjucksComponent"], [4, 5, "nunjucksEnv.render"], [1, 5, "components/app-contact-panel/template.njk"]]
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

export const AppContactPanel = nunjucksComponent('appContactPanel', {
  factory: ({ nunjucksEnv }) => () =>
    nunjucksEnv.render('components/app-contact-panel/template.njk'),
})
```

The panel says the same thing on every page, so there's nothing for an author to configure.

The <s3>component entry</s3> created by `nunjucksComponent()` is carried by the blocks it
creates. The <s2>component name</s2> - `'appContactPanel'` - becomes their variant.

The factory receives a Nunjucks environment and returns the component's evaluator.
Inside it, <s4>Nunjucks rendering</s4> happens through
`nunjucksEnv.render()`. The path to the <s1>Nunjucks template</s1> connects the component
to a file in the application's existing Nunjucks search paths - the same place every other
template lives - and the method returns the rendered HTML string.

That's the component finished! Now to use it!

## Use the component in a step

Now an author can just ask for the panel:

```typescript [[6, 10, "AppContactPanel()"]]
import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading } from '@ministryofjustice/hmpps-forge/govuk-components'
import { AppContactPanel } from './components/appContactPanel'

export const bookingOverviewStep = step({
  path: '/overview',
  title: 'Booking overview',
  blocks: [
    GovUKHeading({ text: 'Booking overview', size: 'l' }),
    AppContactPanel(),
  ],
})
```

The <s6>component call</s6> creates an `appContactPanel` block with the variant already in
place. It also carries the component entry, ready for the package to collect it.

Create the package for the journey containing this step:

```typescript [[5, 4, "createForgePackage({"]]
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { bookingJourney } from './bookingJourney'

export default createForgePackage({
  journey: bookingJourney,
})
```

The <s5>package creation</s5> collects `AppContactPanel` from the journey. The component
stays scoped to that package.

Load the page and there's the designers' panel, class names and all! An authored block
became rendered HTML: the block, the template, and the component entry
are all connected. And that isn't a first milestone - it's the whole component. The panel
needs nothing from the pages it appears on, so there's nothing left to add.

## See how the pieces work together

You've built one component across the authoring and rendering sides of Forge. Here's the
whole route in one look:

```text [[6, 1, "AppContactPanel()"], [2, 3, "'appContactPanel'"], [5, 5, "createForgePackage({ journey: bookingJourney })"], [3, 7, "nunjucksComponent"], [4, 7, "nunjucksEnv.render"], [1, 7, "template.njk"]]
authoring     AppContactPanel()
    ↓
variant       'appContactPanel'
    ↓
package       createForgePackage({ journey: bookingJourney })
    ↓
rendering     nunjucksComponent → nunjucksEnv.render → template.njk → HTML
```

The <s6>component call</s6> creates a block carrying the <s2>component name</s2>. That
block also carries its <s3>component entry</s3>, collected during
<s5>package creation</s5>. Its evaluator uses <s4>Nunjucks rendering</s4> to render the
<s1>Nunjucks template</s1> and returns the resulting HTML.

## Recap

You've taken markup only your service knows about and turned it into a component an author
can drop onto any page.

Let's recap the key points.

- A component's contract comes from the renderer, so check the adapter's component builder
  for what your evaluator receives and what it must return.
- With the Express and Nunjucks adapter, a component's factory receives a Nunjucks environment
  and its evaluator returns an HTML string - `nunjucksComponent()` builds the entry.
- Call the component to create a block carrying its variant and component entry.
- `createForgePackage()` collects component entries from the journey automatically.

Not every component is as self-contained as the panel, though. A card showing *this*
page's booking needs the page to have a say in what it displays - and building one is the
next guide: [Adding properties, logic and nested blocks to your
component](./adding-properties-logic-and-nested-blocks-to-your-component).
