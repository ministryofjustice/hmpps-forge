import { createMockContext } from '../../../compilation/ast/testing-helpers/runtimeContextTestHelpers'
import { EffectFunctionContext } from './EffectFunctionContext'

describe('EffectFunctionContext', () => {
  describe('setAnswer()', () => {
    it('should accept serializable values', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', (() => {}) as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', (() => {}) as any)).toThrow('Cannot set a function')
    })

    it('should throw when setting a Symbol', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', Symbol('test') as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', Symbol('test') as any)).toThrow('Cannot set a Symbol')
    })

    it('should throw when setting a Date object', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', new Date() as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', new Date() as any)).toThrow('use an ISO string instead')
    })

    it('should throw when setting a BigInt', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', BigInt(123) as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', BigInt(123) as any)).toThrow('Cannot set a BigInt')
    })

    it('should throw when setting a class instance', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setAnswer('field', { nested: () => {} } as any)).toThrow(TypeError)
      expect(() => effectContext.setAnswer('field', { nested: () => {} } as any)).toThrow('Cannot set a function')
    })
  })

  describe('setData()', () => {
    it('should accept serializable values', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setData('key', 'value')).not.toThrow()
      expect(() => effectContext.setData('key', { items: [1, 2, 3] })).not.toThrow()
    })

    it('should throw when setting a function', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setData('key', (() => {}) as any)).toThrow(TypeError)
      expect(() => effectContext.setData('key', (() => {}) as any)).toThrow('Cannot set a function')
    })

    it('should throw when setting a Date object', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
        mockContext.context,
        mockContext.response,
        'access',
      )
      const untypedEffectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const firstName = effectContext.getAnswer('firstName')
      const score = untypedEffectContext.getAnswer<number>('score')

      // Assert
      expectTypeOf(firstName).toEqualTypeOf<string>()
      expectTypeOf(score).toEqualTypeOf<number>()
      expect(firstName).toBe('Ada')
      expect(score).toBe(42)
    })

    it('should throw TypeError when assigning a top-level property on an object answer', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const profile = effectContext.getAnswer<{ name: string }>('profile')

      // Assert
      expect(() => {
        profile.name = 'Grace'
      }).toThrow(TypeError)
      expect(() => {
        profile.name = 'Grace'
      }).toThrow(/Cannot set property 'name'/)
      expect(() => {
        profile.name = 'Grace'
      }).toThrow(/read-only/)
    })

    it('should throw TypeError when assigning a nested property on an object answer', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { profile: { nested: { value: 'initial' } } },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const profile = effectContext.getAnswer<{ nested: { value: string } }>('profile')

      // Assert
      expect(() => {
        profile.nested.value = 'changed'
      }).toThrow(TypeError)
      expect(() => {
        profile.nested.value = 'changed'
      }).toThrow(/Cannot set property 'value'/)
    })

    it('should throw TypeError when pushing to an array answer', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { tags: ['a', 'b'] },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const tags = effectContext.getAnswer<string[]>('tags')

      // Assert
      expect(() => tags.push('c')).toThrow(TypeError)
      expect(() => tags.push('c')).toThrow(/read-only/)
    })

    it('should throw TypeError when splicing an array answer', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { tags: ['a', 'b'] },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const tags = effectContext.getAnswer<string[]>('tags')

      // Assert
      expect(() => tags.splice(0, 1)).toThrow(TypeError)
      expect(() => tags.splice(0, 1)).toThrow(/read-only/)
    })

    it('should throw TypeError when deleting a property from an object answer', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const profile = effectContext.getAnswer<{ name?: string }>('profile')

      // Assert
      expect(() => {
        delete profile.name
      }).toThrow(TypeError)
      expect(() => {
        delete profile.name
      }).toThrow(/Cannot delete property 'name'/)
    })

    it('should return the same proxy when called twice for the same answer', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const first = effectContext.getAnswer('profile')
      const second = effectContext.getAnswer('profile')

      // Assert
      expect(first).toBe(second)
    })

    it('should return primitive answers unchanged', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { firstName: 'Ada', score: 42 },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const firstName = effectContext.getAnswer('firstName')
      const score = effectContext.getAnswer('score')

      // Assert
      expect(firstName).toBe('Ada')
      expect(score).toBe(42)
    })
  })

  describe('getAllAnswers()', () => {
    it('should return current values for all answers', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { firstName: 'Ada', profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const answers = effectContext.getAllAnswers()

      // Assert
      expect(answers).toEqual({ firstName: 'Ada', profile: { name: 'Ada' } })
    })

    it('should throw TypeError when setting a key on the returned object', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { firstName: 'Ada' },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const answers = effectContext.getAllAnswers()

      // Assert
      expect(() => {
        answers.lastName = 'Lovelace'
      }).toThrow(TypeError)
      expect(() => {
        answers.lastName = 'Lovelace'
      }).toThrow(/Cannot set property 'lastName'/)
    })

    it('should throw TypeError when mutating a nested answer value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext<Record<string, unknown>, { profile: { name: string } }>(
        mockContext.context,
        mockContext.response,
        'access',
      )

      // Act
      const answers = effectContext.getAllAnswers()

      // Assert
      expect(() => {
        answers.profile.name = 'Grace'
      }).toThrow(TypeError)
      expect(() => {
        answers.profile.name = 'Grace'
      }).toThrow(/read-only/)
    })

    it('should return the same nested proxy as getAnswer() for the same key', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext<Record<string, unknown>, { profile: { name: string } }>(
        mockContext.context,
        mockContext.response,
        'access',
      )

      // Act
      const fromAll = effectContext.getAllAnswers().profile
      const fromSingle = effectContext.getAnswer('profile')

      // Assert
      expect(fromAll).toBe(fromSingle)
    })
  })

  describe('getAnswerHistory()', () => {
    it('should throw TypeError when pushing to the mutations array', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { firstName: 'Ada' },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const history = effectContext.getAnswerHistory('firstName')

      // Assert
      expect(() => history?.mutations.push({ value: 'Grace', source: 'submit' })).toThrow(TypeError)
      expect(() => history?.mutations.push({ value: 'Grace', source: 'submit' })).toThrow(/read-only/)
    })

    it('should throw TypeError when overwriting current', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { firstName: 'Ada' },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const history = effectContext.getAnswerHistory('firstName')

      // Assert
      expect(() => {
        if (history !== undefined) {
          history.current = 'Grace'
        }
      }).toThrow(TypeError)
      expect(() => {
        if (history !== undefined) {
          history.current = 'Grace'
        }
      }).toThrow(/Cannot set property 'current'/)
    })

    it('should return undefined when the answer does not exist', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const history = effectContext.getAnswerHistory('missing')

      // Assert
      expect(history).toBeUndefined()
    })
  })

  describe('getAllAnswerHistories()', () => {
    it('should throw TypeError when adding an answer key to the returned record', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { firstName: 'Ada' },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const histories = effectContext.getAllAnswerHistories()

      // Assert
      expect(() => {
        histories.lastName = { current: 'Lovelace', mutations: [] }
      }).toThrow(TypeError)
      expect(() => {
        histories.lastName = { current: 'Lovelace', mutations: [] }
      }).toThrow(/Cannot set property 'lastName'/)
    })

    it('should return the same proxy when called twice', () => {
      // Arrange
      const mockContext = createMockContext({
        mockAnswers: { firstName: 'Ada' },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const first = effectContext.getAllAnswerHistories()
      const second = effectContext.getAllAnswerHistories()

      // Assert
      expect(first).toBe(second)
    })
  })

  describe('getData()', () => {
    it('should support typed contexts and call-level generic types', () => {
      // Arrange
      const mockContext = createMockContext({
        mockData: { pageTitle: 'Example', count: 3 },
      })
      const effectContext = new EffectFunctionContext<{ pageTitle: string; count: number }, Record<string, unknown>>(
        mockContext.context,
        mockContext.response,
        'access',
      )
      const untypedEffectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const pageTitle = effectContext.getData('pageTitle')
      const count = untypedEffectContext.getData<number>('count')

      // Assert
      expectTypeOf(pageTitle).toEqualTypeOf<string>()
      expectTypeOf(count).toEqualTypeOf<number>()
      expect(pageTitle).toBe('Example')
      expect(count).toBe(3)
    })

    it('should throw TypeError when assigning a property on an object data value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockData: { profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const profile = effectContext.getData<{ name: string }>('profile')

      // Assert
      expect(() => {
        profile.name = 'Grace'
      }).toThrow(TypeError)
      expect(() => {
        profile.name = 'Grace'
      }).toThrow(/Cannot set property 'name'/)
      expect(() => {
        profile.name = 'Grace'
      }).toThrow(/read-only/)
    })

    it('should throw TypeError when pushing to an array data value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockData: { tags: ['a', 'b'] },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const tags = effectContext.getData<string[]>('tags')

      // Assert
      expect(() => tags.push('c')).toThrow(TypeError)
      expect(() => tags.push('c')).toThrow(/read-only/)
    })

    it('should return the same proxy when called twice for the same key', () => {
      // Arrange
      const mockContext = createMockContext({
        mockData: { profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const first = effectContext.getData('profile')
      const second = effectContext.getData('profile')

      // Assert
      expect(first).toBe(second)
    })

    it('should return primitive data values unchanged', () => {
      // Arrange
      const mockContext = createMockContext({
        mockData: { pageTitle: 'Example', count: 3 },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const pageTitle = effectContext.getData('pageTitle')
      const count = effectContext.getData('count')

      // Assert
      expect(pageTitle).toBe('Example')
      expect(count).toBe(3)
    })
  })

  describe('getAllData()', () => {
    it('should return all stored data', () => {
      // Arrange
      const mockContext = createMockContext({
        mockData: { pageTitle: 'Example', profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const data = effectContext.getAllData()

      // Assert
      expect(data).toEqual({ pageTitle: 'Example', profile: { name: 'Ada' } })
    })

    it('should throw TypeError when setting a key on the returned object', () => {
      // Arrange
      const mockContext = createMockContext({
        mockData: { pageTitle: 'Example' },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const data = effectContext.getAllData()

      // Assert
      expect(() => {
        data.subtitle = 'Extra'
      }).toThrow(TypeError)
      expect(() => {
        data.subtitle = 'Extra'
      }).toThrow(/Cannot set property 'subtitle'/)
    })

    it('should throw TypeError when mutating a nested data value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockData: { profile: { name: 'Ada' } },
      })
      const effectContext = new EffectFunctionContext<{ profile: { name: string } }, Record<string, unknown>>(
        mockContext.context,
        mockContext.response,
        'access',
      )

      // Act
      const data = effectContext.getAllData()

      // Assert
      expect(() => {
        data.profile.name = 'Grace'
      }).toThrow(TypeError)
      expect(() => {
        data.profile.name = 'Grace'
      }).toThrow(/read-only/)
    })
  })

  describe('getQueryParam()', () => {
    it('should throw TypeError when pushing to a multi-value query param', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          query: { filter: ['active', 'pending'] },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const filter = effectContext.getQueryParam('filter')

      // Assert
      expect(() => (filter as string[]).push('archived')).toThrow(TypeError)
      expect(() => (filter as string[]).push('archived')).toThrow(/read-only/)
    })

    it('should return string values unchanged', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          query: { page: '1' },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const page = effectContext.getQueryParam('page')

      // Assert
      expect(page).toBe('1')
    })
  })

  describe('getAllQueryParams()', () => {
    it('should throw TypeError when setting a key on the returned object', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          query: { page: '1' },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const query = effectContext.getAllQueryParams()

      // Assert
      expect(() => {
        query.filter = 'active'
      }).toThrow(TypeError)
      expect(() => {
        query.filter = 'active'
      }).toThrow(/Cannot set property 'filter'/)
    })

    it('should throw TypeError when pushing to an array value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          query: { filter: ['active', 'pending'] },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const query = effectContext.getAllQueryParams()

      // Assert
      expect(() => (query.filter as string[]).push('archived')).toThrow(TypeError)
      expect(() => (query.filter as string[]).push('archived')).toThrow(/read-only/)
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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const action = effectContext.getPostData<string>('action')

      // Assert
      expectTypeOf(action).toEqualTypeOf<string | undefined>()
      expect(action).toBe('remove_1')
    })

    it('should throw TypeError when pushing to an array post value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          post: { selected: ['a', 'b'] },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const selected = effectContext.getPostData<string[]>('selected')

      // Assert
      expect(() => selected?.push('c')).toThrow(TypeError)
      expect(() => selected?.push('c')).toThrow(/read-only/)
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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const postData = effectContext.getAllPostData<{
        action: string
        selected: string[]
      }>()

      // Assert
      expectTypeOf(postData).toEqualTypeOf<{ action: string; selected: string[] }>()
      expect(postData).toEqual({ action: 'remove_1', selected: ['a', 'b'] })
    })

    it('should throw TypeError when setting a key on the returned object', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          post: { action: 'remove_1' },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const postData = effectContext.getAllPostData()

      // Assert
      expect(() => {
        postData.extra = 'value'
      }).toThrow(TypeError)
      expect(() => {
        postData.extra = 'value'
      }).toThrow(/Cannot set property 'extra'/)
    })
  })

  describe('getState()', () => {
    it('should throw TypeError when mutating an object state value', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          state: { profile: { name: 'Ada' } },
        },
      })
      const effectContext = new EffectFunctionContext<
        Record<string, unknown>,
        Record<string, unknown>,
        unknown,
        { profile: { name: string } }
      >(mockContext.context, mockContext.response, 'access')

      // Act
      const profile = effectContext.getState('profile')

      // Assert
      expect(() => {
        if (profile !== undefined) {
          profile.name = 'Grace'
        }
      }).toThrow(TypeError)
      expect(() => {
        if (profile !== undefined) {
          profile.name = 'Grace'
        }
      }).toThrow(/Cannot set property 'name'/)
    })

    it('should return the same proxy when called twice for the same key', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          state: { profile: { name: 'Ada' } },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const first = effectContext.getState('profile')
      const second = effectContext.getState('profile')

      // Assert
      expect(first).toBe(second)
    })
  })

  describe('getAllState()', () => {
    it('should throw TypeError when setting a key on the returned object', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          state: { profile: { name: 'Ada' } },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const state = effectContext.getAllState()

      // Assert
      expect(() => {
        state.extra = 'value'
      }).toThrow(TypeError)
      expect(() => {
        state.extra = 'value'
      }).toThrow(/Cannot set property 'extra'/)
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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const result = effectContext.getRequestHeader('set-cookie')

      // Assert
      expect(result).toEqual(['cookie1=value1', 'cookie2=value2'])
    })

    it('should throw TypeError when pushing to a multi-value header', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          headers: { 'set-cookie': ['cookie1=value1', 'cookie2=value2'] },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const result = effectContext.getRequestHeader('set-cookie')

      // Assert
      expect(() => (result as string[]).push('cookie3=value3')).toThrow(TypeError)
      expect(() => (result as string[]).push('cookie3=value3')).toThrow(/read-only/)
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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const result = effectContext.getAllRequestHeaders()

      // Assert
      expect(result).toEqual({})
    })

    it('should throw TypeError when setting a key on the returned object', () => {
      // Arrange
      const mockContext = createMockContext({
        mockRequest: {
          headers: { 'content-type': 'application/json' },
        },
      })
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const result = effectContext.getAllRequestHeaders()

      // Assert
      expect(() => {
        result.accept = 'text/html'
      }).toThrow(TypeError)
      expect(() => {
        result.accept = 'text/html'
      }).toThrow(/Cannot set property 'accept'/)
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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

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
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      effectContext.setResponseHeader('X-Custom-Header', 'test-value')

      // Assert
      expect(vi.mocked(mockContext.response.setHeader)).toHaveBeenCalledWith('X-Custom-Header', 'test-value')
    })

    it('should overwrite an existing header', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      effectContext.setResponseHeader('X-Custom-Header', 'first-value')
      effectContext.setResponseHeader('X-Custom-Header', 'second-value')

      // Assert
      expect(vi.mocked(mockContext.response.setHeader)).toHaveBeenLastCalledWith('X-Custom-Header', 'second-value')
    })

    it('should throw when name is not a string', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setResponseHeader(123 as any, 'value')).toThrow(TypeError)
      expect(() => effectContext.setResponseHeader(123 as any, 'value')).toThrow('name must be a string')
    })

    it('should throw when value is not a string', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setResponseHeader('X-Header', {} as any)).toThrow(TypeError)
      expect(() => effectContext.setResponseHeader('X-Header', {} as any)).toThrow('value must be a string')
    })
  })

  describe('setResponseCookie()', () => {
    it('should set a cookie in the response', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      effectContext.setResponseCookie('session', 'abc123')

      // Assert
      expect(vi.mocked(mockContext.response.setCookie)).toHaveBeenCalledWith('session', 'abc123', undefined)
    })

    it('should set a cookie with options', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      effectContext.setResponseCookie('preference', 'dark', {
        maxAge: 86400000,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      })

      // Assert
      expect(vi.mocked(mockContext.response.setCookie)).toHaveBeenCalledWith('preference', 'dark', {
        maxAge: 86400000,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      })
    })

    it('should overwrite an existing cookie', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      effectContext.setResponseCookie('session', 'first')
      effectContext.setResponseCookie('session', 'second')

      // Assert
      expect(vi.mocked(mockContext.response.setCookie)).toHaveBeenLastCalledWith('session', 'second', undefined)
    })

    it('should clear a cookie by setting maxAge to 0', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')
      effectContext.setResponseCookie('session', 'abc123')

      // Act
      effectContext.setResponseCookie('session', '', { maxAge: 0 })

      // Assert
      expect(vi.mocked(mockContext.response.setCookie)).toHaveBeenLastCalledWith('session', '', { maxAge: 0 })
    })

    it('should throw when name is not a string', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setResponseCookie(123 as any, 'value')).toThrow(TypeError)
      expect(() => effectContext.setResponseCookie(123 as any, 'value')).toThrow('name must be a string')
    })

    it('should throw when value is not a string', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act / Assert
      expect(() => effectContext.setResponseCookie('session', 123 as any)).toThrow(TypeError)
      expect(() => effectContext.setResponseCookie('session', 123 as any)).toThrow('value must be a string')
    })
  })

  describe('getFieldsToClear()', () => {
    it('should return the field codes the cleardown phase resolved', () => {
      // Arrange
      const mockContext = createMockContext()

      mockContext.context.evaluation.fieldsToClear = ['fieldA', 'fieldB']

      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const result = effectContext.getFieldsToClear()

      // Assert
      expect(result).toEqual(['fieldA', 'fieldB'])
    })

    it('should return a copy so callers cannot mutate the stored codes', () => {
      // Arrange
      const mockContext = createMockContext()

      mockContext.context.evaluation.fieldsToClear = ['fieldA']

      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const result = effectContext.getFieldsToClear()
      result.push('fieldB')

      // Assert
      expect(mockContext.context.evaluation.fieldsToClear).toEqual(['fieldA'])
    })

    it('should return empty array when the cleardown phase has not run', () => {
      // Arrange
      const mockContext = createMockContext()
      const effectContext = new EffectFunctionContext(mockContext.context, mockContext.response, 'access')

      // Act
      const result = effectContext.getFieldsToClear()

      // Assert
      expect(result).toEqual([])
    })
  })
})
