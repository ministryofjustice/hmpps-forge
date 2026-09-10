import BrowserSession from './BrowserSession'
import type { BrowserStorage } from './types'

function createFakeStorage(initial: Record<string, string> = {}): BrowserStorage & { store: Map<string, string> } {
  const store = new Map(Object.entries(initial))

  return {
    store,
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
}

describe('BrowserSession', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('constructor()', () => {
    it('should restore from browser sessionStorage when no storage is supplied', () => {
      // Arrange
      const storage = createFakeStorage({ 'forge-browser-session': '{"id":"restored","draft":{"name":"Ada"}}' })

      vi.stubGlobal('sessionStorage', storage)

      // Act
      const session = new BrowserSession()

      // Assert
      expect(session.getState()).toEqual({ id: 'restored', draft: { name: 'Ada' } })
    })

    it('should use the supplied storage when browser sessionStorage is also available', () => {
      // Arrange
      const browserStorage = createFakeStorage({ 'forge-browser-session': '{"id":"browser"}' })
      const storage = createFakeStorage({ 'forge-browser-session': '{"id":"custom"}' })

      vi.stubGlobal('sessionStorage', browserStorage)

      // Act
      const session = new BrowserSession({ storage })

      // Assert
      expect(session.getState()).toEqual({ id: 'custom' })
    })

    it('should retain a usable session when accessing browser sessionStorage throws', () => {
      // Arrange
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        get: () => {
          throw new DOMException('Access denied', 'SecurityError')
        },
      })

      // Act
      const session = new BrowserSession()

      session.getState().draft = { name: 'Ada' }
      session.persist()

      // Assert
      expect(session.getState()).toEqual({ id: expect.any(String), draft: { name: 'Ada' } })
    })

    it('should seed a fresh session with an id when browser storage is absent', () => {
      // Arrange
      const options = {}

      // Act
      const session = new BrowserSession(options)

      // Assert
      expect(session.getState().id).toEqual(expect.any(String))
    })

    it('should restore state from storage when a persisted session exists', () => {
      // Arrange
      const storage = createFakeStorage({ 'forge-browser-session': '{"id":"restored","answers":{"name":"Ada"}}' })

      // Act
      const session = new BrowserSession({ storage })

      // Assert
      expect(session.getState()).toEqual({ id: 'restored', answers: { name: 'Ada' } })
    })

    it('should seed a fresh session when the persisted value is not valid JSON', () => {
      // Arrange
      const storage = createFakeStorage({ 'forge-browser-session': 'not-json{' })

      // Act
      const session = new BrowserSession({ storage })

      // Assert
      expect(session.getState().id).toEqual(expect.any(String))
    })

    it.each(['null', '[]', '"not-an-object"'])(
      'should seed a fresh session when the persisted value is %s',
      persistedValue => {
        // Arrange
        const storage = createFakeStorage({ 'forge-browser-session': persistedValue })

        // Act
        const session = new BrowserSession({ storage })

        // Assert
        expect(session.getState().id).toEqual(expect.any(String))
      },
    )

    it('should seed a fresh session when storage is unavailable', () => {
      // Arrange
      const storage: BrowserStorage = {
        getItem: () => {
          throw new DOMException('Access denied', 'SecurityError')
        },
        setItem: vi.fn(),
      }

      // Act
      const session = new BrowserSession({ storage })

      // Assert
      expect(session.getState().id).toEqual(expect.any(String))
    })
  })

  describe('persist()', () => {
    it('should write to browser sessionStorage when no storage is supplied', () => {
      // Arrange
      const storage = createFakeStorage()

      vi.stubGlobal('sessionStorage', storage)

      const session = new BrowserSession()

      session.getState().draft = { name: 'Ada' }

      // Act
      session.persist()

      // Assert
      expect(JSON.parse(storage.store.get('forge-browser-session') ?? '')).toEqual({
        id: session.getState().id,
        draft: { name: 'Ada' },
      })
    })

    it('should write the current state as JSON when storage is supplied', () => {
      // Arrange
      const storage = createFakeStorage()
      const session = new BrowserSession({ storage, storageKey: 'demo-session' })

      session.getState().answers = { name: 'Ada' }

      // Act
      session.persist()

      // Assert
      expect(JSON.parse(storage.store.get('demo-session') ?? '')).toEqual({
        id: session.getState().id,
        answers: { name: 'Ada' },
      })
    })

    it('should do nothing when browser storage is absent', () => {
      // Arrange
      const session = new BrowserSession()

      // Act
      const act = () => session.persist()

      // Assert
      expect(act).not.toThrow()
    })

    it('should retain the in-memory session when storage rejects the write', () => {
      // Arrange
      const storage: BrowserStorage = {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
        },
      }
      const session = new BrowserSession({ storage })

      session.getState().answers = { name: 'Ada' }

      // Act
      const act = () => session.persist()

      // Assert
      expect(act).not.toThrow()
      expect(session.getState().answers).toEqual({ name: 'Ada' })
    })

    it('should retain the in-memory session when its state cannot be serialized', () => {
      // Arrange
      const storage = createFakeStorage()
      const session = new BrowserSession({ storage })

      session.getState().circular = session.getState()

      // Act
      const act = () => session.persist()

      // Assert
      expect(act).not.toThrow()
      expect(session.getState().circular).toBe(session.getState())
      expect(storage.store.size).toBe(0)
    })
  })
})
