---
title: Creating your own custom effect
slug: creating-your-own-custom-effect
section: how-to-guides
path: how-to-guides/creating-your-own-custom-effect
nav: Extending Forge/Functions
order: 2
description: Create, configure, and connect an effect for application-specific work
teaches: [effect, custom-effects, access-hooks, argumentsSchema, request-context, dependencies]
prerequisites: [journey, step, access, create-forge-package]
related:
  concept: packaging-journeys-into-an-app
  reference: effect, access
---

# Creating your own custom effect
Plenty of useful work happens around a page without ever appearing on it. Maybe we're
loading a case, saving an answer, or letting an audit service know somebody dropped by.

The journey definition describes *when* that work should happen - but only our application knows how to
actually do it. So we write that work ourselves as an *effect*: a named function a
journey can run from an access or submit hook.

In this how-to, we'll build an effect that records when somebody accesses a page. We'll
start with a deliberately humble console message, then make the effect configurable, use
information from the current request, and finally connect it to a real audit service.
Let's get building!

## Start with the page that needs the effect

Imagine a case journey with an overview page. The page renders happily, but our
application also needs to record whenever somebody accesses it:

```typescript
const overviewStep = step({
  path: '/overview',
  title: 'Case overview',
  blocks: [
    GovUKHeading({ text: 'Case overview', size: 'l' }),
  ],
})
```

For now, that effect will do the smallest visible thing possible: print a message to the
console.

## Create the effect

Here is the effect:

```typescript [[1, 6, "effect('Case.AuditPageAccess'"], [3, 7, "context: EffectFunctionContext"], [1, 8, "console.log('A person accessed a page')"]]
import {
  effect,
  EffectFunctionContext,
} from '@ministryofjustice/hmpps-forge/core/authoring'

const AuditPageAccess = effect('Case.AuditPageAccess', {
  factory: () => (context: EffectFunctionContext) => {
    console.log('A person accessed a page')
  },
})
```

The <s1>`effect()` call</s1> gives the function a name and creates an `AuditPageAccess`
entry that the journey can use. When you use it in a journey definition, it registers
itself automatically - no registry or `functions` listing needed.

An <s3>effect context</s3> is supplied whenever the effect runs. Our first version
doesn't need anything from the context just yet - we'll see what the context can do later in the guide.

For now, our simple console output is more than acceptable. It lets us see exactly when the effect runs
before any real service enters the picture.

## Run the effect when the page is accessed

Now for the fun part: attach an access hook to the overview step:

```typescript [[5, 4, "onAccess: ["], [5, 5, "access({"], [1, 6, "AuditPageAccess()"]]
const overviewStep = step({
  path: '/overview',
  title: 'Case overview',
  onAccess: [
    access({
      effects: [AuditPageAccess()],
    }),
  ],
  blocks: [
    GovUKHeading({ text: 'Case overview', size: 'l' }),
  ],
})
```

The <s5>step-level access hook</s5> runs the <s1>effect</s1> before the
overview page is evaluated. Visit the page, and there it is:

```text
A person accessed a page
```

Our effect is wired up and running! One thing worth knowing: access hooks run for both
`GET` and `POST` requests to the step, which suits us here - either way, the page was
accessed. Work that should only happen after a form submission belongs in a submit hook
instead.

There's just one problem with our message: it could have come from any page. Not much of
an audit trail yet! Let's teach the effect to say *which* page.

## Passing an argument to the effect

Add a page-name argument and describe it with an arguments schema:

```typescript [[1, 3, "effect('Case.AuditPageAccess'"], [6, 4, "argumentsSchema: z.tuple([z.string()])"], [3, 6, "_context: EffectFunctionContext"], [7, 7, "pageName: string"], [1, 9, "console.log"]]
import { z } from 'zod'

const AuditPageAccess = effect('Case.AuditPageAccess', {
  argumentsSchema: z.tuple([z.string()]),
  factory: () => (
    _context: EffectFunctionContext,
    pageName: string,
  ) => {
    console.log(`A person accessed ${pageName}`)
  },
})
```

The <s6>arguments schema</s6> says that definitions must supply one string. The
<s3>context</s3> is injected automatically; the <s7>page name</s7> comes after it because it's authored
where the effect is used.

Pass that name from the overview step:

```typescript [[1, 2, "AuditPageAccess"], [7, 2, "'Case overview'"]]
access({
  effects: [AuditPageAccess('Case overview')],
})
```

Visit the page again, and now the message knows where it came from:

```text
A person accessed Case overview
```

Any other step can use the same effect with its own name. The effect owns what recording
a page access *means*; each definition supplies the detail that varies.

The page name is configuration supplied by the definition. Effects can also use
information that belongs to the request currently running them.

## Use context in your effect

Let's make the console message say who accessed the page. For this example, we'll assume
the application stores the signed-in person's details in the session when they first
authenticate. That is application behaviour, not a Forge requirement: another
application might make those details available elsewhere.

Describe the session shape, then use it to type the effect context:

```typescript [[3, 6, "interface CaseSession"], [3, 10, "type CaseEffectContext = EffectFunctionContext"], [1, 16, "effect('Case.AuditPageAccess'"], [3, 19, "context: CaseEffectContext"], [7, 20, "pageName: string"], [3, 22, "context.getSession()"], [1, 28, "console.log"]]
interface SignedInUser {
  id: string
  displayName: string
}

interface CaseSession {
  user: SignedInUser
}

type CaseEffectContext = EffectFunctionContext<
  Record<string, unknown>,
  Record<string, unknown>,
  CaseSession
>

const AuditPageAccess = effect('Case.AuditPageAccess', {
  argumentsSchema: z.tuple([z.string()]),
  factory: () => (
    context: CaseEffectContext,
    pageName: string,
  ) => {
    const session = context.getSession()

    if (!session) {
      return
    }

    console.log(`${session.user.displayName} accessed ${pageName}`)
  },
})
```

The <s3>typed effect context</s3> makes `getSession()` return this application's
`CaseSession`. The first two type positions leave the effect's data and answers open;
the third describes its session. `getSession()` still returns `undefined` when a request has no
session, so the effect stops early in that case.

For a signed-in person named Alex Smith, visiting the overview page now prints:

```text
Alex Smith accessed Case overview
```

The <s7>page name</s7> still comes from the definition. The signed-in person comes from
the request that is running it. Other effects can use the same context to read answers,
loaded data, route parameters, or other request information.

The message now has everything our example needs, but a `console.log` is no audit trail.
Time to hand the work to the service our application already uses.

## Use a dependency in your effect

`AuditService` below is a deliberately small application interface. Adapt it to the
service your application already owns.

Describe the service, then type the factory's `deps` parameter:

```typescript [[8, 2, "recordPageAccess"], [8, 10, "deps: { auditService: AuditService }"], [8, 11, "async"], [3, 12, "context: CaseEffectContext"], [7, 13, "pageName: string"], [8, 21, "deps.auditService.recordPageAccess"]]
interface AuditService {
  recordPageAccess(event: {
    pageName: string
    user: SignedInUser
  }): Promise<void>
}

const AuditPageAccess = effect('Case.AuditPageAccess', {
  argumentsSchema: z.tuple([z.string()]),
  factory: (deps: { auditService: AuditService }) =>
    async (
      context: CaseEffectContext,
      pageName: string,
    ) => {
      const session = context.getSession()

      if (!session) {
        return
      }

      await deps.auditService.recordPageAccess({
        pageName,
        user: session.user,
      })
    },
})
```

The <s8>`deps` object</s8> gives the effect its audit service. It receives the page name
from the definition and the user from the request context, then awaits the service call.
The access hook waits for the effect to finish before it continues evaluating.

The dependency is supplied when the application registers the package:

```typescript [[8, 2, "auditService: services.auditService"]]
forge.registerPackage(casePackage, {
  auditService: services.auditService,
})
```

And that's the dependency wiring complete! The package describes what it needs; the
application chooses the service instance that does the real work.

Best of all, the journey itself doesn't change:

```typescript
access({
  effects: [AuditPageAccess('Case overview')],
})
```

It still reads as a simple statement of intent. The definition chooses a page name; only
the effect implementation knows how to combine it with the current request and record
the access.

## See how the effect parts fit together

We've now used every part of an effect function, so we've earned a look at its complete
shape:

```text [[8, 1, "deps"], [3, 1, "context"], [7, 1, "...arguments"]]
deps => (context, ...arguments) => void | Promise<void>
```

The outer function receives our application's <s8>dependencies</s8>. The inner function
receives the <s3>request context</s3>, followed by any
<s7>definition-supplied arguments</s7>. Dependencies are application services the effect
uses; context is information about this request; arguments are the configuration supplied
by the definition that invokes it. It completes immediately, or returns a promise when it
has asynchronous work to finish.

An effect doesn't need to use every part of this shape. Our first `AuditPageAccess()`
ignored its dependencies and context, accepted no arguments, and finished synchronously -
and that was fine! Add each part when the work gives you a reason to.

Auditing was only ever our running example: the same pieces apply to effects that load
data, save answers, send notifications, or call any other service your application
depends on. And when you're ready to check an effect in isolation,
[Testing a function](./testing-a-function) shows how to test one directly.

## Recap

We now have a custom effect that a page can invoke by name, configure with its page name,
use with the current request's signed-in person, and connect to the application's audit
service.

Let's recap the key points.

- Define custom effects with `effect()` and give each one a name.
- Write each effect as a function that receives an `EffectFunctionContext`.
- Run the returned effect from an access or submit hook.
- Pass arguments when the definition needs to configure the effect.
- Use an `argumentsSchema` to describe those authored arguments.
- Use `EffectFunctionContext` for information belonging to this request, such as a typed
  session.
- Use injected dependencies for application services the effect calls.
