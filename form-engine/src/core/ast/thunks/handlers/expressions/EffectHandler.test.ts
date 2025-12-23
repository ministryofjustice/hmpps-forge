import { FunctionType } from '@form-engine/form/types/enums'
import { FunctionRegistryEntry } from '@form-engine/registry/types/functions.type'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import EffectHandler from './EffectHandler'

describe('EffectHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should execute effect with no arguments', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'save')

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'save',
        evaluate: jest.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['save', mockEffectFn]]),
      })

      // Push transition type to scope (as transition handlers do)
      mockContext.scope.push({ '@transitionType': 'load' })

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledTimes(1)
    })

    it('should execute effect with primitive arguments', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'saveAnswer', [
        'email',
        'test@example.com',
      ])

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'saveAnswer',
        evaluate: jest.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['saveAnswer', mockEffectFn]]),
      })

      mockContext.scope.push({ '@transitionType': 'action' })

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({ context: mockContext, transitionType: 'action' }),
        'email',
        'test@example.com',
      )
    })

    it('should evaluate AST node arguments before passing to effect', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'email'])
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logValue', [refNode])

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'logValue',
        evaluate: jest.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['logValue', mockEffectFn]]),
      })

      mockContext.scope.push({ '@transitionType': 'submit' })

      const mockInvoker = createMockInvoker({ defaultValue: 'captured@example.com' })
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledWith(refNode.id, mockContext)
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({ transitionType: 'submit' }),
        'captured@example.com',
      )
    })

    it('should handle mix of primitive and AST node arguments', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'count'])
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'setData', ['itemCount', refNode, true])

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'setData',
        evaluate: jest.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['setData', mockEffectFn]]),
      })

      mockContext.scope.push({ '@transitionType': 'load' })

      const mockInvoker = createMockInvoker({ defaultValue: 42 })
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({ transitionType: 'load' }),
        'itemCount',
        42,
        true,
      )
    })

    it('should use undefined for failed argument evaluations', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'missing'])
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logValue', [refNode])

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'logValue',
        evaluate: jest.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['logValue', mockEffectFn]]),
      })

      mockContext.scope.push({ '@transitionType': 'load' })

      const mockInvoker = createMockInvokerWithError({
        nodeId: refNode.id,
        message: 'Reference not found',
      })

      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(expect.anything(), undefined)
    })

    it('should return error when effect function not found', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'unknownEffect', ['key', 'value'])

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map(), // Empty - no effects registered
      })

      mockContext.scope.push({ '@transitionType': 'load' })

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('unknownEffect')
    })

    it('should evaluate arguments in parallel', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['answers', 'first'])
      const ref2 = ASTTestFactory.reference(['answers', 'second'])
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'multiArg', [ref1, ref2])

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'multiArg',
        evaluate: jest.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['multiArg', mockEffectFn]]),
      })

      mockContext.scope.push({ '@transitionType': 'action' })

      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([
          [ref1.id, 'value1'],
          [ref2.id, 'value2'],
        ]),
      })

      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(expect.anything(), 'value1', 'value2')
    })

    it('should pass complex object arguments to effect', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'addToCollection', [
        'addresses',
        { street: '', city: '', postcode: '' },
      ])

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'addToCollection',
        evaluate: jest.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['addToCollection', mockEffectFn]]),
      })

      mockContext.scope.push({ '@transitionType': 'submit' })

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(expect.anything(), 'addresses', {
        street: '',
        city: '',
        postcode: '',
      })
    })

    it('should default to load transition type when scope is empty', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'track')

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'track',
        evaluate: jest.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['track', mockEffectFn]]),
      })

      // Don't push anything to scope - should default to 'load'

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(expect.objectContaining({ transitionType: 'load' }))
    })

    it('should read @transitionType from scope', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'track')

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'track',
        evaluate: jest.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['track', mockEffectFn]]),
      })

      // Push access transition type to scope
      mockContext.scope.push({ '@transitionType': 'access' })

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(expect.objectContaining({ transitionType: 'access' }))
    })
  })
})
