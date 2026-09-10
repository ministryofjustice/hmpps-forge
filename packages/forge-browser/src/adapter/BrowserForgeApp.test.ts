import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { createForgePackage, journey, redirect, step, submit } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'
import type { BrowserRenderingEngine } from '../renderer/BrowserRenderingEngine.type'
import BrowserForgeApp from './BrowserForgeApp'
import type { BrowserErrorEvent, BrowserForgeAppOptions, BrowserRenderEvent } from './BrowserForgeApp'
import BrowserSession from './BrowserSession'
import type { BrowserHost, BrowserInteraction, BrowserLocationSnapshot } from './types'

const silentLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as unknown as Console

const demoJourney = journey({
  code: 'demo',
  path: '/demo',
  title: 'Demo',
  steps: [
    step({
      code: 'start',
      path: '/start',
      title: 'Start',
      reachability: { entryWhen: true },
      blocks: [],
      onSubmission: [submit({ validate: false, onAlways: { next: [redirect({ goto: 'done' })] } })],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

function createForge(): Forge {
  return new Forge({ logger: silentLogger }).registerPackage(createForgePackage({ journey: demoJourney }))
}

describe('BrowserForgeApp', () => {
  let location: BrowserLocationSnapshot
  let interactionListener: ((interaction: BrowserInteraction) => void) | undefined
  let host: Mocked<BrowserHost>
  let container: BrowserForgeAppOptions['container']
  let renderingEngine: BrowserRenderingEngine
  let onRender: (event: BrowserRenderEvent) => void
  let onError: (event: BrowserErrorEvent) => void

  beforeEach(() => {
    location = { href: 'https://forms.example/host' }
    interactionListener = undefined
    host = {
      getLocation: vi.fn().mockImplementation(() => location),
      pushUrl: vi.fn(),
      replaceUrl: vi.fn(),
      assign: vi.fn(),
      scrollTo: vi.fn(),
      subscribe: vi.fn().mockImplementation((listener: (interaction: BrowserInteraction) => void) => {
        interactionListener = listener

        return vi.fn()
      }),
    } as unknown as Mocked<BrowserHost>
    container = { innerHTML: '', addEventListener: vi.fn(), removeEventListener: vi.fn() }
    renderingEngine = {
      getAdapterDependencies: vi.fn().mockReturnValue({}),
      wrapNestedBlock: vi.fn().mockImplementation((block, output) => ({ block, html: output })),
      assemblePage: vi.fn().mockImplementation((context: RenderContext) => `page:${context.step.title}`),
    }
    onRender = vi.fn(event => {
      event.container.innerHTML = event.html
    })
    onError = vi.fn(event => {
      event.container.innerHTML = `error:${event.error.message}`
    })
  })

  function createApp(session?: BrowserSession): BrowserForgeApp {
    return new BrowserForgeApp(createForge(), { renderingEngine, container, host, session, onRender, onError })
  }

  async function emit(interaction: BrowserInteraction): Promise<void> {
    interactionListener?.(interaction)
    await vi.waitFor(() => expect(true).toBe(true))
    await new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  }

  describe('constructor', () => {
    it('should require an onRender handler at runtime', () => {
      // Arrange
      const options = { renderingEngine, container, host, onError }

      // Act
      const createAppWithoutOnRender = () => Reflect.construct(BrowserForgeApp, [createForge(), options])

      // Assert
      expect(createAppWithoutOnRender).toThrow('BrowserForgeApp requires an onRender handler')
    })

    it('should require an onError handler at runtime', () => {
      // Arrange
      const options = { renderingEngine, container, host, onRender }

      // Act
      const createAppWithoutOnError = () => Reflect.construct(BrowserForgeApp, [createForge(), options])

      // Assert
      expect(createAppWithoutOnError).toThrow('BrowserForgeApp requires an onError handler')
    })
  })

  describe('start()', () => {
    it('should handle browser events on the supplied container when no host is supplied', async () => {
      // Arrange
      const browserGlobals = {
        location,
        history: { state: undefined, scrollRestoration: 'auto', replaceState: vi.fn() },
        document: {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }

      Object.entries(browserGlobals).forEach(([name, value]) => vi.stubGlobal(name, value))

      try {
        const app = new BrowserForgeApp(createForge(), { renderingEngine, container, onRender, onError })

        // Act
        await app.start({ fallbackPath: '/demo/start' })
        app.stop()

        // Assert
        expect(container.innerHTML).toBe('page:Start')
        expect(container.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function))
        expect(container.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
        expect(browserGlobals.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function))
        expect(container.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function))
        expect(browserGlobals.removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function))
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('should persist to browser sessionStorage when no session is supplied', async () => {
      // Arrange
      const storage = {
        getItem: vi.fn().mockReturnValue('{"id":"browser-session"}'),
        setItem: vi.fn(),
      }

      vi.stubGlobal('sessionStorage', storage)

      try {
        const app = createApp()

        app.getSession().getState().draft = { name: 'Ada' }

        // Act
        await app.start({ fallbackPath: '/demo/start' })

        // Assert
        expect(storage.setItem).toHaveBeenCalledWith(
          'forge-browser-session',
          JSON.stringify({ id: 'browser-session', draft: { name: 'Ada' } }),
        )
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('should assemble adapter dependencies from the rendering engine when rendering a step', async () => {
      // Arrange
      const forge = createForge()
      const execute = vi.spyOn(forge, 'execute')
      const renderingDependencies = Object.freeze({ templateService: { render: vi.fn() } })

      vi.spyOn(renderingEngine, 'getAdapterDependencies').mockReturnValue(renderingDependencies)
      const app = new BrowserForgeApp(forge, {
        renderingEngine,
        container,
        host,
        onRender,
        onError,
      })

      // Act
      await app.start({ fallbackPath: '/demo/start' })

      // Assert
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          renderer: renderingEngine,
          adapterDependencies: renderingDependencies,
        }),
      )
      expect(execute.mock.calls[0]?.[0].adapterDependencies).not.toBe(renderingDependencies)
      expect(container.innerHTML).toBe('page:Start')
    })

    it('should render the step named by the current pathname when it matches a route', async () => {
      // Arrange
      location = {
        href: 'https://forms.example/demo/start?ref=123#some-header',
      }
      const app = createApp()

      // Act
      await app.start()

      // Assert
      expect(container.innerHTML).toBe('page:Start')
      expect(host.replaceUrl).toHaveBeenCalledWith('/demo/start?ref=123#some-header')
      expect(host.scrollTo).toHaveBeenCalledWith({ kind: 'fragment', fragment: 'some-header' })
    })

    it('should render the fallback path when the current url matches no route', async () => {
      // Arrange
      const app = createApp()

      // Act
      await app.start({ fallbackPath: '/demo/start' })

      // Assert
      expect(container.innerHTML).toBe('page:Start')
    })

    it('should render an error surface when nothing matches and no fallback is supplied', async () => {
      // Arrange
      const app = createApp()

      // Act
      await app.start()

      // Assert
      expect(container.innerHTML).toContain('No mounted route matches')
    })
  })

  describe('interactions', () => {
    it('should follow an intercepted link and push the new url', async () => {
      // Arrange
      const app = createApp()

      await app.start({ fallbackPath: '/demo/start' })

      // Act
      await emit({ kind: 'follow', url: '/demo/start#some-header' })

      // Assert
      expect(container.innerHTML).toBe('page:Start')
      expect(host.pushUrl).toHaveBeenCalledWith('/demo/start#some-header')
      expect(host.scrollTo).toHaveBeenCalledWith({ kind: 'fragment', fragment: 'some-header' })
    })

    it('should run the submission and follow the redirect chain to the next step', async () => {
      // Arrange
      const app = createApp()

      await app.start({ fallbackPath: '/demo/start' })

      // Act
      await emit({ kind: 'submit', url: '/demo/start', body: {} })

      // Assert
      expect(container.innerHTML).toBe('page:Done')
      expect(host.pushUrl).toHaveBeenCalledWith('/demo/done')
      expect(host.scrollTo).toHaveBeenCalledWith({ kind: 'position', position: { x: 0, y: 0 } })
    })

    it('should render a history restore without pushing a url', async () => {
      // Arrange
      location = { href: 'https://forms.example/demo/start#some-header' }
      const app = createApp()

      await app.start()
      vi.mocked(host.pushUrl).mockClear()
      vi.mocked(host.scrollTo)?.mockClear()

      // Act
      await emit({ kind: 'restore', url: '/demo/start#some-header' })

      // Assert
      expect(container.innerHTML).toBe('page:Start')
      expect(host.pushUrl).not.toHaveBeenCalled()
      expect(host.scrollTo).toHaveBeenCalledWith({ kind: 'fragment', fragment: 'some-header' })
    })

    it('should restore a history entry scroll position instead of its fragment target', async () => {
      // Arrange
      location = { href: 'https://forms.example/demo/start' }
      const app = createApp()

      await app.start()
      vi.mocked(host.scrollTo)?.mockClear()

      // Act
      await emit({
        kind: 'restore',
        url: '/demo/start#some-header',
        scrollPosition: { x: 12, y: 480 },
      })

      // Assert
      expect(host.scrollTo).toHaveBeenCalledWith({ kind: 'position', position: { x: 12, y: 480 } })
    })

    it('should hard-navigate when a followed link matches no mounted route', async () => {
      // Arrange
      const app = createApp()

      await app.start({ fallbackPath: '/demo/start' })

      // Act
      await emit({ kind: 'follow', url: '/somewhere-else' })

      // Assert
      expect(host.assign).toHaveBeenCalledWith('/somewhere-else')
      expect(container.innerHTML).toBe('page:Start')
    })

    it('should hard-navigate when the engine redirects to another origin', async () => {
      // Arrange
      const forge = createForge()
      const app = new BrowserForgeApp(forge, { renderingEngine, container, host, onRender, onError })

      await app.start({ fallbackPath: '/demo/start' })
      vi.spyOn(forge, 'execute').mockResolvedValueOnce({
        kind: 'navigate',
        url: 'https://outside.example/complete?ref=123#receipt',
      })

      // Act
      await emit({ kind: 'submit', url: '/demo/start', body: {} })

      // Assert
      expect(host.assign).toHaveBeenCalledWith('https://outside.example/complete?ref=123#receipt')
      expect(host.pushUrl).not.toHaveBeenCalledWith('/complete?ref=123#receipt')
    })
  })

  describe('rendering', () => {
    it('should invoke onRender within the host view update', async () => {
      // Arrange
      let update: (() => Promise<void> | void) | undefined

      host.updateView = vi.fn().mockImplementation((nextUpdate: () => Promise<void> | void) => {
        update = nextUpdate
      })

      const app = new BrowserForgeApp(createForge(), { renderingEngine, container, host, onRender, onError })

      // Act
      await app.start({ fallbackPath: '/demo/start' })

      // Assert
      expect(container.innerHTML).toBe('')
      expect(onRender).not.toHaveBeenCalled()

      await update?.()

      expect(container.innerHTML).toBe('page:Start')
      expect(onRender).toHaveBeenCalledWith({ html: 'page:Start', container })
    })

    it('should invoke onRender immediately when the host has no view update capability', async () => {
      // Arrange
      const app = new BrowserForgeApp(createForge(), { renderingEngine, container, host, onRender, onError })

      // Act
      await app.start({ fallbackPath: '/demo/start' })

      // Assert
      expect(container.innerHTML).toBe('page:Start')
      expect(onRender).toHaveBeenCalledWith({ html: 'page:Start', container })
    })

    it('should await onRender before applying navigation scrolling', async () => {
      // Arrange
      let completeRender = () => {}
      const renderGate = new Promise<void>(resolve => {
        completeRender = resolve
      })

      location = { href: 'https://forms.example/demo/start#some-header' }
      onRender = vi.fn(async event => {
        await renderGate
        event.container.innerHTML = event.html
      })

      const app = createApp()

      // Act
      const start = app.start()

      await vi.waitFor(() => expect(onRender).toHaveBeenCalledTimes(1))

      // Assert
      expect(host.scrollTo).not.toHaveBeenCalled()

      // Act
      completeRender()
      await start

      // Assert
      expect(host.scrollTo).toHaveBeenCalledWith({ kind: 'fragment', fragment: 'some-header' })
    })

    it('should invoke onError within the host view update', async () => {
      // Arrange
      let update: (() => Promise<void> | void) | undefined

      host.updateView = vi.fn().mockImplementation((nextUpdate: () => Promise<void> | void) => {
        update = nextUpdate
      })

      const app = createApp()

      // Act
      await app.start()

      // Assert
      expect(onError).not.toHaveBeenCalled()

      await update?.()

      expect(onError).toHaveBeenCalledWith({
        error: expect.objectContaining({ message: expect.stringContaining('No mounted route matches') }),
        container,
      })
    })

    it('should pass an onRender failure to onError', async () => {
      // Arrange
      onRender = vi.fn(() => {
        throw new Error('render commit failed')
      })

      const app = createApp()

      // Act
      await app.start({ fallbackPath: '/demo/start' })

      // Assert
      expect(onError).toHaveBeenCalledWith({
        error: expect.objectContaining({ message: 'render commit failed' }),
        container,
      })
      expect(container.innerHTML).toBe('error:render commit failed')
    })

    it('should reject when onError fails', async () => {
      // Arrange
      onRender = vi.fn(() => {
        throw new Error('render commit failed')
      })
      onError = vi.fn(() => {
        throw new Error('error handler failed')
      })

      const app = createApp()

      // Act
      const start = app.start({ fallbackPath: '/demo/start' })

      // Assert
      await expect(start).rejects.toThrow('error handler failed')
    })
  })

  describe('navigation concurrency', () => {
    it('should only commit the latest navigation when an earlier execution finishes later', async () => {
      // Arrange
      const forge = createForge()
      const execute = forge.execute.bind(forge)
      let releaseFirstExecution = () => {}
      const firstExecutionGate = new Promise<void>(resolve => {
        releaseFirstExecution = resolve
      })
      const executeSpy = vi.spyOn(forge, 'execute')

      const app = new BrowserForgeApp(forge, { renderingEngine, container, host, onRender, onError })

      await app.start({ fallbackPath: '/demo/start' })
      vi.mocked(host.pushUrl).mockClear()
      executeSpy.mockImplementationOnce(async request => {
        await firstExecutionGate

        return execute(request)
      })
      executeSpy.mockImplementation(request => execute(request))

      // Act
      const firstNavigation = app.navigate('/demo/start')

      await vi.waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(2))

      const latestNavigation = app.navigate('/demo/done')

      releaseFirstExecution()
      await Promise.all([firstNavigation, latestNavigation])

      // Assert
      expect(container.innerHTML).toBe('page:Done')
      expect(host.pushUrl).toHaveBeenCalledTimes(1)
      expect(host.pushUrl).toHaveBeenCalledWith('/demo/done')
    })

    it('should execute a submission only once when it is submitted repeatedly while pending', async () => {
      // Arrange
      const forge = createForge()
      const execute = forge.execute.bind(forge)
      let releaseSubmission = () => {}
      const submissionGate = new Promise<void>(resolve => {
        releaseSubmission = resolve
      })
      const executeSpy = vi.spyOn(forge, 'execute')

      const app = new BrowserForgeApp(forge, { renderingEngine, container, host, onRender, onError })

      await app.start({ fallbackPath: '/demo/start' })
      executeSpy.mockImplementationOnce(async request => {
        await submissionGate

        return execute(request)
      })
      executeSpy.mockImplementation(request => execute(request))

      // Act
      interactionListener?.({ kind: 'submit', url: '/demo/start', body: {} })
      interactionListener?.({ kind: 'submit', url: '/demo/start', body: {} })

      await vi.waitFor(() => {
        const postExecutions = executeSpy.mock.calls.filter(([request]) => request.snapshot.method === 'POST')

        expect(postExecutions).toHaveLength(1)
      })

      releaseSubmission()
      await vi.waitFor(() => expect(container.innerHTML).toBe('page:Done'))

      // Assert
      const postExecutions = executeSpy.mock.calls.filter(([request]) => request.snapshot.method === 'POST')

      expect(postExecutions).toHaveLength(1)
    })

    it('should restore the captured history path without committing an interrupted submission', async () => {
      // Arrange
      const forge = createForge()
      const execute = forge.execute.bind(forge)
      let releaseSubmission = () => {}
      const submissionGate = new Promise<void>(resolve => {
        releaseSubmission = resolve
      })
      const executeSpy = vi.spyOn(forge, 'execute')

      const app = new BrowserForgeApp(forge, { renderingEngine, container, host, onRender, onError })

      await app.start({ fallbackPath: '/demo/start' })
      vi.mocked(host.pushUrl).mockClear()
      executeSpy.mockImplementationOnce(async request => {
        await submissionGate

        return execute(request)
      })
      executeSpy.mockImplementation(request => execute(request))

      // Act
      interactionListener?.({ kind: 'submit', url: '/demo/start', body: {} })
      await vi.waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(2))

      location = { href: 'https://forms.example/demo/start' }
      interactionListener?.({ kind: 'restore', url: '/demo/start' })
      location = { href: 'https://forms.example/demo/done' }

      releaseSubmission()
      await vi.waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(3))

      // Assert
      expect(container.innerHTML).toBe('page:Start')
      expect(host.pushUrl).not.toHaveBeenCalled()
    })

    it('should not commit an active navigation after the app stops', async () => {
      // Arrange
      const forge = createForge()
      const execute = forge.execute.bind(forge)
      let releaseNavigation = () => {}
      const navigationGate = new Promise<void>(resolve => {
        releaseNavigation = resolve
      })
      const executeSpy = vi.spyOn(forge, 'execute')

      const app = new BrowserForgeApp(forge, { renderingEngine, container, host, onRender, onError })

      await app.start({ fallbackPath: '/demo/start' })
      vi.mocked(host.pushUrl).mockClear()
      executeSpy.mockImplementationOnce(async request => {
        await navigationGate

        return execute(request)
      })
      executeSpy.mockImplementation(request => execute(request))

      // Act
      const navigation = app.navigate('/demo/done')

      await vi.waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(2))
      app.stop()
      releaseNavigation()
      await navigation

      // Assert
      expect(container.innerHTML).toBe('page:Start')
      expect(host.pushUrl).not.toHaveBeenCalled()
    })
  })

  describe('session', () => {
    it('should persist the session after every dispatch when storage is supplied', async () => {
      // Arrange
      const store = new Map<string, string>()
      const session = new BrowserSession({
        storage: {
          getItem: key => store.get(key) ?? null,
          setItem: (key, value) => {
            store.set(key, value)
          },
        },
      })
      const app = createApp(session)

      // Act
      await app.start({ fallbackPath: '/demo/start' })

      // Assert
      expect(store.get('forge-browser-session')).toBeDefined()
    })
  })

  describe('stop()', () => {
    it('should unsubscribe from host interactions when stopped', async () => {
      // Arrange
      const app = createApp()

      await app.start({ fallbackPath: '/demo/start' })

      const unsubscribe = vi.mocked(host.subscribe).mock.results[0]?.value as ReturnType<typeof vi.fn>

      // Act
      app.stop()

      // Assert
      expect(unsubscribe).toHaveBeenCalledTimes(1)
    })
  })
})
