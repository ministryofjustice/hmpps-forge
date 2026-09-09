---
title: What is Forge?
slug: what-is-forge
section: get-started
path: get-started/what-is-forge
nav: Thinking with Forge
order: 2
description: How Forge describes a web service as structured content and evaluates it for each request
teaches: [declarative-framework, definitions, journeys, steps, blocks, request-context, outcomes]
prerequisites: [the-web-in-declarative-form]
related:
  concept: [how-forge-runs-a-request, how-blocks-resolution-and-rendering-connect, packaging-journeys-into-an-app]
  reference: [journey, step, block-and-field-props]
---

# What is Forge?

In [The web in declarative form](the-web-in-declarative-form) we made a claim: every web service has a service model, and the only choice you get is where it lives. Forge is a framework built around that choice.

Forge is an open-source Node.js framework with two halves - a declarative language for describing a web service, and an engine that makes the description executable. This page tours both halves: what a description looks like, what happens when a request arrives, and where your own code fits in.

## The service becomes a definition

In Forge, you describe your service as structured content called a *definition*. A definition breaks down into a number of elements, with three key structural pieces:

- *Journeys* describe a flow and group the parts that belong to it.
- *Steps* describe the pages within that flow.
- *Blocks* describe the content and interactions within a step.

Blocks come in two kinds: content blocks, which are presentational, and field blocks, which collect input that can be referenced elsewhere.

These elements nest: a journey contains steps, steps contain blocks, and the relationships between them describe how the wider experience behaves. Here's a sketch of that shape, using the partner question from the previous page:

```ts
const hasPartnerField = GovUKRadioInput({
  code: 'hasPartner',
  fieldset: {
    legend: { text: 'Do you have a partner?', isPageHeading: true },
  },
  items: [
    { value: 'yes', text: 'Yes' },
    { value: 'no', text: 'No' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select yes if you have a partner',
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

journey({
  code: 'apply',
  title: 'Apply for a visit',
  path: '/apply',
  steps: [
    step({
      code: 'partner',
      path: '/partner',
      title: 'Do you have a partner?',
      blocks: [hasPartnerField, continueButton],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [
              ExampleEffects.SaveAnswers()
            ],
            next: [
              redirect({
                when: Answer('hasPartner').match(Condition.Equals('yes')),
                goto: 'partner-details',
              }),
              redirect({ goto: 'contact-details' }),
            ],
          },
        }),
      ],
    }),
    // ...the rest of the steps
  ],
})
```

This is a sketch to show the shape, the pages ahead cover each part in more detail. Focusing on the structure though, look at what it holds.

* `hasPartnerField` is a field block: a radio input whose code is `hasPartner`, and that code is what creates the answer.

* A few lines further down, `Answer('hasPartner')` reads the same answer to decide where the journey goes next.

The dependency the previous page traced across four files is stated here in one place: the field that collects the value and the transition that depends on it sit in the same description. There's no handler running statements one after another. `when:` isn't code that executes on the spot; it's a fact about the service - "the partner-details step follows this one when the answer is yes".

A definition can state validation rules, visibility, reachability (whether a step can be visited at all, given what's known so far), and the points where application work should happen. All of it has the same character: facts about what exists, what it depends on, and what should be possible.

And because the definition is structured, Forge understands more than the page being rendered. It evaluates that page in the context of the journey around it - which is exactly what the partner example needed, since changing that one answer had consequences well beyond its own page.

## The request context makes the definition concrete

A definition full of conditions raises a question: conditions on *what*? The sketch above checks whether someone answered "yes" to the partner question - so where does that "yes" live for the request being handled?

The trick is the definition stays the same from one request to the next. What changes is the *request context*.

Some of it arrives with the request itself: the method, query values, submitted data, headers, cookies, and so on. But a request rarely carries everything the page needs. For the rest, the definition names what should be loaded, such as records, permissions, and saved answers. Forge then runs effects supplied by your application to load them before the later parts of the request are evaluated.

Forge brings all of those sources together into one request context.

That's why the same definition can behave differently for different people. The same content can resolve differently, validation can produce a different result, and a step may belong to one person's path but not another's. The authored service never changes - what's known for this request does.

One property here is worth pausing on: Forge itself is completely stateless. All state lives in the request context, none in Forge. Evaluation depends only on that context, so the only impurity that can enter is whatever your application-supplied effects do. Supply pure effects, and evaluation is pure end to end - the same context always produces the same result.

## Evaluation turns the context into an outcome

So a request arrives and the context is assembled. Then what? At a high level, Forge evaluates a request in four parts:

- **Context:** gather what arrived with the request, and load anything else the definition needs.
- **Answers:** prepare saved, submitted, and default values into the state the journey can read.
- **Decisions:** evaluate validation, visibility, reachability, submission behaviour, and clearing.
- **Outcome:** render a page, redirect somewhere else, or return an error.

These parts build on one another. A value added to the context can become an answer, an answer can affect a decision, and a decision can change the final outcome.

## Your application code still does the real work

At this point you might be wondering where your code went. The definition describes a great deal, but somebody still has to load records, check permissions, call APIs, and persist data - and Forge doesn't know how to do any of that. Those operations belong to functions your application supplies.

The definition refers to that work without containing it. It says when a function should run and which values it should receive. Your application owns what the function does and how it interacts with the outside world. Loading a saved application or checking a permission is your function - the definition only says when it runs.

This split is deliberate, and it cuts both ways. The description stays inspectable - you can read what the service does without wading through how each operation is implemented. And your functions still get to load and change the very context Forge evaluates the request in, so the definition can depend on anything your application knows.

## The definition is the service model, written down

Stepping back we can see what the definition holds: the service's content, the state that content depends on, the changes an interaction can produce, and the transitions between responses. That's the service model authored as one artefact instead of inferred from many files.

It also answers objections about drift. The runtime evaluates the same model the author reads, so the description can't fall out of date with the behaviour - it's what produces the behaviour. That's the precise sense in which Forge is declarative: **the definition doesn't configure code written somewhere else - it is the authored form of the service, and it's what Forge evaluates.**

## What's next

You've seen what a definition is made of and how Forge turns one into request behaviour. The next two pages show what definitions look like in practice: **Building pages** covers independent pages that share a context, and **Building flows** covers steps that connect through validation, answers, and transitions.
