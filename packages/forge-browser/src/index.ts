/**
 * Browser adapter for Forge: run mounted journeys entirely client-side.
 *
 * Register packages with normal Forge and supply precompiled Nunjucks templates.
 * Forge compiles journeys in the browser, requiring CSP to allow 'unsafe-eval'.
 *
 * @example
 * ```typescript
 * import { Forge } from '@ministryofjustice/hmpps-forge/core'
 * import { createBrowserApp, NunjucksBrowserRenderer } from '@ministryofjustice/hmpps-forge/browser'
 * import { myPackage } from './journey'
 *
 * const forge = new Forge({ logger: console }).registerPackage(myPackage)
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
 * await app.start({ fallbackPath: '/my-journey/start' })
 * ```
 */
export { createBrowserApp } from './adapter/createBrowserApp'
export { default as BrowserForgeApp } from './adapter/BrowserForgeApp'
export type {
  BrowserErrorEvent,
  BrowserForgeAppOptions,
  BrowserForgeAppStartOptions,
  BrowserRenderEvent,
} from './adapter/BrowserForgeApp'
export { default as WindowBrowserHost } from './adapter/WindowBrowserHost'
export type { WindowBrowserHostOptions } from './adapter/WindowBrowserHost'
export { default as BrowserSession } from './adapter/BrowserSession'
export type { BrowserSessionOptions } from './adapter/BrowserSession'
export { default as BrowserRouteResolver } from './adapter/BrowserRouteResolver'
export type { ResolvedBrowserRoute } from './adapter/BrowserRouteResolver'
export { default as BrowserSnapshotFactory } from './adapter/BrowserSnapshotFactory'
export type { BrowserSnapshotInputs } from './adapter/BrowserSnapshotFactory'
export type {
  BrowserForge,
  BrowserHost,
  BrowserInteraction,
  BrowserLocationSnapshot,
  BrowserScrollPosition,
  BrowserScrollTarget,
  BrowserStorage,
  ForgeContainer,
} from './adapter/types'
export { default as NunjucksBrowserRenderer } from './renderer/nunjucks/NunjucksBrowserRenderer'
export type { NunjucksBrowserRendererOptions } from './renderer/nunjucks/NunjucksBrowserRenderer'
export type {
  BrowserTemplateEnvironment,
  TemplateBlock,
  TemplateContext,
  TemplateNavigationItem,
} from './renderer/nunjucks/types'
