import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import EffectFunctionContext from './EffectFunctionContext'

describe('EffectFunctionContext', () => {
  describe('getRequestHeader()', () => {
    it('should return a request header value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          headers: { 'content-type': 'application/json', authorization: 'Bearer token123' },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getRequestHeader('authorization')

      // Assert
      expect(result).toBe('Bearer token123')
    })

    it('should return undefined for non-existent header', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: { headers: {} },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getRequestHeader('x-non-existent')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle array header values', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          headers: { 'set-cookie': ['cookie1=value1', 'cookie2=value2'] },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getRequestHeader('set-cookie')

      // Assert
      expect(result).toEqual(['cookie1=value1', 'cookie2=value2'])
    })
  })

  describe('getAllRequestHeaders()', () => {
    it('should return all request headers', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          headers: { 'content-type': 'application/json', accept: 'text/html' },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getAllRequestHeaders()

      // Assert
      expect(result).toEqual({ 'content-type': 'application/json', accept: 'text/html' })
    })

    it('should return empty object when no headers', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: { headers: {} },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getAllRequestHeaders()

      // Assert
      expect(result).toEqual({})
    })
  })

  describe('getRequestCookie()', () => {
    it('should return a request cookie value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          cookies: { session: 'abc123', preference: 'dark' },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getRequestCookie('session')

      // Assert
      expect(result).toBe('abc123')
    })

    it('should return undefined for non-existent cookie', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: { cookies: {} },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getRequestCookie('non-existent')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('getAllRequestCookies()', () => {
    it('should return all request cookies', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          cookies: { session: 'abc123', preference: 'dark' },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getAllRequestCookies()

      // Assert
      expect(result).toEqual({ session: 'abc123', preference: 'dark' })
    })

    it('should return empty object when no cookies', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: { cookies: {} },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getAllRequestCookies()

      // Assert
      expect(result).toEqual({})
    })
  })

  describe('setResponseHeader()', () => {
    it('should set a header in the response', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      effectContext.setResponseHeader('X-Custom-Header', 'test-value')

      // Assert
      expect(mockContext.response.getHeader('X-Custom-Header')).toBe('test-value')
    })

    it('should overwrite an existing header', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      effectContext.setResponseHeader('X-Custom-Header', 'first-value')
      effectContext.setResponseHeader('X-Custom-Header', 'second-value')

      // Assert
      expect(mockContext.response.getHeader('X-Custom-Header')).toBe('second-value')
    })
  })

  describe('getResponseHeader()', () => {
    it('should return a previously set header', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')
      effectContext.setResponseHeader('X-Custom-Header', 'test-value')

      // Act
      const result = effectContext.getResponseHeader('X-Custom-Header')

      // Assert
      expect(result).toBe('test-value')
    })

    it('should return undefined for non-existent header', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getResponseHeader('X-Non-Existent')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('getAllResponseHeaders()', () => {
    it('should return all set headers', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')
      effectContext.setResponseHeader('X-First', 'value1')
      effectContext.setResponseHeader('X-Second', 'value2')

      // Act
      const result = effectContext.getAllResponseHeaders()

      // Assert
      expect(result.size).toBe(2)
      expect(result.get('X-First')).toBe('value1')
      expect(result.get('X-Second')).toBe('value2')
    })

    it('should return empty map when no headers set', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getAllResponseHeaders()

      // Assert
      expect(result.size).toBe(0)
    })
  })

  describe('setResponseCookie()', () => {
    it('should set a cookie in the response', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      effectContext.setResponseCookie('session', 'abc123')

      // Assert
      const cookie = mockContext.response.getCookie('session')
      expect(cookie).toEqual({ value: 'abc123', options: undefined })
    })

    it('should set a cookie with options', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      effectContext.setResponseCookie('preference', 'dark', {
        maxAge: 86400000,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      })

      // Assert
      const cookie = mockContext.response.getCookie('preference')
      expect(cookie).toEqual({
        value: 'dark',
        options: {
          maxAge: 86400000,
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
        },
      })
    })

    it('should overwrite an existing cookie', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      effectContext.setResponseCookie('session', 'first')
      effectContext.setResponseCookie('session', 'second')

      // Assert
      const cookie = mockContext.response.getCookie('session')
      expect(cookie?.value).toBe('second')
    })

    it('should clear a cookie by setting maxAge to 0', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')
      effectContext.setResponseCookie('session', 'abc123')

      // Act
      effectContext.setResponseCookie('session', '', { maxAge: 0 })

      // Assert
      const cookie = mockContext.response.getCookie('session')
      expect(cookie).toEqual({ value: '', options: { maxAge: 0 } })
    })
  })

  describe('getResponseCookie()', () => {
    it('should return a previously set cookie', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')
      effectContext.setResponseCookie('session', 'abc123', { httpOnly: true })

      // Act
      const result = effectContext.getResponseCookie('session')

      // Assert
      expect(result).toEqual({ value: 'abc123', options: { httpOnly: true } })
    })

    it('should return undefined for non-existent cookie', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getResponseCookie('non-existent')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('getAllResponseCookies()', () => {
    it('should return all set cookies', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')
      effectContext.setResponseCookie('session', 'abc123')
      effectContext.setResponseCookie('preference', 'dark')

      // Act
      const result = effectContext.getAllResponseCookies()

      // Assert
      expect(result.size).toBe(2)
      expect(result.get('session')?.value).toBe('abc123')
      expect(result.get('preference')?.value).toBe('dark')
    })

    it('should return empty map when no cookies set', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'load')

      // Act
      const result = effectContext.getAllResponseCookies()

      // Assert
      expect(result.size).toBe(0)
    })
  })
})
