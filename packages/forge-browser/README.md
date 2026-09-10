# Forge in the browser

The browser adapter runs registered Forge journeys in a page. Form submissions and
links become request snapshots; Forge returns render, navigation, or error outcomes.
Use the same journey definitions, components, validation, and effects as on the server,
with browser-compatible dependencies for any application services.

Forge compiles each package when `registerPackage()` is called. The host page's
Content Security Policy must allow `'unsafe-eval'` in `script-src` for that compilation.
Nunjucks templates are precompiled at build time and use its slim browser runtime.

## Precompile templates

Precompile the application's `.njk` templates in its build configuration using
[Nunjucks' precompilation API](https://mozilla.github.io/nunjucks/api.html#precompiling).
Include the templates supplied by any component libraries, preserving names used in
imports such as `govuk/components/input/macro.njk`.

Configure the application bundler to resolve `nunjucks` to
`nunjucks/browser/nunjucks-slim.js`.

Use Nunjucks' standard precompiled output, which registers templates on
`window.nunjucksPrecompiled`. For example, run this script from the application root
before bundling:

```javascript
import { mkdir, writeFile } from 'node:fs/promises'
import nunjucks from 'nunjucks'

const source = [
  nunjucks.precompile('src/templates', { include: [/\.njk$/] }),
  nunjucks.precompile('node_modules/govuk-frontend/dist', { include: [/\.njk$/] }),
].join('\n')

await mkdir('public/assets', { recursive: true })
await writeFile('public/assets/templates.js', source)
```

Load the templates before the application bundle:

```html
<div id="app"></div>
<script src="/assets/templates.js"></script>
<script type="module" src="/assets/app.js"></script>
```

The GOV.UK directory above preserves names beginning with `govuk/`. Include other
component libraries in the same way, keeping template names unique across directories.
Run the script again when templates change, or add it to the application's watch task.

## Start a browser application

Create a Nunjucks environment and pass it to `NunjucksBrowserRenderer`. The renderer
configures relative loading for precompiled templates and supplies the environment
for component rendering. The browser adapter assembles and injects those dependencies
when it executes Forge.

```javascript
import nunjucks from 'nunjucks'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import {
  createBrowserApp,
  NunjucksBrowserRenderer,
} from '@ministryofjustice/hmpps-forge/browser'
import { myPackage } from './journey'

const container = document.getElementById('app')

if (!container) {
  throw new Error('The browser application needs an app container')
}

const templateEnv = new nunjucks.Environment(undefined, { autoescape: true })

const forge = new Forge({ logger: console }).registerPackage(myPackage)
const app = createBrowserApp(forge, {
  container,
  renderingEngine: new NunjucksBrowserRenderer({ templateEnv }),
  onRender: ({ html }) => {
    container.innerHTML = html
    // Initialize the application's component behaviour here.
  },
  onError: ({ error }) => {
    console.error(error)
    container.innerHTML = templateEnv.render('error.njk')
  },
})

await app.start({ fallbackPath: '/my-journey/start' })
```

Provide the page template `form-step.njk`, or set `defaultTemplate` on the renderer.
It receives the step, navigation, answers, errors, and the rendered `blocks` array.
Register any filters or globals required by your component library on `templateEnv`.
For GOV.UK components, call `registerForgeGovUKComponentsGlobals(templateEnv)` from
`@ministryofjustice/hmpps-forge/govuk-components` before starting the application.

Register packages before starting the app. If an application loads another package
with `import()`, call `forge.registerPackage()` before navigating into that package.
The adapter resolves each request against the engine's current topology.

## Hosting and navigation

Serve the application host page for every pathname mounted by its journeys so direct
links and reloads work. The adapter creates a `WindowBrowserHost` for the supplied
container by default. It handles POST forms, links, and browser
history within the container. Query strings and fragments are preserved. Back and
forward restore scroll positions; new navigation resets scrolling or follows a fragment.
External links and other native browser interactions retain their normal behaviour.

Both outcome handlers are required. They own the page markup, error presentation, and
component initialization. Same-document view transitions are used when available;
supply `host: new WindowBrowserHost({ container, viewTransitions: false })` to disable them. Call `app.stop()`
to unsubscribe when the containing application unmounts.

Engine requests are serialized because they share a session. Repeated pending submits
run once, and a superseded navigation cannot overwrite the latest page. The default session
persists effect-owned drafts to `sessionStorage` between reloads. Supply
`session: new BrowserSession({ storage, storageKey })` to choose another store or key.
If browser storage is unavailable, the session remains usable in memory.
