import BrowserForgeApp, { BrowserForgeAppOptions } from './BrowserForgeApp'
import type { BrowserForge } from './types'

/**
 * Build a client-side app over a Forge instance with mounted journeys - the
 * browser sibling of `createExpressRouter`. Call `start()` on the result to
 * begin intercepting interactions and rendering.
 *
 * @example
 * ```typescript
 * const app = createBrowserApp(forge, {
 *   renderingEngine: new NunjucksBrowserRenderer({ templateEnv }),
 *   container,
 *   onRender: ({ html, container }) => {
 *     container.innerHTML = html
 *   },
 *   onError: ({ error, container }) => {
 *     console.error(error)
 *     container.innerHTML = templateEnv.render('error.njk')
 *   },
 * })
 *
 * await app.start({ fallbackPath: '/my-journey/first-step' })
 * ```
 */
export function createBrowserApp(forge: BrowserForge, options: BrowserForgeAppOptions): BrowserForgeApp {
  return new BrowserForgeApp(forge, options)
}
