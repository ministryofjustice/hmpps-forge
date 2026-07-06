import DevToolsSession from './DevToolsSession'

function createMockWebSocket(): { ws: MockWebSocket; sent: Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = []

  const ws = {
    OPEN: 1,
    readyState: 1,
    send: vi.fn((data: string) => sent.push(JSON.parse(data))),
    close: vi.fn(),
  }

  return { ws: ws as unknown as MockWebSocket, sent }
}

type MockWebSocket = import('ws').WebSocket

describe('DevToolsSession', () => {
  describe('getState()', () => {
    it('should start in awaiting-code state', () => {
      // Arrange
      const { ws } = createMockWebSocket()

      // Act
      const session = new DevToolsSession(ws)

      // Assert
      expect(session.getState()).toBe('awaiting-code')
    })
  })

  describe('getCode()', () => {
    it('should return a 5-character alphanumeric code', () => {
      // Arrange
      const { ws } = createMockWebSocket()

      // Act
      const session = new DevToolsSession(ws)

      // Assert
      expect(session.getCode()).toMatch(/^[A-Z0-9]{5}$/)
    })
  })

  describe('handleAuthCode()', () => {
    it('should authenticate and send auth:success when the correct code is submitted', () => {
      // Arrange
      const { ws, sent } = createMockWebSocket()
      const session = new DevToolsSession(ws)

      // Act
      const result = session.handleAuthCode(session.getCode())

      // Assert
      expect(result).toBe('valid')
      expect(session.getState()).toBe('authenticated')
      expect(session.getCookieValue()).toHaveLength(64)
      expect(sent).toEqual([{ type: 'auth:success', cookie: session.getCookieValue() }])
    })

    it('should send auth:failed for a wrong code', () => {
      // Arrange
      const { ws, sent } = createMockWebSocket()
      const session = new DevToolsSession(ws)

      // Act
      const result = session.handleAuthCode('WRONG')

      // Assert
      expect(result).toBe('invalid')
      expect(session.getState()).toBe('awaiting-code')
      expect(sent).toEqual([{ type: 'auth:failed', attemptsRemaining: 2 }])
    })

    it('should send auth:rejected after 3 failed attempts', () => {
      // Arrange
      const { ws, sent } = createMockWebSocket()
      const session = new DevToolsSession(ws)

      // Act
      session.handleAuthCode('WRONG')
      session.handleAuthCode('WRONG')
      const result = session.handleAuthCode('WRONG')

      // Assert
      expect(result).toBe('max-attempts')
      expect(sent[2]).toEqual({ type: 'auth:rejected' })
      expect(ws.close).not.toHaveBeenCalled()
    })

    it('should not accept the correct code after rejection without refresh', () => {
      // Arrange
      const { ws } = createMockWebSocket()
      const session = new DevToolsSession(ws)
      session.handleAuthCode('WRONG')
      session.handleAuthCode('WRONG')
      session.handleAuthCode('WRONG')

      // Act
      const result = session.handleAuthCode(session.getCode())

      // Assert
      expect(result).toBe('max-attempts')
    })
  })

  describe('refreshCode()', () => {
    it('should generate a new code and send auth:challenge', () => {
      // Arrange
      const { ws, sent } = createMockWebSocket()
      const session = new DevToolsSession(ws)
      const originalCode = session.getCode()

      // Act
      session.refreshCode()

      // Assert
      expect(session.getCode()).not.toBe(originalCode)
      expect(session.getState()).toBe('awaiting-code')
      expect(sent).toEqual([expect.objectContaining({ type: 'auth:challenge' })])
      expect(sent[0].expiresIn).toBeGreaterThan(0)
    })

    it('should allow authentication after refresh following rejection', () => {
      // Arrange
      const { ws } = createMockWebSocket()
      const session = new DevToolsSession(ws)
      session.handleAuthCode('WRONG')
      session.handleAuthCode('WRONG')
      session.handleAuthCode('WRONG')

      // Act
      session.refreshCode()
      const result = session.handleAuthCode(session.getCode())

      // Assert
      expect(result).toBe('valid')
      expect(session.getState()).toBe('authenticated')
    })
  })

  describe('getRemainingAttempts()', () => {
    it('should start at 3', () => {
      // Arrange
      const { ws } = createMockWebSocket()
      const session = new DevToolsSession(ws)

      // Act & Assert
      expect(session.getRemainingAttempts()).toBe(3)
    })

    it('should decrement after each failed attempt', () => {
      // Arrange
      const { ws } = createMockWebSocket()
      const session = new DevToolsSession(ws)

      // Act
      session.handleAuthCode('WRONG')

      // Assert
      expect(session.getRemainingAttempts()).toBe(2)
    })
  })

  describe('send()', () => {
    it('should send JSON over the WebSocket when open', () => {
      // Arrange
      const { ws, sent } = createMockWebSocket()
      const session = new DevToolsSession(ws)

      // Act
      session.send({ type: 'test', value: 42 })

      // Assert
      expect(sent).toEqual([{ type: 'test', value: 42 }])
    })

    it('should not send when the WebSocket is closed', () => {
      // Arrange
      const { ws } = createMockWebSocket()
      Object.defineProperty(ws, 'readyState', { value: 3 })
      const session = new DevToolsSession(ws)

      // Act
      session.send({ type: 'test' })

      // Assert
      expect(ws.send).not.toHaveBeenCalled()
    })
  })
})
