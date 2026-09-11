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

Simulate logging in as an admin or viewer. Both can open the dashboard, but the
admin panel rejects viewers. The authentication guard redirects
visitors without a session identity to the login page.

Edit the files below and select **Run** to try your changes. The demo uses a
simulated identity in the preview session.

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
