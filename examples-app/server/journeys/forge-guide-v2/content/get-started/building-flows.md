---
title: Building flows
slug: building-flows
section: get-started
path: get-started/building-flows
nav: Thinking with Forge
order: 4
description: How to connect steps with validation, answers, and transitions so the user moves through them in order
teaches: [fields-and-answers, validation, submission-hooks, conditional-navigation, reachability-enforcement]
prerequisites: [building-pages]
related:
  concept: how-forge-runs-a-request
  reference: [journey, step, block, field, submit]
---

# Building flows

Building pages showed one shape: independent pages that share a context but have no order between them. Many services need the other shape too: a form someone fills in step by step, where each step collects something that the next one depends on.

Let's build a short section of an application form: a question about whether the applicant has a partner, a page for their partner's details if they do, and a contact details page that everyone reaches.

## A field creates an answer the journey can use

The first step asks a question. In Forge, a question is a field: a block with a `code` that names the answer it collects.

```ts [[1, 7, "code: 'hasPartner'"], [2, 17, "Self().match(Condition.IsRequired())"]]
const hasPartnerStep = step({
  code: 'has-partner',
  path: '/partner',
  title: 'Do you have a partner?',
  blocks: [
    GovUKRadioInput({
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
    }),
    GovUKButton({ text: 'Continue' }),
  ],
})
```

The <s1>field code</s1> is the name of the answer. When someone selects "yes", that value is stored under the key `hasPartner`. Other parts of the definition can read it back with `Answer('hasPartner')`. That comes in a later section.

The <s2>validation rule</s2> protects the answer. `Self()` refers to the field's own value, and `Condition.IsRequired()` checks that it isn't empty. If someone submits the page without selecting an option, Forge re-renders the page with the error message. The step can't progress until validation passes.

## Submission connects one step to the next

A step with a field and a button is still just a page. What turns it into part of a flow is `onSubmission`, the hook that runs when the form is posted:

```ts [[2, 10, "validate: true"], [4, 13, "redirect({ goto: 'contact-details' })"]]
const hasPartnerStep = step({
  code: 'has-partner',
  path: '/partner',
  title: 'Do you have a partner?',
  blocks: [
    // ... radio field and button
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [VisitEffects.SaveAnswers()],
        next: [redirect({ goto: 'contact-details' })],
      },
    }),
  ],
})
```

When the form is posted, `submit()` runs the step's <s2>validation</s2>. If the field passes, it runs the effects (here, saving the answers) and follows the <s4>redirect</s4>. If validation fails, none of that happens. The page re-renders with error messages visible.

This is the construct that connects one step to the next. Without `onSubmission`, the steps would just be independent pages. With it, each step knows where the user goes after a valid submission.

## Earlier answers decide where the journey goes

The redirect above always sends the user to the contact details page. But the form has a branch: people who answered "yes" to the partner question should visit a partner details page first. That's a condition on the redirect:

```ts [[3, 15, "Answer('hasPartner').match(Condition.Equals('yes'))"], [4, 16, "goto: 'partner-details'"], [4, 18, "redirect({ goto: 'contact-details' })"]]
const hasPartnerStep = step({
  code: 'has-partner',
  path: '/partner',
  title: 'Do you have a partner?',
  blocks: [
    // ... radio field and button
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [VisitEffects.SaveAnswers()],
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
})
```

The <s3>answer reference</s3> reads the value the field collected. `Answer('hasPartner')` uses the same name as the field's `code`. That's the connection. The code creates the answer, and the reference reads it back by name.

Forge tries the redirects in order. The first one whose condition matches wins. An unconditional <s4>redirect</s4> at the end acts as a default. If none of the conditions above it matched, this one always does.

The partner details step is the branch target. It collects a name and continues to contact details:

```ts
const partnerDetailsStep = step({
  code: 'partner-details',
  path: '/partner-details',
  title: "Partner's name",
  blocks: [
    GovUKTextInput({
      code: 'partnerName',
      label: { text: "What is your partner's name?", isPageHeading: true },
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: "Enter your partner's name",
        }),
      ],
    }),
    GovUKButton({ text: 'Continue' }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [VisitEffects.SaveAnswers()],
        next: [redirect({ goto: 'contact-details' })],
      },
    }),
  ],
})
```

Both paths through the form lead to the same contact details step. The branch reconnects.

## Forge keeps the path honest

[Building pages](building-pages) used `disableReachabilityChecks: true` to tell Forge the steps had no order. A flow is the default. Leave that flag off, and Forge treats the steps as ordered.

Ordered means enforced. Forge walks the declared redirects to build a map of which steps are reachable from the entry points. If someone tries to skip ahead by typing a URL, Forge redirects them back to where they should be. If they go back and change "yes" to "no", the partner details step becomes unreachable and its answers are cleared automatically.

This is the same cascade the earlier page described: one state change rippling through the service at several levels. The difference is that you didn't have to write the cascade. The definition already declared which steps depend on which answers, and Forge derived the consequences.

## The definition describes the whole flow

Look at the definition from the outside in. Each step collects an answer, validates it, and declares where the user goes next. The answer from one step can gate the redirect to another, creating branches. Steps that fall off the reachable path are cleared.

Which questions are asked, what validates them, where each answer leads, and which steps exist for a given set of responses. All stated as facts in the definition.

## What's next

You've now seen both shapes Forge supports: independent pages that share a context, and flows where steps connect through validation, answers, and transitions. The pages ahead go deeper into the individual parts: how blocks and fields work, how the expression language connects values across the definition, and how your application code fits in.
