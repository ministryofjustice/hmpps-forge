import { createMockContext } from '../../ast/testing-helpers/runtimeContextTestHelpers'
import { EffectFunctionContext } from './EffectFunctionContext'

describe('EffectFunctionContext', () => {
  describe('setAnswer()', () => {
    it('should accept serializable values', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', 'hello')).not.toThrow()
      expect(() => effectContext.setAnswer('field', 42 as any)).not.toThrow()
      expect(() => effectContext.setAnswer('field', true as any)).not.toThrow()
      expect(() => effectContext.setAnswer('field', null as any)).not.toThrow()
      expect(() => effectContext.setAnswer('field', ['a', 'b'] as any)).not.toThrow()
      expect(() => effectContext.setAnswer('field', { nested: 'value' } as any)).not.toThrow()
    })

    it('should throw when setting a function', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', (() => {}) as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', (() => {}) as any)).toThrow('Cannot set a function')
    })

    it('should throw when setting a Symbol', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', Symbol('test') as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', Symbol('test') as any)).toThrow('Cannot set a Symbol')
    })

    it('should throw when setting a Date object', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', new Date() as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', new Date() as any)).toThrow('use an ISO string instead')
    })

    it('should throw when setting a BigInt', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', BigInt(123) as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', BigInt(123) as any)).toThrow('Cannot set a BigInt')
    })

    it('should throw when setting a class instance', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      class MyClass {
        value = 1
      }

      // Act / Assert
      expect(() => effectContext.setAnswer('field', new MyClass() as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', new MyClass() as any)).toThrow('MyClass instance')
    })

    it('should throw when setting a nested non-serializable value', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', { nested: () => {} } as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', { nested: () => {} } as any)).toThrow('Cannot set a function')
    })
  })

  describe('setData()', () => {
    it('should accept serializable values', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setData('key', 'value')).not.toThrow()
      expect(() => effectContext.setData('key', { items: [1, 2, 3] })).not.toThrow()
    })

    it('should throw when setting a function', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setData('key', (() => {}) as any)).toThrow(TypeError)
      expect(() => effectContext.setData('key', (() => {}) as any)).toThrow('Cannot set a function')
    })

    it('should throw when setting a Date object', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setData('key', new Date() as any)).toThrow(TypeError)
      expect(() => effectContext.setData('key', new Date() as any)).toThrow('use an ISO string instead')
    })
  })

  describe('getAnswer()', () => {
    it('should support typed contexts and call-level generic types', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { firstName: 'Ada', score: 42 },
      })
      const effectContext = new EffectFunctionContext<Record<string, unknown>, { firstName: string; score: number }>(
        mockContext,
        'access',
      )
      const untypedEffectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      const firstName = effectContext.getAnswer('firstName')
      const score = untypedEffectContext.getAnswer<number>('score')

      // Assert
      expectTypeOf(firstName).toEqualTypeOf<string>()
      expectTypeOf(score).toEqualTypeOf<number>()
      expect(firstName).toBe('Ada')
      expect(score).toBe(42)
    })
  })

  describe('getData()', () => {
    it('should support typed contexts and call-level generic types', () => {
      // Arrange
      const mockContext = createMockContext({
        mockData: { pageTitle: 'Example', count: 3 },
      })
      const effectContext = new EffectFunctionContext<{ pageTitle: string; count: number }, Record<string, unknown>>(
        mockContext,
        'access',
      )
      const untypedEffectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      const pageTitle = effectContext.getData('pageTitle')
      const count = untypedEffectContext.getData<number>('count')

      // Assert
      expectTypeOf(pageTitle).toEqualTypeOf<string>()
      expectTypeOf(count).toEqualTypeOf<number>()
      expect(pageTitle).toBe('Example')
      expect(count).toBe(3)
    })
  })

  describe('getPostData()', () => {
    it('should support call-level generic types for keyed post data', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          post: { action: 'remove_1', selected: ['a', 'b'] },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      const action = effectContext.getPostData<string>('action')

      // Assert
      expectTypeOf(action).toEqualTypeOf<string | undefined>()
      expect(action).toBe('remove_1')
    })
  })

  describe('getAllPostData()', () => {
    it('should support call-level generic types', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          post: { action: 'remove_1', selected: ['a', 'b'] },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      const postData = effectContext.getAllPostData<{
        action: string
        selected: string[]
      }>()

      // Assert
      expectTypeOf(postData).toEqualTypeOf<{ action: string; selected: string[] }>()
      expect(postData).toEqual({ action: 'remove_1', selected: ['a', 'b'] })
    })
  })

  describe('getRequestHeader()', () => {
    it('should return a request header value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          headers: { 'content-type': 'application/json', authorization: 'Bearer token123' },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      effectContext.setResponseHeader('X-Custom-Header', 'test-value')

      // Assert
      expect(mockContext.response.getHeader('X-Custom-Header')).toBe('test-value')
    })

    it('should overwrite an existing header', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      effectContext.setResponseHeader('X-Custom-Header', 'first-value')
      effectContext.setResponseHeader('X-Custom-Header', 'second-value')

      // Assert
      expect(mockContext.response.getHeader('X-Custom-Header')).toBe('second-value')
    })

    it('should throw when name is not a string', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setResponseHeader(123 as any, 'value')).toThrow(TypeError)
      expect(() => effectContext.setResponseHeader(123 as any, 'value')).toThrow('name must be a string')
    })

    it('should throw when value is not a string', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setResponseHeader('X-Header', {} as any)).toThrow(TypeError)
      expect(() => effectContext.setResponseHeader('X-Header', {} as any)).toThrow('value must be a string')
    })
  })

  describe('getResponseHeader()', () => {
    it('should return a previously set header', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')
      effectContext.setResponseHeader('X-Custom-Header', 'test-value')

      // Act
      const result = effectContext.getResponseHeader('X-Custom-Header')

      // Assert
      expect(result).toBe('test-value')
    })

    it('should return undefined for non-existent header', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')
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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      effectContext.setResponseCookie('session', 'abc123')

      // Assert
      const cookie = mockContext.response.getCookie('session')
      expect(cookie).toEqual({ value: 'abc123', options: undefined })
    })

    it('should set a cookie with options', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')
      effectContext.setResponseCookie('session', 'abc123')

      // Act
      effectContext.setResponseCookie('session', '', { maxAge: 0 })

      // Assert
      const cookie = mockContext.response.getCookie('session')
      expect(cookie).toEqual({ value: '', options: { maxAge: 0 } })
    })

    it('should throw when name is not a string', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setResponseCookie(123 as any, 'value')).toThrow(TypeError)
      expect(() => effectContext.setResponseCookie(123 as any, 'value')).toThrow('name must be a string')
    })

    it('should throw when value is not a string', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act / Assert
      expect(() => effectContext.setResponseCookie('session', 123 as any)).toThrow(TypeError)
      expect(() => effectContext.setResponseCookie('session', 123 as any)).toThrow('value must be a string')
    })
  })

  describe('getResponseCookie()', () => {
    it('should return a previously set cookie', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')
      effectContext.setResponseCookie('session', 'abc123', { httpOnly: true })

      // Act
      const result = effectContext.getResponseCookie('session')

      // Assert
      expect(result).toEqual({ value: 'abc123', options: { httpOnly: true } })
    })

    it('should return undefined for non-existent cookie', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext, 'access')
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
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      const result = effectContext.getAllResponseCookies()

      // Assert
      expect(result.size).toBe(0)
    })
  })

  describe('getFieldsToClear()', () => {
    it('should return the resolved field codes when the cleardown phase has run', () => {
      // Arrange
      const mockContext = createMockContext()

      mockContext.global.fieldsToClear = ['fieldA', 'note_1']

      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      const result = effectContext.getFieldsToClear()

      // Assert
      expect(result).toEqual(['fieldA', 'note_1'])
    })

    it('should return an empty array when the cleardown phase has not run', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      const result = effectContext.getFieldsToClear()

      // Assert
      expect(result).toEqual([])
    })

    it('should return a copy when callers mutate the returned array', () => {
      // Arrange
      const mockContext = createMockContext()

      mockContext.global.fieldsToClear = ['fieldA']

      const effectContext = new EffectFunctionContext(mockContext, 'access')

      // Act
      const result = effectContext.getFieldsToClear()
      result.push('fieldB')

      // Assert
      expect(mockContext.global.fieldsToClear).toEqual(['fieldA'])
    })
  })
})
