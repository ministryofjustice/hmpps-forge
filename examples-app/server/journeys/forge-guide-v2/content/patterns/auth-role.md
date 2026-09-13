---
title: Require authentication / role
slug: auth-role
section: patterns
path: patterns/auth-role
nav: Access and permissions
order: 14
description: Simulate login and protect pages with authentication and role guards.
---

# Require authentication / role

Check whether someone is signed in before deciding which pages they can access.
This example has a dashboard for signed-in users and an admin page restricted to
one role.

## Try the pattern

1. Start the pattern and sign in as a viewer.
2. Open the admin page to see the permission error, then use **Back to the previous page**.
3. Sign out and sign in as an admin to open the same page successfully.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Authentication and roles
base: /assets/playground/auth-role/
entry: journey.ts
start: /auth-role/overview
---
journey.ts
effects.ts
overview.ts
login.ts
dashboard.ts
admin-panel.ts
:::

:::note
---
---
The role picker demonstrates the journey rules; it is not authentication.
Restarting the preview or reloading the guide page clears the simulated
identity.
:::

## How it works

`login.ts` uses an effect to put a simulated identity into the preview session.
`dashboard.ts` checks for that identity on access and redirects to login when it
is missing.

`admin-panel.ts` orders two access checks: first establish that someone is signed in,
then require the admin role. An unauthenticated visit can therefore lead to login,
while a signed-in viewer receives a 403 result. The page's content does not need
to implement its own error screen.

The browser adapter renders that error and offers a return link to the last
successfully rendered URL. Returning keeps the current preview session, so a
viewer can recover without restarting the demo.

## Adapting the pattern

In a service, obtain identity from your authentication integration and enforce access
to protected data and operations on the backend. For a page that everyone in the
example can read but only admins can edit, see
[Read-only mode](/forge-guide-v2/patterns/read-only-mode).
