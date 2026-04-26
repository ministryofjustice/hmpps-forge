---
title: Installing Forge
section: get-started
path: get-started/installing-forge
teaches: [installation, project-structure]
prerequisites: []
---

<p class="govuk-caption-xl">Get started</p>

# Installing Forge
Install the Forge npm package and set up the dependencies your
project needs.

{{slot:toc}}

---

## What you need

Before you start, make sure you have:

- **Node.js** version 20 or later
- **npm** (included with Node.js)
- A working knowledge of **TypeScript**

You do not need prior experience with Forge. These guides assume you
are setting it up for the first time.

---

## Install the package

Install Forge from npm:

```bash
npm install @ministryofjustice/hmpps-forge
```

Forge ships its own TypeScript types. You do not need a separate
`@types` package.

---

## Install peer dependencies

Forge connects to your web framework through a **framework adapter**.
This guide uses the provided Express and Nunjucks adapter. Install
these alongside Forge if your project does not already include them:

```bash
npm install express nunjucks express-session
```

If you are using TypeScript, you will also need the type definitions:

```bash
npm install --save-dev @types/express @types/nunjucks @types/express-session
```

---

## Project structure

A typical Forge project follows this layout:

```
my-service/
├── server/
│   ├── app.ts                  # Express application setup
│   ├── server.ts               # Server entry point
│   ├── views/
│   │   └── partials/
│   │       ├── layout.njk      # Base page layout
│   │       └── form-step.njk   # Forge step template
│   └── journeys/
│       └── my-journey/
│           ├── index.ts        # Forge package
│           └── journey.ts      # Journey definition
├── package.json
└── tsconfig.json
```

Journeys live under `server/journeys/`. Each journey has its own
directory containing a journey definition and a package file that
bundles it for registration with Forge.

Templates live under `server/views/`. Forge needs a step template
that renders each step. You will create this in the next guide.

---

## What is next

You now have Forge and its core dependencies installed. Continue to
[Install frontend libraries](install-frontend-libraries) to add the
GOV.UK and MOJ component packages that Forge renders with.
