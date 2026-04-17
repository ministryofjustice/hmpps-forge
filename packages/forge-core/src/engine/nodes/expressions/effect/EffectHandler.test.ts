import { ExpressionType, FunctionType } from '../../../../authoring/types/enums'
import { FunctionRegistryEntry } from '../../../../authoring/types/functions.type'
import { ASTTestFactory } from '../../../../testing/ASTTestFactory'
import { createMockContext, createMockInvoker, createMockInvokerWithError } from '../../../../testing/thunkTestHelpers'
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
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['save', mockEffectFn]]),
      })

      // Push hook type to scope (as hook handlers do)
      mockContext.scope.push({ '@hookType': 'access' })

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
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['saveAnswer', mockEffectFn]]),
      })

      mockContext.scope.push({ '@hookType': 'action' })

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({ context: mockContext, hookType: 'action' }),
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
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['logValue', mockEffectFn]]),
        mockNodes: new Map([[refNode.id, refNode]]),
      })

      mockContext.scope.push({ '@hookType': 'submit' })

      const mockInvoker = createMockInvoker({ defaultValue: 'captured@example.com' })
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledWith(refNode.id, mockContext)
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({ hookType: 'submit' }),
        'captured@example.com',
      )
    })

    it('should handle mix of primitive and AST node arguments', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'count'])
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'setData', ['itemCount', refNode, true])

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'setData',
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['setData', mockEffectFn]]),
        mockNodes: new Map([[refNode.id, refNode]]),
      })

      mockContext.scope.push({ '@hookType': 'access' })

      const mockInvoker = createMockInvoker({ defaultValue: 42 })
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({ hookType: 'access' }),
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
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['logValue', mockEffectFn]]),
      })

      mockContext.scope.push({ '@hookType': 'access' })

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

      mockContext.scope.push({ '@hookType': 'access' })

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
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['multiArg', mockEffectFn]]),
        mockNodes: new Map([
          [ref1.id, ref1],
          [ref2.id, ref2],
        ]),
      })

      mockContext.scope.push({ '@hookType': 'action' })

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
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['addToCollection', mockEffectFn]]),
      })

      mockContext.scope.push({ '@hookType': 'submit' })

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

    it('should evaluate nested AST nodes within object arguments', async () => {
      // Arrange
      const formatNode = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', 'You added a goal to %1 plan')
        .withProperty('arguments', [])
        .build()
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'addNotification', [
        {
          type: 'success',
          title: 'Success',
          message: formatNode,
          target: 'plan-overview',
        },
      ])

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'addNotification',
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['addNotification', mockEffectFn]]),
        mockNodes: new Map([[formatNode.id, formatNode]]),
      })

      mockContext.scope.push({ '@hookType': 'submit' })

      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[formatNode.id, 'You added a goal to John plan']]),
      })

      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockInvoker.invoke).toHaveBeenCalledWith(formatNode.id, mockContext)
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(expect.anything(), {
        type: 'success',
        title: 'Success',
        message: 'You added a goal to John plan',
        target: 'plan-overview',
      })
    })

    it('should default to load hook type when scope is empty', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'track')

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'track',
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['track', mockEffectFn]]),
      })

      // Don't push anything to scope - should default to 'access'

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(expect.objectContaining({ hookType: 'access' }))
    })

    it('should read @hookType scope key from scope', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'track')

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'track',
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['track', mockEffectFn]]),
      })

      // Push access hook type to scope
      mockContext.scope.push({ '@hookType': 'access' })

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockEffectFn.evaluate).toHaveBeenCalledWith(expect.objectContaining({ hookType: 'access' }))
    })
  })
})
