---
title: Restricting access to a journey or step
slug: restricting-access-to-a-journey-or-step
section: how-to-guides
path: how-to-guides/restricting-access-to-a-journey-or-step
nav: Building journeys/Access and permissions
order: 1
description: Use application-supplied identity to protect a booking journey and reserve its approval page for managers
teaches: [access, access-control, request-state, role-checks, redirect, throw-error]
prerequisites: [journey, step, using-forge-with-express-and-nunjucks]
related:
  concept: how-forge-runs-a-request
  reference: access, request, redirect, throw-error
---

# Restricting access to a journey or step

A booking team shares a service, but everyone doesn't have the same responsibilities.
Staff can view bookings. Managers can approve them. Someone following an old link must
still meet those rules, even when the link skips the service's navigation.

We'll protect a booking journey using the identity our application supplies. Then we'll
add a second check to its approval page. Both checks apply to page visits and submissions.

## Map who can reach each page

Here's the result we're building toward:

| Identity supplied by the application | `/bookings/overview` | `/bookings/approval` |
|---|---|---|
| Nobody signed in | Redirect to `/sign-in` | Redirect to `/sign-in` |
| Signed in without `BOOKING_STAFF` | 403 error | 403 error |
| `BOOKING_STAFF` | Allow | 403 error |
| `BOOKING_STAFF` and `BOOKING_MANAGER` | Allow | Allow |

In this service, managers also need the staff role. We'll keep that shared requirement
on the journey, then add the manager requirement to the approval step.

These are access decisions. The journey's reachability rules still decide
whether an allowed user can visit a particular step at that point in the flow.

## Read the identity supplied by your application

Before adding a check, we need a trusted identity and its roles. Our application already
authenticates requests and supplies an `auth` value with this shape:

```json
{
  "userId": "staff-42",
  "roles": ["BOOKING_STAFF", "BOOKING_MANAGER"]
}
```

This is an example of authenticated state, not a value to copy into every request.
The application owns sign-in, identity validation and role assignment. When nobody is
signed in, it leaves `auth` absent.

With the Express adapter, our existing authentication middleware supplies `res.locals.auth`
before the Forge router runs. `Request.State()` reads it:

```typescript
import { Request } from '@ministryofjustice/hmpps-forge/core/authoring'

Request.State('auth.userId')
Request.State('auth.roles')
```

The adapter merges `app.locals`, `res.locals` and `req.state`, in that order.
Our application reserves `auth` for authenticated state across those sources.
A form field, query parameter or unverified header must never supply this identity.

We now have the two values our checks need. A missing `auth` value produces `undefined`
for both references, so the next section handles that case explicitly.

## Protect the whole booking journey

Let's add an access hook to the journey. Its first outcome redirects people who aren't signed in.
Its second outcome rejects users without the staff role.

```typescript [[1, 9, "onAccess:"], [2, 12, "redirect({"], [3, 16, "throwError({"]]
import { access, Condition, journey, redirect, Request, throwError } from '@ministryofjustice/hmpps-forge/core/authoring'
import { overviewStep } from './overviewStep'
import { approvalStep } from './approvalStep'

export const bookingJourney = journey({
  code: 'bookings',
  title: 'Bookings',
  path: '/bookings',
  onAccess: [
    access({
      next: [
        redirect({
          when: Request.State('auth.userId').not.match(Condition.IsRequired()),
          goto: '/sign-in',
        }),
        throwError({
          when: Request.State('auth.roles').nullish([]).not.match(Condition.Array.Contains('BOOKING_STAFF')),
          status: 403,
          message: 'You do not have permission to access bookings',
        }),
      ],
    }),
  ],
  steps: [overviewStep, approvalStep],
})
```

The <s1>journey's access hooks</s1> run for requests to every descendant step.
Here, `overviewStep` and `approvalStep` represent the booking pages. Their fields and
submission hooks are separate from the shared access check.

Outcomes run in order and stop at the first match. The <s2>sign-in redirect</s2> therefore
handles a missing identity before the <s3>permission error</s3> checks roles.
An authenticated user with no roles receives the 403 error because `nullish([])` supplies
an empty list.

When neither outcome matches, evaluation continues. A staff member can reach either page,
subject to its existing reachability rules. Someone without access cannot render either page
or run its submission hooks.

Our application serves `/sign-in` outside this protected journey. That gives the redirect a
destination which doesn't run the same check again. The application's error handling
presents the 403 response.

## Reserve the approval step for managers

The shared staff check is in place. The approval step's `onAccess` adds the manager requirement:

```typescript [[4, 1, "onAccess:"], [5, 5, "'BOOKING_MANAGER'"]]
onAccess: [
  access({
    next: [
      throwError({
        when: Request.State('auth.roles').nullish([]).not.match(Condition.Array.Contains('BOOKING_MANAGER')),
        status: 403,
        message: 'Only booking managers can approve bookings',
      }),
    ],
  }),
],
```

The <s4>step's access hook</s4> runs after the journey's hooks. Its <s5>manager check</s5>
adds a requirement to the staff check. It doesn't replace it.

A staff member now receives a 403 error for `/bookings/approval`. A manager with both
roles passes both checks. The overview page keeps its staff-only requirement.

For nested journeys, the order stays the same: outer journey, inner journeys, then step.
Place each shared requirement at the narrowest journey that contains all the pages it protects.

## Keep the checks ahead of loading and saving

A direct `GET` to the approval URL runs both checks. A direct `POST` runs them too,
even if the user never opens the page first.

Access hooks run before answer preparation and submission hooks. If either check returns
a redirect or error, the request ends before the approval step's submission effects run.
There is no need to repeat the same role check in `onSubmission`.

If the journey loads restricted booking data in another access hook, put that hook after
the shared check. Likewise, place manager-only loading after the approval step's check.

Keep that loading in a separate hook. Within one access hook, every `effects` entry runs
before its `next` outcomes. Putting loading beside a permission outcome therefore loads
the data before deciding whether to reject the request.

Our application supplies authenticated state for every request. The checks use those current
values, so removing the manager role blocks a later approval submission.
Hiding the approval link can help navigation, but the access hook enforces the rule when
someone uses the URL directly.

## Check visits and submissions against the same rules

The expected outcomes apply to both request methods:

| Request to `/bookings/approval` | Expected result |
|---|---|
| `GET` or `POST` with no identity | Redirect to `/sign-in` |
| `GET` or `POST` with an identity and no roles | 403 error from the journey check |
| `GET` or `POST` with only `BOOKING_MANAGER` | 403 error from the journey check |
| `GET` or `POST` with only `BOOKING_STAFF` | 403 error from the step check |
| `GET` or `POST` with both roles | Continue with normal step evaluation |

In journey tests, supply these identities through the client's `state` option.
For rejected submissions, also check that the approval service receives no call.
That checks the access boundary around saving, as well as the returned outcome.
See [Testing a journey](./testing-a-journey) for the harness setup.

These journey tests supply identity directly. Application integration tests cover the
middleware that authenticates it and places it in request state.

## Recap

- Read identity and roles from authenticated state supplied by your application.
- Put shared access checks on the journey and additional checks on individual steps.
- Order outcomes so a missing identity redirects before role checks return a 403 error.
- Keep the sign-in destination outside the protected journey.
- Access hooks run for both visits and submissions, before answer preparation and submission effects.
- Place restricted loading in later hooks, after the relevant permission check.
- Test direct visits, rejected submissions and successful access with the intended roles.

For the lifecycle behind these checks, continue to
[How Forge runs a request](../concepts/how-forge-runs-a-request).
