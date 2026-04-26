---
title: Loading, saving and redirecting
section: building-journeys
path: building-journeys/loading-saving-and-redirecting
teaches: [access-patterns, submit-patterns, conditional-redirect, effects-only, reusable-guards, validate-and-continue, multiple-buttons, onValid, onInvalid, onAlways]
prerequisites: [access, submit, redirect, throwError, hook-execution]
---

<p class="govuk-caption-xl">Working with data</p>

# Loading, saving and redirecting

This page covers common patterns for each hook type: loading data
when a page opens, handling in-page actions, saving on submission,
and controlling where users go next. For how hooks execute and
compose, see [Hooks and lifecycle](hooks-and-lifecycle).

{{slot:toc}}

---

## Loading data

Use access hooks to load data before a page renders. The data is
then available to blocks and fields through `Data()` expressions.

### Loading on every request

A hook with effects but no `next` always continues. Use this for
data that the page needs to render:

```typescript
onAccess: [
  access({
    effects: [
      MyEffects.loadUserProfile(),
      MyEffects.loadReferenceData(),
    ],
  }),
]
```

### Loading and checking the result

Effects run before `next` outcomes within the same hook. Load data
and check conditions together:

```typescript
onAccess: [
  access({
    // Effect stores the `item` details using context.setData('item', item)
    effects: [MyEffects.loadItem(Params('itemId'))],
    next: [
      // Check if the item is undefined / doesn't exist
      throwError({
        when: Data('item').match(Condition.IsRequired()),
        status: 404,
        message: 'Item not found',
      }),
      // Check if the item has edit permissions
      throwError({
        when: Data('item.canEdit').match(Condition.Equals(false)),
        status: 403,
        message: 'You do not have permission to edit this item',
      }),
    ],
  }),
]
```

### Conditional loading

Use `when` to skip a hook entirely. When `when` evaluates to false,
effects and outcomes are both skipped:

```typescript
access({
  when: Query('type').not.match(
    Condition.Array.IsIn(['current', 'future', 'achieved']),
  ),
  next: [redirect({ goto: 'overview?type=current' })],
})
```

### Shared data at the journey level

A journey's `onAccess` hooks run for every step in that journey.
Use this for data that all steps need:

```typescript
const caseManagement = journey({
  code: 'case-management',
  path: '/case/:caseId',
  onAccess: [
    access({
      effects: [MyEffects.loadCaseData(Params('caseId'))],
      next: [
        redirect({
          when: Data('isReadOnly').match(Condition.Equals(true)),
          goto: '/overview',
        }),
      ],
    }),
  ],
  children: [goalsJourney, notesJourney],
  steps: [overviewStep],
})
```

Every step in `goalsJourney` and `notesJourney` inherits the case
data loading and the read-only guard. Steps can then add their own
access hooks for step-specific concerns.

### Reusable guard functions

Because hooks are plain objects, you can wrap common patterns in
functions and reuse them across steps and journeys:

```typescript
export const redirectIfReadOnly = () =>
  access({
    when: Data('isReadOnly').match(Condition.Equals(true)),
    next: [redirect({ goto: '/overview' })],
  })

export const requireItem = (goto: string) =>
  access({
    when: Data('item').not.match(Condition.IsRequired()),
    next: [redirect({ goto })],
  })
```

```typescript
onAccess: [
  redirectIfReadOnly(),
  requireItem('/items'),
  access({
    effects: [MyEffects.loadItemDetails(Params('itemId'))],
  }),
]
```

---

## In-page POST actions

Non-validating submit hooks handle interactions that stay on the
current step: address lookups, adding items to a collection, or
removing rows from a list.

### Lookup pattern

A secondary button triggers an effect that populates a field. The
primary button submits the form through a submit hook instead:

```typescript
step({
  blocks: [
    GovUKTextInput({ code: 'postcode', label: 'Postcode' }),

    GovUKButton({
      text: 'Find address',
      name: 'action',
      value: 'lookup',
      classes: 'govuk-button--secondary',
    }),

    GovUKSelect({
      code: 'address',
      label: 'Select an address',
      items: Data('addresses'),
    }),

    GovUKButton({ text: 'Continue', name: 'action', value: 'continue' }),
  ],

  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('lookup')),
      validate: false,
      onAlways: {
        effects: [MyEffects.lookupPostcode(Post('postcode'))],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [MyEffects.saveAddress()],
        next: [redirect({ goto: 'next-step' })],
      },
    }),
  ],
})
```

The "Find address" button triggers the lookup submit hook. The
"Continue" button skips that hook (no match) and triggers the
validating submit hook instead.

### Adding and removing collection items

A common pattern uses non-validating submit hooks to manage dynamic
lists:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('addItem')),
    validate: false,
    onAlways: {
      effects: [MyEffects.addItemToSession()],
    },
  }),
  submit({
    when: Post('action').match(Condition.String.StartsWith('remove_')),
    validate: false,
    onAlways: {
      effects: [MyEffects.removeItemFromSession()],
    },
  }),
]
```

---

## Saving and submitting

Submit hooks control what happens when a user submits a form:
whether to validate, what to save, and where to go next.

### Validate and continue

The most common pattern. Validate the form, save if valid, redirect:

```typescript
submit({
  validate: true,
  onValid: {
    effects: [MyEffects.saveAnswers()],
    next: [redirect({ goto: 'next-step' })],
  },
})
```

When validation fails and no `onInvalid` branch is defined, the step
re-renders with validation errors visible. This is the default
behaviour for most forms.

### Save without validation

For draft saves or actions that should proceed regardless of form
state, use `onAlways` without setting `validate`:

```typescript
submit({
  when: Post('action').match(Condition.Equals('saveDraft')),
  onAlways: {
    effects: [MyEffects.saveDraft()],
    next: [redirect({ goto: '/dashboard' })],
  },
})
```

### Multiple submit buttons

When a step has more than one submit button, use `when` to match
each one:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('addSteps')),
    validate: true,
    onValid: {
      effects: [MyEffects.createGoal()],
      next: [
        redirect({
          goto: Format('../%1/add-steps', Data('goalUuid')),
        }),
      ],
    },
  }),

  submit({
    when: Post('action').match(Condition.Equals('saveWithoutSteps')),
    validate: true,
    onValid: {
      effects: [MyEffects.createGoal()],
      next: [redirect({ goto: '../../plan/overview' })],
    },
  }),
]
```

### Handling invalid submissions

Use `onInvalid` when you need to run effects or navigate on validation
failure:

```typescript
submit({
  validate: true,
  onValid: {
    effects: [MyEffects.saveAnswers()],
    next: [redirect({ goto: 'next-step' })],
  },
  onInvalid: {
    effects: [MyEffects.logValidationFailure()],
    // No next: stays on the current step with errors visible
  },
})
```

When `onInvalid` is omitted entirely, the step re-renders with
validation errors. This is the most common approach, as it requires
no extra configuration.

### Using onAlways with validation

When `validate` is `true`, `onAlways` effects run before the
valid/invalid branch. Use this for work that should happen on every
submission regardless of the outcome, such as analytics or audit
events:

```typescript
submit({
  validate: true,
  onAlways: {
    effects: [MyEffects.sendAuditEvent()],
  },
  onValid: {
    effects: [MyEffects.saveAnswers()],
    next: [redirect({ goto: 'next-step' })],
  },
})
```

The execution order is: `onAlways` effects, then `onValid` effects,
then `onValid.next` outcomes. If `onAlways` also has a `next` array,
those outcomes are only evaluated when `validate` is `false`.

### Using effects to build dynamic redirects

Effects run before outcomes are evaluated. This means data set by an
effect is available in the `next` outcomes that follow:

```typescript
submit({
  validate: true,
  onValid: {
    // createGoal() calls an API and sets Data('goalUuid')
    effects: [MyEffects.createGoal()],
    // The redirect can reference the UUID the effect just set
    next: [
      redirect({
        goto: Format('goal/%1/add-steps', Data('goalUuid')),
      }),
    ],
  },
})
```

---

## Staying on the current step

To stay on the current step after submission, omit the `next` array
entirely:

```typescript
onInvalid: {
  effects: [MyEffects.logFailure()],
  // No next: re-renders the step
}
```

---

## Best practices

- **Include a fallback submit hook when using multiple buttons.** If
  every `submit()` has a `when` and none match, nothing happens. Add
  a final hook without `when` to handle unexpected submissions.
- **Keep submit intents focused.** Each POST action should do one
  thing: look up an address, add an item, remove a row.
- **Use `onAlways` for work that should happen regardless of
  validation.** Draft saves, audit events, and session cleanup belong
  in `onAlways` because they should run whether the form is valid or
  not.
- **Extract reusable guards into functions.** If multiple steps share
  the same permission check or redirect logic, wrap it in a function
  rather than duplicating the hook definition.
