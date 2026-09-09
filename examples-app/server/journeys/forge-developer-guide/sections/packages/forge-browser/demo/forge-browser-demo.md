---
title: Live demo
section: packages
path: packages/forge-browser/demo
teaches: [forge-browser]
prerequisites: [forge-browser]
---

<p class="govuk-caption-xl">Browser Adapter</p>

# Live demo

The demo application runs entirely in your browser. Forge compiles its journeys at runtime and
renders them with precompiled Nunjucks templates. The page needs `'unsafe-eval'` in its Content
Security Policy for the Forge compiler. Validation, navigation, conditional fields, and session-draft
persistence all run client-side. Reload mid-journey to see the draft restored.

The browser app owns the complete main page rather than mounting Forge in a demo widget. Its package routes
use the normal History API, and the server only supplies the application shell when you load or refresh one
of those routes directly.

[Open the browser Forge application](/browser-demo/your-name){.govuk-button}
