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
then available to blocks and fields through `data()` expressions.

### Loading on every request

A hook with effects but no `next` always continues. Use this for
data that the page needs to render:

```rust
"onAccess": [
    access(obj! {
        "effects": [
            effect::call("loadUserProfile", vec![]),
            effect::call("loadReferenceData", vec![]),
        ],
    }),
],
```

### Loading and checking the result

Effects run before `next` outcomes within the same hook. Load data
and check conditions together:

```rust
"onAccess": [
    access(obj! {
        // Effect stores the `item` details using context.setData('item', item)
        "effects": [effect::call("loadItem", vec![params("itemId").into()])],
        "next": [
            // Check if the item is undefined / doesn't exist
            throw_error(obj! {
                "when": data("item").matches(condition::is_required()),
                "status": 404,
                "message": "Item not found",
            }),
            // Check if the item has edit permissions
            throw_error(obj! {
                "when": data("item.canEdit").matches(condition::equals(false)),
                "status": 403,
                "message": "You do not have permission to edit this item",
            }),
        ],
    }),
],
```

### Conditional loading

Use `when` to skip a hook entirely. When `when` evaluates to false,
effects and outcomes are both skipped:

```rust
access(obj! {
    "when": query("type").not().matches(condition::array::is_in(["current", "future", "achieved"])),
    "next": [redirect(obj! { "goto": "overview?type=current" })],
})
```

### Shared data at the journey level

A journey's `onAccess` hooks run for every step in that journey.
Use this for data that all steps need:

```rust
let case_management = journey(obj! {
    "code": "case-management",
    "path": "/case/:caseId",
    "onAccess": [
        access(obj! {
            "effects": [effect::call("loadCaseData", vec![params("caseId").into()])],
            "next": [
                redirect(obj! {
                    "when": data("isReadOnly").matches(condition::equals(true)),
                    "goto": "/overview",
                }),
            ],
        }),
    ],
    "children": [goals_journey, notes_journey],
    "steps": [overview_step],
});
```

Every step in `goalsJourney` and `notesJourney` inherits the case
data loading and the read-only guard. Steps can then add their own
access hooks for step-specific concerns.

### Reusable guard functions

Because hooks are plain objects, you can wrap common patterns in
functions and reuse them across steps and journeys:

```rust
pub fn redirect_if_read_only() -> Value {
    access(obj! {
        "when": data("isReadOnly").matches(condition::equals(true)),
        "next": [redirect(obj! { "goto": "/overview" })],
    })
}

pub fn require_item(goto: &str) -> Value {
    access(obj! {
        "when": data("item").not().matches(condition::is_required()),
        "next": [redirect(obj! { "goto": goto })],
    })
}
```

```rust
"onAccess": [
    redirect_if_read_only(),
    require_item("/items"),
    access(obj! {
        "effects": [effect::call("loadItemDetails", vec![params("itemId").into()])],
    }),
],
```

---

## In-page POST actions

Non-validating submit hooks handle interactions that stay on the
current step: address lookups, adding items to a collection, or
removing rows from a list.

### Lookup pattern

A secondary button triggers an effect that populates a field. The
primary button submits the form through a submit hook instead:

```rust
step(obj! {
    "blocks": [
        govuk::TEXT_INPUT.build(obj! { "code": "postcode", "label": "Postcode" }),
        govuk::BUTTON.build(obj! {
            "text": "Find address",
            "name": "action",
            "value": "lookup",
            "classes": "govuk-button--secondary",
        }),
        govuk::SELECT_INPUT.build(obj! {
            "code": "address",
            "label": "Select an address",
            "items": data("addresses"),
        }),
        govuk::BUTTON.build(obj! { "text": "Continue", "name": "action", "value": "continue" }),
    ],
    "onSubmission": [
        submit(obj! {
            "when": post("action").matches(condition::equals("lookup")),
            "validate": false,
            "onAlways": obj! {
                "effects": [effect::call("lookupPostcode", vec![post("postcode").into()])],
            },
        }),
        submit(obj! {
            "when": post("action").matches(condition::equals("continue")),
            "validate": true,
            "onValid": obj! {
                "effects": [effect::call("saveAddress", vec![])],
                "next": [redirect(obj! { "goto": "next-step" })],
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

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("addItem")),
        "validate": false,
        "onAlways": obj! {
            "effects": [effect::call("addItemToSession", vec![])],
        },
    }),
    submit(obj! {
        "when": post("action").matches(condition::string::starts_with("remove_")),
        "validate": false,
        "onAlways": obj! {
            "effects": [effect::call("removeItemFromSession", vec![])],
        },
    }),
],
```

---

## Saving and submitting

Submit hooks control what happens when a user submits a form:
whether to validate, what to save, and where to go next.

### Validate and continue

The most common pattern. Validate the form, save if valid, redirect:

```rust
submit(obj! {
    "validate": true,
    "onValid": obj! {
        "effects": [effect::call("saveAnswers", vec![])],
        "next": [redirect(obj! { "goto": "next-step" })],
    },
})
```

When validation fails and no `onInvalid` branch is defined, the step
re-renders with validation errors visible. This is the default
behaviour for most forms.

### Save without validation

For draft saves or actions that should proceed regardless of form
state, use `onAlways` without setting `validate`:

```rust
submit(obj! {
    "when": post("action").matches(condition::equals("saveDraft")),
    "onAlways": obj! {
        "effects": [effect::call("saveDraft", vec![])],
        "next": [redirect(obj! { "goto": "/dashboard" })],
    },
})
```

### Multiple submit buttons

When a step has more than one submit button, use `when` to match
each one:

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("addSteps")),
        "validate": true,
        "onValid": obj! {
            "effects": [effect::call("createGoal", vec![])],
            "next": [
                redirect(obj! {
                    "goto": format("../%1/add-steps", [data("goalUuid").into()]),
                }),
            ],
        },
    }),
    submit(obj! {
        "when": post("action").matches(condition::equals("saveWithoutSteps")),
        "validate": true,
        "onValid": obj! {
            "effects": [effect::call("createGoal", vec![])],
            "next": [redirect(obj! { "goto": "../../plan/overview" })],
        },
    }),
],
```

### Handling invalid submissions

Use `onInvalid` when you need to run effects or navigate on validation
failure:

```rust
submit(obj! {
    "validate": true,
    "onValid": obj! {
        "effects": [effect::call("saveAnswers", vec![])],
        "next": [redirect(obj! { "goto": "next-step" })],
    },
    "onInvalid": obj! {
        "effects": [effect::call("logValidationFailure", vec![])],
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

```rust
submit(obj! {
    "validate": true,
    "onAlways": obj! {
        "effects": [effect::call("sendAuditEvent", vec![])],
    },
    "onValid": obj! {
        "effects": [effect::call("saveAnswers", vec![])],
        "next": [redirect(obj! { "goto": "next-step" })],
    },
})
```

The execution order is: `onAlways` effects, then `onValid` effects,
then `onValid.next` outcomes. If `onAlways` also has a `next` array,
those outcomes are evaluated before validation runs - a matching
redirect or error there ends the hook, so validation and the
valid/invalid branches never run.

### Using effects to build dynamic redirects

Effects run before outcomes are evaluated. This means data set by an
effect is available in the `next` outcomes that follow:

```rust
submit(obj! {
    "validate": true,
    "onValid": obj! {
        // createGoal() calls an API and sets Data('goalUuid')
        "effects": [effect::call("createGoal", vec![])],
        // The redirect can reference the UUID the effect just set
        "next": [
            redirect(obj! {
                "goto": format("goal/%1/add-steps", [data("goalUuid").into()]),
            }),
        ],
    },
})
```

---

## Staying on the current step

To stay on the current step after submission, omit the `next` array
entirely:

```rust
"onInvalid": obj! {
    "effects": [effect::call("logFailure", vec![])],
    // No next: re-renders the step
},
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
