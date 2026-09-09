---
title: Browser Adapter
section: packages
path: packages/forge-browser/overview
teaches: [forge-browser, createBrowserApp, NunjucksBrowserRenderer, Forge, registerPackage]
prerequisites: [packages, journey, step, block]
---

<p class="govuk-caption-xl">Browser Adapter</p>

# Browser Adapter

The browser adapter runs a Forge journey entirely client-side. The engine never knew about HTTP - it takes a
request snapshot and returns an outcome - so the browser is just another adapter. Form submits and link
clicks become engine requests, and outcomes commit straight to a container element. No server round-trips,
no duplicate validation logic: the same compiled functions the server runs, running in the page.

{{slot:toc}}

---

## The pieces

The package exports the browser siblings of the express adapter's parts:

- `createBrowserApp(forge, options)` builds the app - the sibling of `createExpressRouter`. It matches
  intercepted interactions against `forge.getTopology()`, builds a `RequestSnapshot` from the location and
  form data, and calls `forge.execute()`. A render outcome goes to the application's required `onRender` handler,
  a failure goes to its required `onError` handler, and navigation resolves against the route table and pushes
  a history entry.
- `WindowBrowserHost` is the window seam. It intercepts POST form submits and same-document link clicks
  inside the container, forwards back/forward navigation, and writes URLs through the history API. Modified
  clicks, downloads, external targets, and non-POST forms fall through to the browser untouched.
- `NunjucksBrowserRenderer` mirrors the express adapter's `NunjucksRenderer` - the same page assembly against the
  same component contract. Supply a `nunjucks-slim` environment backed by precompiled templates and no
  template compiler ships to the browser.
- `BrowserSession` owns the session object journey effects mutate. It persists to `sessionStorage` after
  every request, so drafts survive a reload with no server anywhere. Persistence is best-effort: blocked,
  full, or malformed storage falls back to the live in-memory session rather than breaking navigation.

## Prepare the browser application

Use the normal `Forge` engine and register each package before starting the application.
Forge compiles journeys at runtime, so the page's Content Security Policy must allow `'unsafe-eval'`.

Precompile the Nunjucks templates in the application's build configuration, load the generated
`window.nunjucksPrecompiled` output before creating the environment, and alias `nunjucks` to
`nunjucks/browser/nunjucks-slim.js` in the browser bundle. `NunjucksBrowserRenderer` installs its
precompiled loader on that environment to support relative template imports.

```typescript
import * as govukFrontend from 'govuk-frontend'
import nunjucks from 'nunjucks'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { createBrowserApp, NunjucksBrowserRenderer } from '@ministryofjustice/hmpps-forge/browser'
import { myPackage } from './journey'

const templateEnv = new nunjucks.Environment(undefined, { autoescape: true })
const forge = new Forge({ logger: console }).registerPackage(myPackage)
const container = document.getElementById('app')

const app = createBrowserApp(forge, {
  renderingEngine: new NunjucksBrowserRenderer({ templateEnv }),
  container,
  onRender: ({ html, container }) => {
    container.innerHTML = html
    govukFrontend.initAll({ scope: container })
  },
  onError: ({ error, container }) => {
    console.error(error)
    container.innerHTML = templateEnv.render('error.njk')
    govukFrontend.initAll({ scope: container })
  },
})

await app.start({ fallbackPath: '/my-journey/start' })
```

Forge Browser routes through the URL pathname. The server must return the application host page for every
pathname mounted by the client application. In Express, mount a wildcard GET route for the application base
path before the 404 handler.

Both outcome handlers are required because the application owns its browser presentation boundary. `onRender`
commits the renderer's finished HTML and initializes any client behaviour. `onError` receives the original
error so it can report it to application logging or telemetry before committing an application-owned error
page. A handler may return a promise; Forge Browser waits for it before applying navigation scrolling. Forge
Browser deliberately supplies no fallback error markup.

`WindowBrowserHost` automatically wraps render commits in a same-document view transition when the browser
supports `document.startViewTransition()`. Unsupported browsers commit immediately. Pass
`viewTransitions: false` to `WindowBrowserHost` to disable transitions explicitly. Both `onRender` and
`onError` run inside the visual update, so markup and its browser behaviour commit together before the browser
presents the new view.

Fragment links use normal history URLs such as `/my-journey/start#details`. Forge Browser preserves the
fragment while resolving the pathname, then scrolls to the matching element after the outcome handler has
committed. Links containing only a fragment remain native browser navigation.

Navigation scrolling follows browser page-navigation behaviour. A new navigation without a fragment starts
at the top, while back and forward navigation restores the position stored for that history entry. The
initial render preserves the browser's current position unless it has a fragment. Forge Browser does not
choose or focus application markup after rendering; applications that need page-specific focus management
can implement it in `onRender`.

Query strings are also preserved and exposed through Forge's request query context, including repeated keys.
`WindowBrowserHost` resolves root-relative, document-relative, query-only, and same-origin absolute links and
POST form actions against the current URL. External and protocol-relative links and form actions retain native
browser navigation or submission.

Engine executions are serialized because they share the browser session. Repeated submissions while a
submission is pending join that submission rather than running its effects twice. If a newer link or history
navigation arrives, only the latest pending navigation is retained; an execution whose result has been
superseded may finish its effects but cannot commit its URL, error, or HTML.

## What still works

Everything the engine gives a server-rendered journey applies to the browser one: validation with error
summaries, reachability guarding step order, answer cleardown when an earlier answer changes, effects
persisting drafts through the session. The [live application](/browser-demo/your-name) gives Forge the
whole page content area and runs all of it with the network tab empty.
