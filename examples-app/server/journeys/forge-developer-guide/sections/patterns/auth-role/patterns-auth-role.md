---
title: Require authentication / role
section: patterns
path: patterns/auth-role
teaches: [authentication, role-check, access-hook, guard-function, throwError]
prerequisites: [onAccess, session, redirect, throwError]
---

<p class="govuk-caption-xl">Patterns</p>

# Require authentication / role
A journey where some steps require the user to be authenticated and
others require a specific role. Unauthenticated users are redirected
to a login page. Users without the required role see a 403 error.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/auth-role" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Use this pattern when your journey needs to restrict access based on
who the user is or what they are allowed to do. Most GOV.UK services
require authentication, and many have role-based access within the
authenticated area.

It fits well when:

- Some or all steps need a logged-in user.
- Certain steps are only available to specific roles (admin, editor,
  manager).
- You want a consistent way to enforce access rules across a journey
  without repeating conditions in every step.

---

## What the pattern covers

The live demo simulates authentication with two preset roles. Following
the flow shows:

- **A login page** with two buttons that set different roles in the
  session.
- **A dashboard** protected by a reusable `requireAuth()` guard
  function that redirects unauthenticated users to the login page.
- **An admin panel** with a step-level access hook that composes the
  auth guard with a role check, returning a 403 error for non-admin
  users.
- **A logout button** that clears the session and redirects to login.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/auth-role/
├── /overview        → Pattern description and "Start" button
├── /login           → Pick a role: Admin or Viewer
├── /dashboard       → Protected by requireAuth(), shows user info
└── /admin-panel     → Protected by requireAuth() + admin role check
```

The login and overview steps are always accessible. The dashboard
redirects to login when no session user exists. The admin panel
composes two access hooks: the shared auth guard and a step-specific
role check.

---

## How it works

### A reusable guard function

Because access hooks are plain objects, you can wrap common checks
in a function and reuse them across steps:

```typescript
import { access, redirect, Condition, Session } from '@ministryofjustice/hmpps-forge/core/authoring'

export const requireAuth = () =>
  access({
    next: [
      redirect({
        when: Session('demoUser').not.match(Condition.IsRequired()),
        goto: 'login',
      }),
    ],
  })
```

Any step that needs authentication adds `requireAuth()` to its
`onAccess` array. If the session has no user, the redirect fires
and halts further processing.

### Protecting a step with authentication

The dashboard step uses the guard in its `onAccess` array:

```typescript
step({
  code: 'dashboard',
  path: '/dashboard',
  onAccess: [requireAuth()],
  // ...
})
```

When an unauthenticated user tries to visit the dashboard, the
guard redirects them to the login page. Once they log in (setting
`session.demoUser`), the guard passes and the step renders normally.

### Adding a role check

The admin panel composes the auth guard with a role-specific check.
Access hooks run in order, so the auth check executes first:

```typescript
step({
  code: 'admin-panel',
  path: '/admin-panel',
  onAccess: [
    requireAuth(),
    access({
      next: [
        throwError({
          when: Session('demoUser.role').not.match(Condition.Equals('admin')),
          status: 403,
          message: 'You do not have permission to access this page',
        }),
      ],
    }),
  ],
  // ...
})
```

If the user is not logged in, `requireAuth()` redirects before the
role check ever runs. If they are logged in but lack the admin role,
`throwError` returns a 403.

### Setting session state

The login page uses two submit hooks, one per button. Each calls an
effect that writes to the session:

```typescript
submit({
  when: Post('action').match(Condition.Equals('login-admin')),
  validate: false,
  onAlways: {
    effects: [PatternEffects.SimulateLogin('Demo Admin', 'admin')],
    next: [redirect({ goto: 'dashboard' })],
  },
})
```

The effect sets `session.demoUser = { name, role }`. Steps then read
this with `Session('demoUser.name')` and `Session('demoUser.role')`.

---

## Variations

- **Journey-level guard.** If every step in a journey needs the same
  access check, put the guard on the journey's `onAccess` instead of
  repeating it on each step. Steps that need additional checks (like
  a role requirement) add their own hooks on top.
- **Redirect instead of 403.** Replace `throwError` with a
  `redirect` to a custom "access denied" page within the journey.
  This keeps the user inside the flow and lets them switch roles or
  navigate back without hitting the browser's error page.
- **Multiple roles.** Use `Condition.Array.IsIn(['admin', 'editor'])`
  instead of `Condition.Equals('admin')` to allow more than one role.
- **Read-only mode.** Combine a role check with block `visibleWhen`
  conditions. Viewers see the page but edit buttons are hidden;
  editors see the full interface.
