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
  describe('create()', () => {
    it('should seed a fresh session with an id when no storage is supplied', () => {
      // Arrange & Act
      const session = BrowserSession.create()

      // Assert
      expect(session.getState().id).toEqual(expect.any(String))
    })

    it('should restore state from storage when a persisted session exists', () => {
      // Arrange
      const storage = createFakeStorage({ 'forge-browser-session': '{"id":"restored","answers":{"name":"Ada"}}' })

      // Act
      const session = BrowserSession.create({ storage })

      // Assert
      expect(session.getState()).toEqual({ id: 'restored', answers: { name: 'Ada' } })
    })

    it('should seed a fresh session when the persisted value is not valid JSON', () => {
      // Arrange
      const storage = createFakeStorage({ 'forge-browser-session': 'not-json{' })

      // Act
      const session = BrowserSession.create({ storage })

      // Assert
      expect(session.getState().id).toEqual(expect.any(String))
    })

    it.each(['null', '[]', '"not-an-object"'])(
      'should seed a fresh session when the persisted value is %s',
      persistedValue => {
        // Arrange
        const storage = createFakeStorage({ 'forge-browser-session': persistedValue })

        // Act
        const session = BrowserSession.create({ storage })

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
      const session = BrowserSession.create({ storage })

      // Assert
      expect(session.getState().id).toEqual(expect.any(String))
    })
  })

  describe('persist()', () => {
    it('should write the current state as JSON when storage is supplied', () => {
      // Arrange
      const storage = createFakeStorage()
      const session = BrowserSession.create({ storage, storageKey: 'demo-session' })

      session.getState().answers = { name: 'Ada' }

      // Act
      session.persist()

      // Assert
      expect(JSON.parse(storage.store.get('demo-session') ?? '')).toEqual({
        id: session.getState().id,
        answers: { name: 'Ada' },
      })
    })

    it('should do nothing when no storage is supplied', () => {
      // Arrange
      const session = BrowserSession.create()

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
      const session = BrowserSession.create({ storage })

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
      const session = BrowserSession.create({ storage })

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
