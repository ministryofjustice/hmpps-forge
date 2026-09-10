import BrowserNavigationUrl from './BrowserNavigationUrl'
import type {
  BrowserHost,
  BrowserInteraction,
  BrowserLocationSnapshot,
  BrowserScrollPosition,
  BrowserScrollTarget,
} from './types'

const HISTORY_STATE_KEY = '@ministryofjustice/hmpps-forge/browser'

// Structural DOM surface: the workspace typechecks without the DOM lib, so the
// host declares exactly what it touches and casts once at the window boundary.
interface DomEvent {
  readonly target: unknown
  readonly defaultPrevented: boolean
  readonly metaKey?: boolean
  readonly ctrlKey?: boolean
  readonly shiftKey?: boolean
  readonly altKey?: boolean
  readonly button?: number
  readonly state?: unknown
  readonly submitter?: unknown
  preventDefault(): void
}

interface DomEventSource {
  addEventListener(type: string, listener: (event: DomEvent) => void): void
  removeEventListener(type: string, listener: (event: DomEvent) => void): void
}

interface DomElement {
  getAttribute(name: string): string | null
  closest(selector: string): DomElement | null
}

interface DomWindow extends DomEventSource {
  readonly document: {
    startViewTransition?(update: () => Promise<void> | void): { readonly updateCallbackDone: Promise<void> }
    getElementById(id: string): { scrollIntoView(): void } | null
  }
  readonly location: { readonly href: string; assign(url: string): void }
  readonly history: {
    readonly state: unknown
    scrollRestoration: 'auto' | 'manual'
    pushState(data: unknown, unused: string, url?: string): void
    replaceState(data: unknown, unused: string, url?: string): void
  }
  readonly scrollX: number
  readonly scrollY: number
  scrollTo(x: number, y: number): void
}

interface BrowserHistoryState {
  readonly entryId: string
}

type FormDataFromForm = new (form: unknown, submitter?: unknown) => Iterable<[string, unknown]>

export interface WindowBrowserHostOptions {
  /** The element whose form submits and link clicks the adapter intercepts - usually the render container. */
  readonly container: DomEventSource
  /** Overridable for tests; defaults to the real window. */
  readonly window?: DomWindow
  /** Use same-document view transitions when the browser supports them. @default true */
  readonly viewTransitions?: boolean
}

/**
 * The real-window implementation of `BrowserHost`: intercepts POST form
 * submits and same-origin link clicks inside the container, forwards
 * back/forward navigation, and writes URLs through the history API. Modified
 * clicks, downloads, external targets, and non-POST forms fall through to the
 * browser untouched.
 */
export default class WindowBrowserHost implements BrowserHost {
  private static nextHistoryEntryId = 0

  private readonly container: DomEventSource

  private readonly domWindow: DomWindow

  private readonly viewTransitions: boolean

  private readonly listeners = new Set<(interaction: BrowserInteraction) => void>()

  private readonly scrollPositions = new Map<string, BrowserScrollPosition>()

  private currentHistoryEntryId: string | undefined

  private detachDomListeners: (() => void) | undefined

  constructor(options: WindowBrowserHostOptions) {
    this.container = options.container
    this.domWindow = options.window ?? (globalThis as unknown as DomWindow)
    this.viewTransitions = options.viewTransitions ?? true
  }

  getLocation(): BrowserLocationSnapshot {
    return { href: this.domWindow.location.href }
  }

  pushUrl(url: string): void {
    this.captureCurrentScrollPosition()

    const entryId = this.createHistoryEntryId()

    this.domWindow.history.pushState(this.withHistoryEntryId(undefined, entryId), '', url)
    this.currentHistoryEntryId = entryId
  }

  replaceUrl(url: string): void {
    const entryId = this.ensureCurrentHistoryEntryId()

    this.domWindow.history.replaceState(this.withHistoryEntryId(this.domWindow.history.state, entryId), '', url)
  }

  assign(url: string): void {
    this.domWindow.location.assign(url)
  }

  async updateView(update: () => Promise<void> | void): Promise<void> {
    if (!this.viewTransitions || !this.domWindow.document.startViewTransition) {
      await update()

      return
    }

    await this.domWindow.document.startViewTransition(update).updateCallbackDone
  }

  scrollTo(target: BrowserScrollTarget): void {
    if (target.kind === 'position') {
      this.domWindow.scrollTo(target.position.x, target.position.y)
      this.captureCurrentScrollPosition()

      return
    }

    const targetId = this.decodeFragment(target.fragment)
    const targetElement = this.domWindow.document.getElementById(targetId)

    if (targetElement) {
      targetElement.scrollIntoView()
    } else {
      this.domWindow.scrollTo(0, 0)
    }

    this.captureCurrentScrollPosition()
  }

  subscribe(listener: (interaction: BrowserInteraction) => void): () => void {
    this.listeners.add(listener)

    if (this.listeners.size === 1) {
      this.attachDomListeners()
    }

    return () => {
      this.listeners.delete(listener)

      if (this.listeners.size === 0) {
        this.detachDomListeners?.()
        this.detachDomListeners = undefined
      }
    }
  }

  private attachDomListeners(): void {
    const onSubmit = (event: DomEvent) => this.handleSubmit(event)
    const onClick = (event: DomEvent) => this.handleClick(event)
    const onHistory = (event: DomEvent) => {
      this.captureCurrentScrollPosition()

      const url = BrowserNavigationUrl.fromLocation(this.domWindow.location.href)
      const entryId = this.resolveHistoryEntryId(event.state)
      const scrollPosition = this.scrollPositions.get(entryId)

      this.currentHistoryEntryId = entryId

      if (scrollPosition) {
        this.emit({ kind: 'restore', url: url.toRelativeUrl(), scrollPosition })

        return
      }

      this.emit({ kind: 'restore', url: url.toRelativeUrl() })
    }

    const previousScrollRestoration = this.domWindow.history.scrollRestoration

    this.domWindow.history.scrollRestoration = 'manual'
    this.ensureCurrentHistoryEntryId()

    this.container.addEventListener('submit', onSubmit)
    this.container.addEventListener('click', onClick)
    this.domWindow.addEventListener('popstate', onHistory)

    this.detachDomListeners = () => {
      this.container.removeEventListener('submit', onSubmit)
      this.container.removeEventListener('click', onClick)
      this.domWindow.removeEventListener('popstate', onHistory)
      this.domWindow.history.scrollRestoration = previousScrollRestoration
    }
  }

  private handleSubmit(event: DomEvent): void {
    const form = event.target as DomElement | null
    const method = form?.getAttribute('method')?.toLowerCase() ?? 'get'
    const action = form?.getAttribute('action') ?? ''

    if (
      !form ||
      method !== 'post' ||
      event.defaultPrevented ||
      form.getAttribute('target') ||
      action.startsWith('//')
    ) {
      return
    }

    const navigationUrl = this.resolveSameOriginUrl(action || this.domWindow.location.href)

    if (!navigationUrl) {
      return
    }

    event.preventDefault()
    this.emit({
      kind: 'submit',
      url: action ? navigationUrl.toRelativeUrl() : navigationUrl.toRequestPath(),
      body: this.readFormBody(form, event.submitter),
    })
  }

  private handleClick(event: DomEvent): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    const target = event.target as DomElement | null
    const anchor = target?.closest('a[href]')
    const href = anchor?.getAttribute('href')

    if (!anchor || !href || anchor.getAttribute('target') || anchor.getAttribute('download') !== null) {
      return
    }

    const navigationUrl = this.resolveLinkUrl(href)

    if (!navigationUrl) {
      return
    }

    event.preventDefault()
    this.emit({ kind: 'follow', url: navigationUrl.toRelativeUrl() })
  }

  // The submitter matters: a plain FormData(form) never includes submit-button
  // values, and multi-button steps (Post('action') branching) rely on the
  // clicked button's name/value arriving in the body - exactly what the
  // browser itself would send on a real form submission.
  private readFormBody(form: DomElement, submitter: unknown): Record<string, unknown> {
    const entries = [...new (FormData as unknown as FormDataFromForm)(form, submitter)]
    const body: Record<string, unknown> = {}

    entries.forEach(([name, value]) => {
      const existing = body[name]

      if (existing === undefined) {
        body[name] = value
      } else if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        body[name] = [existing, value]
      }
    })

    return body
  }

  private decodeFragment(fragment: string): string {
    try {
      return decodeURIComponent(fragment)
    } catch {
      return fragment
    }
  }

  private captureCurrentScrollPosition(): void {
    const entryId = this.currentHistoryEntryId

    if (!entryId) {
      return
    }

    this.scrollPositions.set(entryId, this.getCurrentScrollPosition())
  }

  private getCurrentScrollPosition(): BrowserScrollPosition {
    return { x: this.domWindow.scrollX, y: this.domWindow.scrollY }
  }

  private ensureCurrentHistoryEntryId(): string {
    if (this.currentHistoryEntryId) {
      return this.currentHistoryEntryId
    }

    const entryId = this.readHistoryEntryId(this.domWindow.history.state) ?? this.createHistoryEntryId()

    this.domWindow.history.replaceState(this.withHistoryEntryId(this.domWindow.history.state, entryId), '')
    this.currentHistoryEntryId = entryId

    return entryId
  }

  private resolveHistoryEntryId(state: unknown): string {
    const entryId = this.readHistoryEntryId(state)

    if (entryId) {
      return entryId
    }

    const newEntryId = this.createHistoryEntryId()

    this.domWindow.history.replaceState(this.withHistoryEntryId(state, newEntryId), '')

    return newEntryId
  }

  private createHistoryEntryId(): string {
    WindowBrowserHost.nextHistoryEntryId += 1

    return `${Date.now()}-${WindowBrowserHost.nextHistoryEntryId}`
  }

  private withHistoryEntryId(state: unknown, entryId: string): Record<string, unknown> {
    const historyState = this.isRecord(state) ? state : {}

    return { ...historyState, [HISTORY_STATE_KEY]: { entryId } satisfies BrowserHistoryState }
  }

  private readHistoryEntryId(state: unknown): string | undefined {
    if (!this.isRecord(state)) {
      return undefined
    }

    const browserHistoryState = state[HISTORY_STATE_KEY]

    if (!this.isRecord(browserHistoryState) || typeof browserHistoryState.entryId !== 'string') {
      return undefined
    }

    return browserHistoryState.entryId
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private resolveLinkUrl(href: string): BrowserNavigationUrl | undefined {
    if (href.startsWith('#') || href.startsWith('//')) {
      return undefined
    }

    return this.resolveSameOriginUrl(href)
  }

  private resolveSameOriginUrl(value: string): BrowserNavigationUrl | undefined {
    const currentUrl = BrowserNavigationUrl.fromLocation(this.domWindow.location.href)
    const url = BrowserNavigationUrl.resolve(value, currentUrl.toAbsoluteUrl())

    if (!url.isSameOrigin(currentUrl.getOrigin())) {
      return undefined
    }

    return url
  }

  private emit(interaction: BrowserInteraction): void {
    this.listeners.forEach(listener => listener(interaction))
  }
}
