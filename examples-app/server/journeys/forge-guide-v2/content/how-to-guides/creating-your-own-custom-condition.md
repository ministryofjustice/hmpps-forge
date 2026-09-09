---
title: Creating your own custom condition
slug: creating-your-own-custom-condition
section: how-to-guides
path: how-to-guides/creating-your-own-custom-condition
nav: Extending Forge/Functions
order: 1
description: Create, use, and test a condition for an application-specific rule
teaches: [condition, custom-conditions, match, inputSchema, argumentsSchema, dependencies]
prerequisites: [field, validation, match, create-forge-package]
related:
  concept: how-expressions-work, packaging-journeys-into-an-app
  reference: condition
---

# Creating your own custom condition

Most rules we check are ones everyone checks. Is the value filled in? Is it a valid date? Is it too long? The built-in conditions cover these everyday checks, and they'll get you a long way.
Sooner or later though, your application will have a rule that's entirely its own.

Built-in conditions can't cover rules specific to your service - a membership number, a case reference, a postcode format only your application
uses - so conditions are yours to define too. We can give the rule a name, write it as a custom condition, and use
it with `.match()` just like the built-in ones.

In this guide, we'll create a custom condition for a library membership number. In this library, a valid number
starts with `LIB-` and ends with six digits, such as `LIB-123456`.  Let's start!

## Start with the rule your page needs

Imagine you are building the page where somebody enters their library membership number.
You can already make the field required:

```typescript
const membershipNumberStep = step({
  path: '/membership-number',
  title: 'Library membership number',
  blocks: [
    GovUKTextInput({
      code: 'membershipNumber',
      label: {
        text: 'What is your library membership number?',
        isPageHeading: true,
      },
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: 'Enter your library membership number',
        }),
      ],
    }),
    GovUKButton({ text: 'Continue' }),
  ],
})
```

That gets the page partway there. It catches an empty answer, but any non-empty text still
passes. `LIBRARY`, for example, is present, but it is not a membership number.

What the page really needs to ask is: "Is this a valid library membership number?"
Let's turn that question into a condition.

## Create the condition

Here is the condition:

```typescript [[1, 3, "condition('Library.IsValidMembershipNumber'"], [2, 4, "value: unknown"], [1, 5, "return typeof value === 'string'"], [1, 5, "/^LIB-\\d{6}$/.test(value)"]]
import { condition } from '@ministryofjustice/hmpps-forge/core/authoring'

const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  factory: () => (value: unknown) => {
    return typeof value === 'string' && /^LIB-\d{6}$/.test(value)
  },
})
```

The <s1>`condition()` call</s1> gives the function a name and creates an
`IsValidMembershipNumber` entry that the journey can use. When you use it in a journey
definition, it registers itself automatically - no registry or `functions` listing needed.

The <s2>`value`</s2> is the input this condition will test. The function checks whether it
matches the membership-number format and returns `true` or `false`.

## Use the condition in your field

Add the new condition to your field's validation:

```typescript [[3, 3, "Self().match(IsValidMembershipNumber())"]]
validWhen: [
  validation({
    condition: Self().match(IsValidMembershipNumber()),
    message: 'Enter a membership number in the format LIB-123456',
  }),
],
```

`Self()` refers to the current field value. When `.match()` is evaluated, that value is
passed into the <s3>custom condition</s3> as its <s2>`value`</s2> argument.

Try the examples from earlier: `LIB-123456` returns `true`, while empty text, `LIBRARY`,
or a number with the wrong number of digits returns `false` and shows the validation
message.

The validation now says exactly what you meant: the field must match
`IsValidMembershipNumber()`.

## Describe the value your condition accepts

At this point, the condition works. But the first version spends part of its logic
checking whether the value is a string. You can describe that once with an input schema
and leave the function to concentrate on the membership-number rule:

```typescript [[1, 3, "condition('Library.IsValidMembershipNumber'"], [4, 4, "inputSchema: z.string()"], [2, 5, "value: string"], [1, 5, "/^LIB-\\d{6}$/.test(value)"]]
import { z } from 'zod'

const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  inputSchema: z.string(),
  factory: () => (value: string) => /^LIB-\d{6}$/.test(value),
})
```

The <s4>input schema</s4> says that the condition accepts strings. If the value is absent
or has another shape, the condition returns `false` before your function runs. Your
function can now receive a string and focus on the interesting part of the check.

## Pass configuration to the condition

So far, every membership number uses the same format. Now imagine the archive library
uses a different one: standard numbers look like `LIB-123456`, while archive numbers look
like `ARCH-1234`.

You could create another condition, but both checks answer the same question. Instead,
let `IsValidMembershipNumber()` accept the membership type:

```typescript [[1, 8, "condition('Library.IsValidMembershipNumber'"], [5, 10, "argumentsSchema"], [2, 11, "value: string"], [6, 11, "membershipType: MembershipType"], [1, 12, "membershipNumberPatterns[membershipType].test(value)"]]
type MembershipType = 'standard' | 'archive'

const membershipNumberPatterns = {
  standard: /^LIB-\d{6}$/,
  archive: /^ARCH-\d{4}$/,
}

const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  inputSchema: z.string(),
  argumentsSchema: z.tuple([z.enum(['standard', 'archive'])]),
  factory: () => (value: string, membershipType: MembershipType) => {
    return membershipNumberPatterns[membershipType].test(value)
  },
})
```

Now choose the <s6>membership type</s6> when the field uses the condition:

```typescript [[3, 3, "IsValidMembershipNumber"], [6, 3, "'standard'"]]
validation({
  condition: Self().match(
    IsValidMembershipNumber('standard'),
  ),
  message: 'Enter a membership number in the format LIB-123456',
})
```

The field still supplies the <s2>`value`</s2> through `.match()`. The `'standard'`
argument is supplied by your definition and arrives next as `membershipType`. This lets
one condition apply the right rule for each kind of membership.

The <s5>arguments schema</s5> describes which membership types the condition accepts. If
the definition supplies another value, the invalid argument is reported instead of
running the condition with a type it does not understand.

## Use a dependency in your condition

The condition can tell whether a membership number has the right format. It cannot tell
whether the library actually issued that number, or whether the membership is still
active.

Suppose your application already has a membership service that can answer those
questions. Type the factory's `deps` parameter and use the service from the condition:

```typescript [[7, 4, "deps: { membershipService: MembershipService }"], [7, 5, "async"], [1, 6, "membershipNumberPatterns[membershipType].test(value)"], [7, 10, "deps.membershipService.isValid"], [2, 11, "value"], [6, 12, "membershipType"]]
const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  inputSchema: z.string(),
  argumentsSchema: z.tuple([z.enum(['standard', 'archive'])]),
  factory: (deps: { membershipService: MembershipService }) =>
    async (value: string, membershipType: MembershipType) => {
      if (!membershipNumberPatterns[membershipType].test(value)) {
        return false
      }

      return deps.membershipService.isValid(
        value,
        membershipType,
      )
    },
})
```

The <s7>`deps` object</s7> gives the condition access to the membership service. Because
the service call is asynchronous, the condition returns its result when that call
finishes. Evaluation waits for it before deciding whether the condition passed.

The format check still happens first. A malformed number returns `false` immediately;
only a well-formed number needs a service lookup.

The dependency is supplied when the application registers the package:

```typescript [[7, 2, "membershipService", 0]]
forge.registerPackage(libraryPackage, {
  membershipService: services.membershipService,
})
```

That completes the dependency wiring. The application still owns how membership records
are found, while the condition expresses the question the journey needs answered.

Adding the dependency does not change how the journey uses the condition:

```typescript
Self().match(
  IsValidMembershipNumber('standard'),
)
```

## See how the condition parts fit together

You have now used every part of a condition function. Its complete shape is:

```text [[7, 1, "deps"], [2, 1, "value"], [6, 1, "...arguments"]]
deps => (value, ...arguments) => boolean | Promise<boolean>
```

The outer function receives your application's <s7>dependencies</s7>. The inner function
receives the <s2>value being tested</s2>, followed by any <s6>configuration arguments</s6>.
It returns a boolean immediately or, when it calls an asynchronous service, a promise
containing one.

Simple conditions do not need to use every part of this shape. The first version of
`IsValidMembershipNumber()` ignored its dependencies, accepted no arguments, and
returned its result immediately.

Your condition is now ready to use. Before adding more rules, test a value that should
pass and one that should fail. [Testing a function](./testing-a-function) shows how to
test a condition directly.

## Recap

You now have a named membership-number rule that the rest of your definition can use
through `.match()`.

Let's recap the key points.

- Define custom conditions with `condition()` and give each one a name.
- Write each condition as a function that receives the matched value and returns a
  boolean.
- Use an `inputSchema` when the condition accepts a particular value shape.
- Pass arguments to a condition when the definition needs to configure the rule.
- Use injected dependencies when a condition needs an application service.
- Use the returned condition through `.match()`, just like a built-in condition.
