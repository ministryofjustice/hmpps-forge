Object.defineProperty(exports, '__esModule', { value: true })
const thunkTestHelpers_1 = require('../../../../testing/thunkTestHelpers')
const EffectFunctionContext_1 = require('./EffectFunctionContext')

describe('EffectFunctionContext', function () {
  describe('getRequestHeader()', function () {
    it('should return a request header value', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)({
        mockRequest: {
          headers: { 'content-type': 'application/json', authorization: 'Bearer token123' },
        },
      })
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getRequestHeader('authorization')
      // Assert
      expect(result).toBe('Bearer token123')
    })
    it('should return undefined for non-existent header', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)({
        mockRequest: { headers: {} },
      })
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getRequestHeader('x-non-existent')
      // Assert
      expect(result).toBeUndefined()
    })
    it('should handle array header values', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)({
        mockRequest: {
          headers: { 'set-cookie': ['cookie1=value1', 'cookie2=value2'] },
        },
      })
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getRequestHeader('set-cookie')
      // Assert
      expect(result).toEqual(['cookie1=value1', 'cookie2=value2'])
    })
  })
  describe('getAllRequestHeaders()', function () {
    it('should return all request headers', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)({
        mockRequest: {
          headers: { 'content-type': 'application/json', accept: 'text/html' },
        },
      })
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getAllRequestHeaders()
      // Assert
      expect(result).toEqual({ 'content-type': 'application/json', accept: 'text/html' })
    })
    it('should return empty object when no headers', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)({
        mockRequest: { headers: {} },
      })
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getAllRequestHeaders()
      // Assert
      expect(result).toEqual({})
    })
  })
  describe('getRequestCookie()', function () {
    it('should return a request cookie value', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)({
        mockRequest: {
          cookies: { session: 'abc123', preference: 'dark' },
        },
      })
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getRequestCookie('session')
      // Assert
      expect(result).toBe('abc123')
    })
    it('should return undefined for non-existent cookie', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)({
        mockRequest: { cookies: {} },
      })
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getRequestCookie('non-existent')
      // Assert
      expect(result).toBeUndefined()
    })
  })
  describe('getAllRequestCookies()', function () {
    it('should return all request cookies', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)({
        mockRequest: {
          cookies: { session: 'abc123', preference: 'dark' },
        },
      })
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getAllRequestCookies()
      // Assert
      expect(result).toEqual({ session: 'abc123', preference: 'dark' })
    })
    it('should return empty object when no cookies', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)({
        mockRequest: { cookies: {} },
      })
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getAllRequestCookies()
      // Assert
      expect(result).toEqual({})
    })
  })
  describe('setResponseHeader()', function () {
    it('should set a header in the response', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      effectContext.setResponseHeader('X-Custom-Header', 'test-value')
      // Assert
      expect(mockContext.response.getHeader('X-Custom-Header')).toBe('test-value')
    })
    it('should overwrite an existing header', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      effectContext.setResponseHeader('X-Custom-Header', 'first-value')
      effectContext.setResponseHeader('X-Custom-Header', 'second-value')
      // Assert
      expect(mockContext.response.getHeader('X-Custom-Header')).toBe('second-value')
    })
  })
  describe('getResponseHeader()', function () {
    it('should return a previously set header', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      effectContext.setResponseHeader('X-Custom-Header', 'test-value')
      // Act
      const result = effectContext.getResponseHeader('X-Custom-Header')
      // Assert
      expect(result).toBe('test-value')
    })
    it('should return undefined for non-existent header', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getResponseHeader('X-Non-Existent')
      // Assert
      expect(result).toBeUndefined()
    })
  })
  describe('getAllResponseHeaders()', function () {
    it('should return all set headers', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      effectContext.setResponseHeader('X-First', 'value1')
      effectContext.setResponseHeader('X-Second', 'value2')
      // Act
      const result = effectContext.getAllResponseHeaders()
      // Assert
      expect(result.size).toBe(2)
      expect(result.get('X-First')).toBe('value1')
      expect(result.get('X-Second')).toBe('value2')
    })
    it('should return empty map when no headers set', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getAllResponseHeaders()
      // Assert
      expect(result.size).toBe(0)
    })
  })
  describe('setResponseCookie()', function () {
    it('should set a cookie in the response', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      effectContext.setResponseCookie('session', 'abc123')
      // Assert
      const cookie = mockContext.response.getCookie('session')
      expect(cookie).toEqual({ value: 'abc123', options: undefined })
    })
    it('should set a cookie with options', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
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
    it('should overwrite an existing cookie', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      effectContext.setResponseCookie('session', 'first')
      effectContext.setResponseCookie('session', 'second')
      // Assert
      const cookie = mockContext.response.getCookie('session')
      expect(cookie === null || cookie === void 0 ? void 0 : cookie.value).toBe('second')
    })
    it('should clear a cookie by setting maxAge to 0', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      effectContext.setResponseCookie('session', 'abc123')
      // Act
      effectContext.setResponseCookie('session', '', { maxAge: 0 })
      // Assert
      const cookie = mockContext.response.getCookie('session')
      expect(cookie).toEqual({ value: '', options: { maxAge: 0 } })
    })
  })
  describe('getResponseCookie()', function () {
    it('should return a previously set cookie', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      effectContext.setResponseCookie('session', 'abc123', { httpOnly: true })
      // Act
      const result = effectContext.getResponseCookie('session')
      // Assert
      expect(result).toEqual({ value: 'abc123', options: { httpOnly: true } })
    })
    it('should return undefined for non-existent cookie', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getResponseCookie('non-existent')
      // Assert
      expect(result).toBeUndefined()
    })
  })
  describe('getAllResponseCookies()', function () {
    it('should return all set cookies', function () {
      let _a
      let _b
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      effectContext.setResponseCookie('session', 'abc123')
      effectContext.setResponseCookie('preference', 'dark')
      // Act
      const result = effectContext.getAllResponseCookies()
      // Assert
      expect(result.size).toBe(2)
      expect((_a = result.get('session')) === null || _a === void 0 ? void 0 : _a.value).toBe('abc123')
      expect((_b = result.get('preference')) === null || _b === void 0 ? void 0 : _b.value).toBe('dark')
    })
    it('should return empty map when no cookies set', function () {
      // Arrange
      const mockContext = (0, thunkTestHelpers_1.createMockContext)()
      const effectContext = new EffectFunctionContext_1.default(mockContext, 'load')
      // Act
      const result = effectContext.getAllResponseCookies()
      // Assert
      expect(result.size).toBe(0)
    })
  })
})
