import WindowBrowserHost from './WindowBrowserHost'

interface TestDomEvent {
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

describe('WindowBrowserHost', () => {
  function createWindow(
    startViewTransition?: (update: () => Promise<void> | void) => { readonly updateCallbackDone: Promise<void> },
  ) {
    const listeners = new Map<string, (event: TestDomEvent) => void>()
    let historyState: unknown
    let scrollX = 0
    let scrollY = 0

    return {
      document: { startViewTransition, getElementById: vi.fn() },
      location: {
        href: 'https://forms.example/host',
        assign: vi.fn(),
      },
      history: {
        get state() {
          return historyState
        },
        scrollRestoration: 'auto' as 'auto' | 'manual',
        pushState: vi.fn((state: unknown, _unused: string, _url?: string) => {
          historyState = state
        }),
        replaceState: vi.fn((state: unknown, _unused: string, _url?: string) => {
          historyState = state
        }),
      },
      get scrollX() {
        return scrollX
      },
      get scrollY() {
        return scrollY
      },
      scrollTo: vi.fn((x: number, y: number) => {
        scrollX = x
        scrollY = y
      }),
      addEventListener: vi.fn((type: string, listener: (event: TestDomEvent) => void) => {
        listeners.set(type, listener)
      }),
      removeEventListener: vi.fn((type: string) => {
        listeners.delete(type)
      }),
      emit(type: string, event: TestDomEvent) {
        listeners.get(type)?.(event)
      },
      setScrollPosition(x: number, y: number) {
        scrollX = x
        scrollY = y
      },
    }
  }

  function createContainer() {
    const listeners = new Map<string, (event: TestDomEvent) => void>()

    return {
      addEventListener: vi.fn((type: string, listener: (event: TestDomEvent) => void) => {
        listeners.set(type, listener)
      }),
      removeEventListener: vi.fn((type: string) => {
        listeners.delete(type)
      }),
      emit(type: string, event: TestDomEvent) {
        listeners.get(type)?.(event)
      },
    }
  }

  function createClickEvent(href: string): TestDomEvent {
    const anchor = {
      getAttribute: vi.fn((name: string) => {
        if (name === 'href') {
          return href
        }

        return null
      }),
      closest: vi.fn(),
    }
    const target = {
      getAttribute: vi.fn(),
      closest: vi.fn().mockReturnValue(anchor),
    }

    return {
      target,
      defaultPrevented: false,
      button: 0,
      preventDefault: vi.fn(),
    }
  }

  function createSubmitEvent(action: string | null): TestDomEvent {
    const form = {
      getAttribute: vi.fn((name: string) => {
        if (name === 'method') {
          return 'post'
        }

        if (name === 'action') {
          return action
        }

        return null
      }),
      closest: vi.fn(),
    }

    return {
      target: form,
      defaultPrevented: false,
      preventDefault: vi.fn(),
    }
  }

  beforeEach(() => {
    vi.stubGlobal(
      'FormData',
      class TestFormData {
        [Symbol.iterator](): IterableIterator<[string, unknown]> {
          return new Map<string, unknown>().entries()
        }
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('updateView()', () => {
    it('should use a same-document view transition when the browser supports it', async () => {
      // Arrange
      const update = vi.fn().mockResolvedValue(undefined)
      const startViewTransition = vi.fn().mockImplementation((nextUpdate: () => Promise<void> | void) => {
        return { updateCallbackDone: Promise.resolve(nextUpdate()).then(() => undefined) }
      })
      const host = new WindowBrowserHost({ container: createContainer(), window: createWindow(startViewTransition) })

      // Act
      await host.updateView(update)

      // Assert
      expect(startViewTransition).toHaveBeenCalledWith(update)
      expect(update).toHaveBeenCalledTimes(1)
    })

    it('should update immediately when the browser does not support view transitions', async () => {
      // Arrange
      const update = vi.fn()
      const host = new WindowBrowserHost({ container: createContainer(), window: createWindow() })

      // Act
      await host.updateView(update)

      // Assert
      expect(update).toHaveBeenCalledTimes(1)
    })

    it('should update immediately when view transitions are disabled', async () => {
      // Arrange
      const update = vi.fn()
      const startViewTransition = vi.fn()
      const host = new WindowBrowserHost({
        container: createContainer(),
        window: createWindow(startViewTransition),
        viewTransitions: false,
      })

      // Act
      await host.updateView(update)

      // Assert
      expect(startViewTransition).not.toHaveBeenCalled()
      expect(update).toHaveBeenCalledTimes(1)
    })
  })

  describe('history URLs', () => {
    it('should identify a pushed history entry for later scroll restoration', () => {
      // Arrange
      const domWindow = createWindow()
      const host = new WindowBrowserHost({ container: createContainer(), window: domWindow })

      // Act
      host.pushUrl('/next')

      // Assert
      expect(domWindow.history.pushState).toHaveBeenCalledWith(
        {
          '@ministryofjustice/hmpps-forge/browser': { entryId: expect.any(String) },
        },
        '',
        '/next',
      )
    })

    it('should preserve existing object state when replacing the current URL', () => {
      // Arrange
      const domWindow = createWindow()
      const host = new WindowBrowserHost({ container: createContainer(), window: domWindow })

      domWindow.history.replaceState({ application: 'state' }, '')
      domWindow.history.replaceState.mockClear()

      // Act
      host.replaceUrl('/replacement')

      // Assert
      expect(domWindow.history.replaceState).toHaveBeenCalledWith(
        {
          application: 'state',
          '@ministryofjustice/hmpps-forge/browser': { entryId: expect.any(String) },
        },
        '',
        '/replacement',
      )
    })
  })

  describe('scrollTo()', () => {
    it('should decode the fragment and scroll the matching element into view', () => {
      // Arrange
      const target = { scrollIntoView: vi.fn() }
      const domWindow = createWindow()

      domWindow.document.getElementById.mockReturnValue(target)

      const host = new WindowBrowserHost({ container: createContainer(), window: domWindow })

      // Act
      host.scrollTo({ kind: 'fragment', fragment: 'some%20header' })

      // Assert
      expect(domWindow.document.getElementById).toHaveBeenCalledWith('some header')
      expect(target.scrollIntoView).toHaveBeenCalledTimes(1)
    })

    it('should tolerate malformed fragment encoding', () => {
      // Arrange
      const target = { scrollIntoView: vi.fn() }
      const domWindow = createWindow()

      domWindow.document.getElementById.mockReturnValue(target)

      const host = new WindowBrowserHost({ container: createContainer(), window: domWindow })

      // Act
      host.scrollTo({ kind: 'fragment', fragment: 'some%header' })

      // Assert
      expect(domWindow.document.getElementById).toHaveBeenCalledWith('some%header')
      expect(target.scrollIntoView).toHaveBeenCalledTimes(1)
    })

    it('should scroll to an exact history position', () => {
      // Arrange
      const domWindow = createWindow()
      const host = new WindowBrowserHost({ container: createContainer(), window: domWindow })

      // Act
      host.scrollTo({ kind: 'position', position: { x: 24, y: 640 } })

      // Assert
      expect(domWindow.scrollTo).toHaveBeenCalledWith(24, 640)
    })

    it('should scroll to the top when a fragment target does not exist', () => {
      // Arrange
      const domWindow = createWindow()
      const host = new WindowBrowserHost({ container: createContainer(), window: domWindow })

      // Act
      host.scrollTo({ kind: 'fragment', fragment: 'missing' })

      // Assert
      expect(domWindow.scrollTo).toHaveBeenCalledWith(0, 0)
    })
  })

  describe('subscribe()', () => {
    it.each([
      ['a relative URL', 'contact?from=nav#details', '/contact?from=nav#details'],
      ['a query-only URL', '?edit=true', '/host?edit=true'],
      ['a same-origin absolute URL', 'https://forms.example/next', '/next'],
    ])('should emit a normalized navigation path for %s', (_description, href, expectedPath) => {
      // Arrange
      const container = createContainer()
      const listener = vi.fn()
      const event = createClickEvent(href)
      const host = new WindowBrowserHost({ container, window: createWindow() })

      host.subscribe(listener)

      // Act
      container.emit('click', event)

      // Assert
      expect(event.preventDefault).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ kind: 'follow', url: expectedPath })
    })

    it.each([
      ['a fragment-only URL', '#details'],
      ['an external URL', 'https://outside.example/next'],
      ['a protocol-relative URL', '//forms.example/next'],
    ])('should leave %s to native browser navigation', (_description, href) => {
      // Arrange
      const container = createContainer()
      const listener = vi.fn()
      const event = createClickEvent(href)
      const host = new WindowBrowserHost({ container, window: createWindow() })

      host.subscribe(listener)

      // Act
      container.emit('click', event)

      // Assert
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(listener).not.toHaveBeenCalled()
    })

    it('should resolve a relative POST action against the current URL', () => {
      // Arrange
      const container = createContainer()
      const domWindow = createWindow()
      const listener = vi.fn()
      const event = createSubmitEvent('contact?from=form#details')

      domWindow.location.href = 'https://forms.example/browser-demo/your-name?draft=1#old'

      const host = new WindowBrowserHost({ container, window: domWindow })

      host.subscribe(listener)

      // Act
      container.emit('submit', event)

      // Assert
      expect(event.preventDefault).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({
        kind: 'submit',
        url: '/browser-demo/contact?from=form#details',
        body: {},
      })
    })

    it('should preserve the current query and omit its fragment when a POST action is absent', () => {
      // Arrange
      const container = createContainer()
      const domWindow = createWindow()
      const listener = vi.fn()
      const event = createSubmitEvent(null)

      domWindow.location.href = 'https://forms.example/browser-demo/your-name?draft=1#old'

      const host = new WindowBrowserHost({ container, window: domWindow })

      host.subscribe(listener)

      // Act
      container.emit('submit', event)

      // Assert
      expect(listener).toHaveBeenCalledWith({
        kind: 'submit',
        url: '/browser-demo/your-name?draft=1',
        body: {},
      })
    })

    it.each([
      ['an external POST action', 'https://outside.example/complete'],
      ['a protocol-relative POST action', '//forms.example/complete'],
    ])('should leave %s to native browser submission', (_description, action) => {
      // Arrange
      const container = createContainer()
      const listener = vi.fn()
      const event = createSubmitEvent(action)
      const host = new WindowBrowserHost({ container, window: createWindow() })

      host.subscribe(listener)

      // Act
      container.emit('submit', event)

      // Assert
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(listener).not.toHaveBeenCalled()
    })

    it('should emit the complete current URL when browser history changes', () => {
      // Arrange
      const container = createContainer()
      const domWindow = createWindow()
      const listener = vi.fn()
      const event = createClickEvent('/unused')

      domWindow.location.href = 'https://forms.example/browser-demo/contact?edit=true#email'

      const host = new WindowBrowserHost({ container, window: domWindow })

      host.subscribe(listener)

      // Act
      domWindow.emit('popstate', event)

      // Assert
      expect(listener).toHaveBeenCalledWith({
        kind: 'restore',
        url: '/browser-demo/contact?edit=true#email',
      })
    })

    it('should restore the position captured when a history entry was left', () => {
      // Arrange
      const container = createContainer()
      const domWindow = createWindow()
      const listener = vi.fn()
      const host = new WindowBrowserHost({ container, window: domWindow })

      host.subscribe(listener)
      const firstEntryState = domWindow.history.state

      domWindow.setScrollPosition(32, 720)
      host.pushUrl('/browser-demo/next')
      domWindow.setScrollPosition(0, 0)
      domWindow.location.href = 'https://forms.example/browser-demo/contact'

      // Act
      domWindow.emit('popstate', { ...createClickEvent('/unused'), state: firstEntryState })

      // Assert
      expect(listener).toHaveBeenCalledWith({
        kind: 'restore',
        url: '/browser-demo/contact',
        scrollPosition: { x: 32, y: 720 },
      })
    })

    it('should use manual restoration only while subscribed', () => {
      // Arrange
      const domWindow = createWindow()
      const host = new WindowBrowserHost({ container: createContainer(), window: domWindow })

      // Act
      const unsubscribe = host.subscribe(vi.fn())

      // Assert
      expect(domWindow.history.scrollRestoration).toBe('manual')

      unsubscribe()

      expect(domWindow.history.scrollRestoration).toBe('auto')
    })
  })
})
