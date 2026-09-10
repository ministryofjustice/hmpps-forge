import type { ForgeError, ForgeOutcome, ForgeRenderer, HttpMethod } from '@ministryofjustice/hmpps-forge/core/framework'
import BrowserNavigationUrl from './BrowserNavigationUrl'
import BrowserRouteResolver from './BrowserRouteResolver'
import type { ResolvedBrowserRoute } from './BrowserRouteResolver'
import BrowserSnapshotFactory from './BrowserSnapshotFactory'
import BrowserSession from './BrowserSession'
import type {
  BrowserForge,
  BrowserHost,
  BrowserInteraction,
  BrowserScrollPosition,
  BrowserScrollTarget,
  ForgeContainer,
} from './types'

export interface BrowserForgeAppOptions {
  readonly adapterDependencies?: object
  readonly renderer: ForgeRenderer<string>
  readonly container: ForgeContainer
  readonly host: BrowserHost
  /** @default BrowserSession.create() - in-memory only */
  readonly session?: BrowserSession
  /** Owns committing successful HTML and initializing its browser behaviour. */
  readonly onRender: (event: BrowserRenderEvent) => Promise<void> | void
  /** Owns reporting the failure and committing the application's error UI. */
  readonly onError: (event: BrowserErrorEvent) => Promise<void> | void

}

export interface BrowserRenderEvent {
  readonly html: string
  readonly container: ForgeContainer
}

export interface BrowserErrorEvent {
  readonly error: ForgeError
  readonly container: ForgeContainer
}

export interface BrowserForgeAppStartOptions {
  /** Rendered when the current URL does not match a mounted route - the journey's entry step, typically. */
  readonly fallbackPath?: string
}

interface DispatchRequest {
  readonly method: HttpMethod
  readonly navigationUrl: BrowserNavigationUrl
  readonly body?: Record<string, unknown>
  readonly historyMode: 'push' | 'replace' | 'none'
  readonly scrollMode: 'preserve' | 'reset' | 'restore'
  readonly scrollPosition?: BrowserScrollPosition
  readonly onUnmatched: 'assign' | 'error'
}

interface DispatchState {
  readonly method: HttpMethod
  readonly navigationUrl: BrowserNavigationUrl
  readonly body?: Record<string, unknown>
}

interface DispatchCycle {
  readonly request: DispatchRequest
  readonly state: DispatchState
  readonly isCurrent: () => boolean
}

interface ViewCommitContext {
  readonly navigationUrl: BrowserNavigationUrl
  readonly request: DispatchRequest
  readonly isCurrent: () => boolean
}

interface ScheduledDispatch {
  readonly id: number
  readonly request: DispatchRequest
  readonly done: Promise<void>
  readonly complete: () => void
  readonly fail: (error: unknown) => void
}

type CommittableForgeOutcome = Exclude<ForgeOutcome<unknown>, { readonly kind: 'navigate' }>

const MAX_REDIRECTS = 10

/**
 * Runs mounted Forge journeys entirely client-side: intercepted submits and
 * link clicks become engine requests, and outcomes flow to the application's
 * browser handlers - no server round-trips. The express adapter's request loop,
 * re-homed onto the history API.
 */
export default class BrowserForgeApp {
  private readonly adapterDependencies?: object

  private readonly renderer: ForgeRenderer<string>

  private readonly container: ForgeContainer

  private readonly host: BrowserHost

  private readonly session: BrowserSession

  private readonly onRender: (event: BrowserRenderEvent) => Promise<void> | void

  private readonly onError: (event: BrowserErrorEvent) => Promise<void> | void

  private nextDispatchId = 0

  private latestDispatchId = 0

  private activeDispatch: ScheduledDispatch | undefined

  private pendingDispatch: ScheduledDispatch | undefined

  private unsubscribe: (() => void) | undefined

  constructor(
    private readonly forge: BrowserForge,
    options: BrowserForgeAppOptions,
  ) {
    if (typeof options.onRender !== 'function') {
      throw new Error('BrowserForgeApp requires an onRender handler')
    }

    if (typeof options.onError !== 'function') {
      throw new Error('BrowserForgeApp requires an onError handler')
    }

    this.adapterDependencies = options.adapterDependencies
    this.renderer = options.renderer
    this.container = options.container
    this.host = options.host
    this.session = options.session ?? BrowserSession.create()
    this.onRender = options.onRender
    this.onError = options.onError
  }

  /** Subscribe to interactions and render the current URL (or the fallback when it matches no route). */
  async start(options: BrowserForgeAppStartOptions = {}): Promise<void> {
    if (this.unsubscribe) {
      return
    }

    const initialUrl = this.currentNavigationUrl()
    let navigationUrl: BrowserNavigationUrl | undefined

    try {
      const resolved = this.resolveMountedRoute(initialUrl, 'GET')

      navigationUrl = this.resolveInitialNavigationUrl(initialUrl, resolved, options.fallbackPath)
    } catch (error) {
      await this.commitError(toError(error))

      return
    }

    if (!navigationUrl) {
      return
    }

    this.unsubscribe = this.host.subscribe(interaction => {
      this.handleInteraction(interaction).catch(() => undefined)
    })

    await this.scheduleDispatch({
      method: 'GET',
      navigationUrl,
      historyMode: 'replace',
      scrollMode: 'preserve',
      onUnmatched: 'error',
    })
  }

  async navigate(url: string): Promise<void> {
    const navigationUrl = this.resolveNavigationUrl(url)

    if (!navigationUrl) {
      return
    }

    await this.scheduleDispatch({
      method: 'GET',
      navigationUrl,
      historyMode: 'push',
      scrollMode: 'reset',
      onUnmatched: 'assign',
    })
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
    this.latestDispatchId = ++this.nextDispatchId
    this.pendingDispatch?.complete()
    this.pendingDispatch = undefined
  }

  getSession(): BrowserSession {
    return this.session
  }

  private async handleInteraction(interaction: BrowserInteraction): Promise<void> {
    const navigationUrl = this.resolveNavigationUrl(interaction.url)

    if (!navigationUrl) {
      return
    }

    if (interaction.kind === 'submit') {
      await this.scheduleDispatch({
        method: 'POST',
        navigationUrl,
        body: interaction.body,
        historyMode: 'push',
        scrollMode: 'reset',
        onUnmatched: 'assign',
      })

      return
    }

    if (interaction.kind === 'follow') {
      await this.scheduleDispatch({
        method: 'GET',
        navigationUrl,
        historyMode: 'push',
        scrollMode: 'reset',
        onUnmatched: 'assign',
      })

      return
    }

    await this.scheduleDispatch({
      method: 'GET',
      navigationUrl,
      historyMode: 'none',
      scrollMode: 'restore',
      scrollPosition: interaction.scrollPosition,
      onUnmatched: 'assign',
    })
  }

  /**
   * Serialize engine work because every snapshot shares one mutable browser
   * session. Repeated submissions join the active submission; newer links and
   * history restores replace the pending navigation and invalidate its visual
   * commit without trying to undo effects that have already started.
   */
  private scheduleDispatch(request: DispatchRequest): Promise<void> {
    const activeSubmission = this.getActiveSubmission(request)

    if (activeSubmission) {
      return activeSubmission.done
    }

    const scheduledDispatch = this.createScheduledDispatch(request)

    this.latestDispatchId = scheduledDispatch.id

    if (this.activeDispatch) {
      this.pendingDispatch?.complete()
      this.pendingDispatch = scheduledDispatch

      return scheduledDispatch.done
    }

    this.runDispatchLoop(scheduledDispatch).catch(error => scheduledDispatch.fail(error))

    return scheduledDispatch.done
  }

  private getActiveSubmission(request: DispatchRequest): ScheduledDispatch | undefined {
    if (request.method !== 'POST' || this.activeDispatch?.request.method !== 'POST') {
      return undefined
    }

    return this.activeDispatch
  }

  private createScheduledDispatch(request: DispatchRequest): ScheduledDispatch {
    let complete = () => {}
    let fail = (_error: unknown) => {}
    const done = new Promise<void>((resolve, reject) => {
      complete = resolve
      fail = reject
    })

    return { id: ++this.nextDispatchId, request, done, complete, fail }
  }

  private async runDispatchLoop(initialDispatch: ScheduledDispatch): Promise<void> {
    let scheduledDispatch: ScheduledDispatch | undefined = initialDispatch

    while (scheduledDispatch) {
      this.activeDispatch = scheduledDispatch
      await this.executeScheduledDispatch(scheduledDispatch)
      scheduledDispatch = this.pendingDispatch
      this.pendingDispatch = undefined
    }

    this.activeDispatch = undefined
  }

  private async executeScheduledDispatch(scheduledDispatch: ScheduledDispatch): Promise<void> {
    try {
      await this.dispatch(scheduledDispatch.request, () => this.latestDispatchId === scheduledDispatch.id)
      scheduledDispatch.complete()
    } catch (error) {
      const failure = toError(error)

      if (this.latestDispatchId === scheduledDispatch.id) {
        try {
          await this.commitError(failure, {
            navigationUrl: scheduledDispatch.request.navigationUrl,
            request: scheduledDispatch.request,
            isCurrent: () => this.latestDispatchId === scheduledDispatch.id,
          })
        } catch (handlerError) {
          scheduledDispatch.fail(toError(handlerError))

          return
        }

        scheduledDispatch.complete()

        return
      }

      scheduledDispatch.fail(failure)
    }
  }

  private async dispatch(request: DispatchRequest, isCurrent: () => boolean): Promise<void> {
    let dispatchState: DispatchState | undefined = request

    for (let cycle = 0; cycle < MAX_REDIRECTS; cycle += 1) {
      dispatchState = await this.executeDispatchCycle({ request, state: dispatchState, isCurrent })

      if (!dispatchState) {
        return
      }
    }

    if (isCurrent()) {
      throw new Error(
        `Redirect limit (${MAX_REDIRECTS}) reached while navigating to ${request.navigationUrl.toRelativeUrl()}`,
      )
    }
  }

  private async executeDispatchCycle(dispatchCycle: DispatchCycle): Promise<DispatchState | undefined> {
    if (!dispatchCycle.isCurrent()) {
      return undefined
    }

    const resolved = this.resolveMountedRoute(dispatchCycle.state.navigationUrl, dispatchCycle.state.method)

    if (!dispatchCycle.isCurrent()) {
      return undefined
    }

    if (!resolved) {
      this.commitUnmatched(dispatchCycle.state.navigationUrl, dispatchCycle.request)

      return undefined
    }

    return this.executeResolvedRoute(dispatchCycle, resolved)
  }

  private async executeResolvedRoute(
    dispatchCycle: DispatchCycle,
    resolved: ResolvedBrowserRoute,
  ): Promise<DispatchState | undefined> {
    const outcome = await this.executeForge(dispatchCycle.state, resolved)

    if (!dispatchCycle.isCurrent()) {
      return undefined
    }

    if (outcome.kind === 'navigate') {
      const navigationUrl = this.resolveNavigationUrl(outcome.url)

      return navigationUrl ? { method: 'GET', navigationUrl } : undefined
    }

    this.commitUrl(dispatchCycle.state.navigationUrl, dispatchCycle.request.historyMode)
    await this.commitOutcome(outcome, dispatchCycle.state.navigationUrl, dispatchCycle.request, dispatchCycle.isCurrent)

    return undefined
  }

  private async executeForge(
    dispatchState: DispatchState,
    resolved: ResolvedBrowserRoute,
  ): Promise<ForgeOutcome<unknown>> {
    const snapshot = BrowserSnapshotFactory.create({
      method: dispatchState.method,
      url: dispatchState.navigationUrl.toRelativeUrl(),
      resolved,
      location: this.host.getLocation(),
      body: dispatchState.body,
      session: this.session.getState(),
    })

    const outcome = await this.forge.execute({
      snapshot,
      renderer: this.renderer,
      adapterDependencies: this.adapterDependencies,
    })

    this.session.persist()

    return outcome
  }

  private async commitOutcome(
    outcome: CommittableForgeOutcome,
    navigationUrl: BrowserNavigationUrl,
    request: DispatchRequest,
    isCurrent: () => boolean,
  ): Promise<void> {
    if (outcome.kind === 'render') {
      await this.commitRender(outcome.output, navigationUrl, request, isCurrent)

      return
    }

    throw outcome.error
  }

  private resolveMountedRoute(
    navigationUrl: BrowserNavigationUrl,
    method: HttpMethod,
  ): ResolvedBrowserRoute | undefined {
    return BrowserRouteResolver.resolve(navigationUrl.toRelativeUrl(), method, this.forge.getTopology())
  }

  private commitUnmatched(navigationUrl: BrowserNavigationUrl, request: DispatchRequest): void {
    if (request.onUnmatched === 'assign') {
      this.host.assign(navigationUrl.toRelativeUrl())

      return
    }

    throw new Error(`No mounted route matches "${navigationUrl.toRelativeUrl()}"`)
  }

  private commitUrl(navigationUrl: BrowserNavigationUrl, historyMode: DispatchRequest['historyMode']): void {
    if (historyMode === 'none') {
      return
    }

    if (historyMode === 'push') {
      this.host.pushUrl(navigationUrl.toRelativeUrl())
    } else {
      this.host.replaceUrl(navigationUrl.toRelativeUrl())
    }
  }

  private async commitRender(
    output: unknown,
    navigationUrl: BrowserNavigationUrl,
    request: DispatchRequest,
    isCurrent: () => boolean,
  ): Promise<void> {
    if (!isCurrent()) {
      return
    }

    if (typeof output !== 'string') {
      throw new Error('Render outcome produced no output - renderer not bound')
    }

    await this.commitView(() => this.onRender({ html: output, container: this.container }), {
      navigationUrl,
      request,
      isCurrent,
    })
  }

  private async commitError(error: ForgeError, context?: ViewCommitContext): Promise<void> {
    await this.commitView(() => this.onError({ error, container: this.container }), context)
  }

  private async commitView(commit: () => Promise<void> | void, context?: ViewCommitContext): Promise<void> {
    if (context && !context.isCurrent()) {
      return
    }

    const update = async () => {
      if (context && !context.isCurrent()) {
        return
      }

      await commit()

      if (context) {
        this.scrollAfterRender(context.navigationUrl, context.request)
      }
    }

    if (this.host.updateView) {
      await this.host.updateView(update)

      return
    }

    await update()
  }

  private currentNavigationUrl(): BrowserNavigationUrl {
    return BrowserNavigationUrl.fromLocation(this.host.getLocation().href)
  }

  private resolveInitialNavigationUrl(
    initialUrl: BrowserNavigationUrl,
    resolved: ResolvedBrowserRoute | undefined,
    fallbackPath: string | undefined,
  ): BrowserNavigationUrl | undefined {
    if (resolved) {
      return initialUrl
    }

    if (fallbackPath !== undefined) {
      return this.resolveNavigationUrl(fallbackPath)
    }

    throw new Error(`No mounted route matches "${initialUrl.toRelativeUrl()}" and no fallbackPath was supplied`)
  }

  private resolveNavigationUrl(value: string): BrowserNavigationUrl | undefined {
    const currentUrl = this.currentNavigationUrl()
    const navigationUrl = BrowserNavigationUrl.resolve(value, currentUrl.toAbsoluteUrl())

    if (!navigationUrl.isSameOrigin(currentUrl.getOrigin())) {
      this.host.assign(navigationUrl.toAbsoluteUrl())

      return undefined
    }

    return navigationUrl
  }

  private scrollAfterRender(navigationUrl: BrowserNavigationUrl, request: DispatchRequest): void {
    const scrollTarget = this.resolveScrollTarget(navigationUrl, request)

    if (!scrollTarget) {
      return
    }

    this.host.scrollTo?.(scrollTarget)
  }

  private resolveScrollTarget(
    navigationUrl: BrowserNavigationUrl,
    request: DispatchRequest,
  ): BrowserScrollTarget | undefined {
    if (request.scrollMode === 'restore' && request.scrollPosition) {
      return { kind: 'position', position: request.scrollPosition }
    }

    const fragment = navigationUrl.getFragment()

    if (fragment) {
      return { kind: 'fragment', fragment }
    }

    if (request.scrollMode === 'preserve') {
      return undefined
    }

    return { kind: 'position', position: { x: 0, y: 0 } }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}
