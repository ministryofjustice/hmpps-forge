---
title: Creating your own field component
slug: creating-your-own-field-component
section: how-to-guides
path: how-to-guides/creating-your-own-field-component
nav: Extending Forge/Components
order: 3
description: Turn custom markup into a field component that collects an answer, shows its value, and displays validation errors
teaches: [field-components, field-option, field-value, field-errors, errorAnchor, inputSchema]
prerequisites: [adding-properties-logic-and-nested-blocks-to-your-component, field]
related:
  concept: [how-blocks-resolution-and-rendering-connect, how-answers-work, how-validation-works]
  how-to: [adding-properties-logic-and-nested-blocks-to-your-component, testing-a-component]
  reference: [component, field, validation]
---

# Creating your own field component

The contact panel and the booking card both *show* things. Sooner or later, though, the designers hand you a piece of UI that *asks* for something, and no component package produces it. That's a different kind of component. It doesn't only render markup. It collects an answer, shows the current one back, and tells the user when their answer isn't acceptable.

In this how-to, we'll build a visit slot picker for the booking service: a set of time slots the visitor chooses from. By the end, an author can drop it onto a step like any packaged field component, write `validWhen` rules against it, and read its answer back with `Answer()`. Let's start with what the designers drew.

## Start with the markup you want to reuse

Here's the picker. Each slot is a card with a radio button, a time, and a short note about availability:

```html
<fieldset class="app-slot-picker">
  <legend class="app-slot-picker__legend">Choose a visit slot</legend>
  <div class="app-slot-picker__slot">
    <input class="app-slot-picker__input" type="radio" id="slot-morning" name="visitSlot" value="morning">
    <label class="app-slot-picker__label" for="slot-morning">Morning, 9:30am to 11:30am</label>
    <p class="app-slot-picker__hint">3 places left</p>
  </div>
  <div class="app-slot-picker__slot">
    <input class="app-slot-picker__input" type="radio" id="slot-afternoon" name="visitSlot" value="afternoon">
    <label class="app-slot-picker__label" for="slot-afternoon">Afternoon, 2pm to 4pm</label>
    <p class="app-slot-picker__hint">1 place left</p>
  </div>
</fieldset>
```

A packaged radio component with a pile of custom classes gets close, but the slot cards are their own design. They deserve their own component. Before we write it, let's find out what a field evaluator receives that the card's did not.

## Find out what a field receives

The booking card received evaluated props and returned HTML. That's still true here. But a field takes part in the request in three more ways, and each one shows up as something the component receives or promises:

- **A name.** The radio inputs need a `name` attribute, and the submitted value needs an answer key to be recorded under. Both come from the field's `code`.
- **A value.** When the page shows a saved answer, or a submit fails validation, the slot they chose must be selected. The current answer arrives in the evaluator's props as `value`.
- **Errors.** When a `validWhen` rule fails, the component must show the message next to the input. The visible failures arrive in the evaluator's props as `errors`.

None of that is the component's job to *work out*. Answer preparation and validation run before rendering, so by the time our evaluator is called, `code`, `value`, and `errors` are already in its props alongside the ones we declare. [How answers work](../concepts/how-answers-work) covers where the value comes from on a `GET` and a `POST`. Our job is to put those three things into the markup.

Let's declare the component as a field, so those props arrive.

## Declare the component as a field

Create `appSlotPicker.ts`. The props describe what an author configures: a legend and a list of slots. Then the one new option, <s1>`field: true`</s1>, turns the declaration into a field component:

```typescript [[1, 15, "field: true"]]
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

export interface AppSlot {
  id: string
  label: string
  hint?: string
}

export interface AppSlotPickerProps {
  legend: string
  slots: AppSlot[]
}

export const AppSlotPicker = nunjucksComponent<AppSlotPickerProps>('appSlotPicker', {
  field: true,
  factory: ({ nunjucksEnv }) => props =>
    nunjucksEnv.render('components/app-slot-picker/template.njk', {
      legend: props.legend,
      slots: props.slots,
    }),
})
```

That one option changes two things. On the authoring side, the builder now requires a `code` and accepts the shared field properties: `validWhen`, `defaultValue`, `dependentWhen`, `formatters`, and the rest. On the rendering side, the evaluator's `props` gain `code`, `value`, and `errors`. TypeScript knows this too. The evaluator's props are typed as `FieldComponentRenderProps<AppSlotPickerProps>`, so `props.code` and `props.value` are there to use.

We haven't used them yet, which is why the template can't collect anything. Let's fix that.

## Name the inputs and select the current value

Under one of our Nunjucks search paths, create `server/views/components/app-slot-picker/template.njk`. It's the designers' markup with three substitutions: the legend, a loop over the slots, and the two field values:

```nunjucks [[2, 5, "name=\"{{ code }}\""], [3, 6, "checked"]]
<fieldset class="app-slot-picker">
  <legend class="app-slot-picker__legend">{{ legend }}</legend>
  {% for slot in slots %}
    <div class="app-slot-picker__slot">
      <input class="app-slot-picker__input" type="radio" id="slot-{{ slot.id }}" name="{{ code }}" value="{{ slot.id }}"
        {% if slot.id == value %}checked{% endif %}>
      <label class="app-slot-picker__label" for="slot-{{ slot.id }}">{{ slot.label }}</label>
      {% if slot.hint %}<p class="app-slot-picker__hint">{{ slot.hint }}</p>{% endif %}
    </div>
  {% endfor %}
</fieldset>
```

The <s2>input name</s2> is the field code. When the form posts, the browser sends the chosen slot under that name, and answer preparation records it under that code. Nothing else links the two, so the name must be the code exactly.

The <s3>checked attribute</s3> compares each slot against `value`. On a `GET`, that's the answer your access hooks loaded, or the `defaultValue` when they loaded none. On a `POST` that fails validation, it's the value the visitor submitted, so their choice stays selected while they read the error. Nothing persists between requests. The component renders whatever answer this request carries.

Now hand those two values over from the evaluator:

```typescript [[2, 6, "code: props.code"], [3, 7, "value: props.value"]]
export const AppSlotPicker = nunjucksComponent<AppSlotPickerProps>('appSlotPicker', {
  field: true,
  factory: ({ nunjucksEnv }) => props =>
    nunjucksEnv.render('components/app-slot-picker/template.njk', {
      legend: props.legend,
      code: props.code,
      value: props.value,
      slots: props.slots,
    }),
})
```

The evaluator passes the <s2>field code</s2> and the <s3>current value</s3> straight through. It doesn't look the answer up or decide what "current" means. Answer preparation already did, and the component renders what it's given.

## Use the field in a step

Now the booking journey can ask for a slot. The step reads like any other field: a `code`, the component's own props, and a `validWhen` rule:

```typescript [[4, 10, "code: 'visitSlot'"], [5, 16, "validWhen: ["]]
import { step, submit, redirect, validation, Self, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { AppSlotPicker } from './components/appSlotPicker'

export const chooseSlotStep = step({
  path: '/choose-slot',
  title: 'Choose a visit slot',
  blocks: [
    AppSlotPicker({
      code: 'visitSlot',
      legend: 'Choose a visit slot',
      slots: [
        { id: 'morning', label: 'Morning, 9:30am to 11:30am', hint: '3 places left' },
        { id: 'afternoon', label: 'Afternoon, 2pm to 4pm', hint: '1 place left' },
      ],
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: 'Choose a visit slot',
        }),
      ],
    }),
    GovUKButton({ text: 'Continue' }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        next: [redirect({ goto: 'visitor-details' })],
      },
    }),
  ],
})
```

The <s4>field code</s4> names the answer. Downstream steps read it with `Answer('visitSlot')`, and it's the `name` our template gives the radios. The <s5>validation rule</s5> is ordinary field validation. The component didn't have to do anything to earn it. `field: true` made the builder accept `validWhen`, and validation runs the rule against the answer the code names.

With the afternoon slot chosen, a submit passes validation and the journey moves on to visitor details. If the journey saves answers and loads them again on access, the slot is still selected when the page renders later. An empty submit is different. The page re-renders and the step doesn't progress, but nothing on the page says why! Validation ran and failed, and the message is in our evaluator's props. Our template doesn't show it yet.

## Show the errors next to the input

When validation fails on a `POST`, the visible failures for this field arrive as `props.errors`, an array of `{ message, details }` objects. When there are no visible failures, `errors` is absent. [How validation works](../concepts/how-validation-works) explains when failures become visible. For the component, the rule is short: if `errors` is present, show them.

Pass them through from the evaluator:

```typescript [[6, 8, "errors: props.errors ?? []"]]
export const AppSlotPicker = nunjucksComponent<AppSlotPickerProps>('appSlotPicker', {
  field: true,
  factory: ({ nunjucksEnv }) => props =>
    nunjucksEnv.render('components/app-slot-picker/template.njk', {
      legend: props.legend,
      code: props.code,
      value: props.value,
      errors: props.errors ?? [],
      slots: props.slots,
    }),
})
```

The <s6>error list</s6> defaults to an empty array, so the template can always loop.

Then give the messages a home in the template, between the legend and the slots, and mark the fieldset so the styles can show the error state:

```nunjucks [[6, 1, "app-slot-picker--error"], [6, 3, "for error in errors"]]
<fieldset class="app-slot-picker{% if errors.length %} app-slot-picker--error{% endif %}">
  <legend class="app-slot-picker__legend">{{ legend }}</legend>
  {% for error in errors %}
    <p class="app-slot-picker__error">{{ error.message }}</p>
  {% endfor %}
  {% for slot in slots %}
    <div class="app-slot-picker__slot">
      <input class="app-slot-picker__input" type="radio" id="slot-{{ slot.id }}" name="{{ code }}" value="{{ slot.id }}"
        {% if slot.id == value %}checked{% endif %}>
      <label class="app-slot-picker__label" for="slot-{{ slot.id }}">{{ slot.label }}</label>
      {% if slot.hint %}<p class="app-slot-picker__hint">{{ slot.hint }}</p>{% endif %}
    </div>
  {% endfor %}
</fieldset>
```

Now an empty submit shows "Choose a visit slot" above the slots, the fieldset picks up its error class, and the message is the one the author wrote in `validWhen`. The component never saw the rule. It only rendered the <s6>error list</s6> it was handed.

## Point the error summary at the right input

Our page template from [Install frontend libraries](../get-started/install-frontend-libraries) renders a GOV.UK error summary at the top of the page. Each entry in it links to the field with the problem. The link for our picker, though, goes nowhere. The summary links to `#visitSlot`, because by default a field's anchor is its code, and no element on the page has that ID. Our first radio is `slot-morning`.

A field component can say where its links land with `errorAnchor`. It receives the same render props as the evaluator and returns an element ID:

```typescript [[7, 3, "errorAnchor:"]]
export const AppSlotPicker = nunjucksComponent<AppSlotPickerProps>('appSlotPicker', {
  field: true,
  errorAnchor: props => `slot-${props.slots[0]?.id ?? ''}`,
  factory: ({ nunjucksEnv }) => props =>
    nunjucksEnv.render('components/app-slot-picker/template.njk', {
      legend: props.legend,
      code: props.code,
      value: props.value,
      errors: props.errors ?? [],
      slots: props.slots,
    }),
})
```

The <s7>error anchor</s7> returns the first slot's input ID, which is the same ID the template builds. Now the summary link takes the visitor to the first radio, and keyboard users land where they need to be.

You only need `errorAnchor` when the rendered input's ID differs from the code. A single text input with `id="{{ code }}"` can leave it out.

## Guard what the field accepts

One last thing. Our template only ever renders the slot IDs the author listed, but a form post is only text. Someone can send `visitSlot=anything`, or send it twice and post an array. Before the answer is recorded, a field component can check the shape of the submitted value with `inputSchema`:

```typescript [[8, 1, "import { z } from 'zod'"], [8, 6, "inputSchema: z.string()"]]
import { z } from 'zod'
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

export const AppSlotPicker = nunjucksComponent<AppSlotPickerProps>('appSlotPicker', {
  field: true,
  inputSchema: z.string(),
  errorAnchor: props => `slot-${props.slots[0]?.id ?? ''}`,
  factory: ({ nunjucksEnv }) => props =>
    nunjucksEnv.render('components/app-slot-picker/template.njk', {
      legend: props.legend,
      code: props.code,
      value: props.value,
      errors: props.errors ?? [],
      slots: props.slots,
    }),
})
```

The <s8>input schema</s8> says a submitted slot is a single string. A value that doesn't match becomes `undefined` before formatters or validation run, so a posted array turns into "no answer" and the `IsRequired` rule catches it. The schema doesn't produce a message of its own. It only guarantees that the value reaching validation has the shape the component expects.

Note what the schema does *not* do. It doesn't check that the string is one of the author's slots. That's a journey rule, not a shape rule, and it belongs in `validWhen` where the author can give it a message.

## See how the pieces work together

Here's the whole field in one look, from the author's call to the rendered radios and back:

```text
authoring     AppSlotPicker({ code: 'visitSlot', slots, validWhen })
    ↓
POST          browser sends visitSlot=afternoon
    ↓
preparation   inputSchema checks the shape → answer recorded under 'visitSlot'
    ↓
validation    validWhen rules run → failures selected for display
    ↓
rendering     evaluator receives { code, value, errors, legend, slots } → template.njk → HTML
```

The component sits at the last line. Everything above it happens in the request pipeline, driven by the `code` the author gave the field.

## Recap

You've turned a piece of custom markup into a field that collects an answer, shows it back, and explains its own errors.

Let's recap the key points.

- `field: true` makes a component a field. The builder then requires a `code` and accepts `validWhen`, `defaultValue`, `dependentWhen`, and the other field properties.
- A field evaluator receives `code`, `value`, and `errors` alongside the props you declare. It renders them. It doesn't look answers up or run validation.
- The input's `name` must be the field code. That's the only link between the form post and the answer.
- Render `value` as the selected or filled state. It's the answer this request carries: loaded by access hooks, seeded by `defaultValue`, or submitted on a failed `POST`.
- Render `errors` when present. The messages come from the author's `validWhen` rules.
- Use `errorAnchor` when the rendered input's ID differs from the code, so error summary links land on the input.
- Use `inputSchema` to guard the shape of the submitted value. Leave meaning and messages to `validWhen`.
- A field that collects several values at once, such as a set of checkboxes, adds `multiple: true` and a `z.array()` schema. The [`component()` reference](../reference/functions/component) covers that option.

The next job is proving the picker renders the right thing for a given value and set of errors. [Testing a component](./testing-a-component) shows how to render a component directly with evaluated props.
