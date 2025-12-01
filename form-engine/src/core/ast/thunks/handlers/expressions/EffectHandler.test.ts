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
    it('should capture effect name and nodeId with no arguments', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'save')
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        effectName: 'save',
        args: [],
        nodeId: effectNode.id,
      })
    })

    it('should capture effect with primitive arguments', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'saveAnswer', [
        'email',
        'test@example.com',
      ])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        effectName: 'saveAnswer',
        args: ['email', 'test@example.com'],
        nodeId: effectNode.id,
      })
    })

    it('should evaluate AST node arguments to concrete values', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'email'])
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logValue', [refNode])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 'captured@example.com' })
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledWith(refNode.id, mockContext)
      expect(result.value).toEqual({
        effectName: 'logValue',
        args: ['captured@example.com'],
        nodeId: effectNode.id,
      })
    })

    it('should handle mix of primitive and AST node arguments', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'count'])
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'setData', ['itemCount', refNode, true])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 42 })
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        effectName: 'setData',
        args: ['itemCount', 42, true],
        nodeId: effectNode.id,
      })
    })

    it('should use undefined for failed argument evaluations', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'missing'])
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logValue', [refNode])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({
        nodeId: refNode.id,
        message: 'Reference not found',
      })
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        effectName: 'logValue',
        args: [undefined],
        nodeId: effectNode.id,
      })
    })

    it('should NOT execute the effect function', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'saveAnswer', ['key', 'value'])

      const mockEffectFn: FunctionRegistryEntry = {
        name: 'saveAnswer',
        evaluate: jest.fn(),
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['saveAnswer', mockEffectFn]]),
      })

      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert - the effect function should NOT have been called
      expect(mockEffectFn.evaluate).not.toHaveBeenCalled()
    })

    it('should evaluate arguments in parallel', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['answers', 'first'])
      const ref2 = ASTTestFactory.reference(['answers', 'second'])
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'multiArg', [ref1, ref2])
      const mockContext = createMockContext()
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
      expect(result.value).toEqual({
        effectName: 'multiArg',
        args: ['value1', 'value2'],
        nodeId: effectNode.id,
      })
    })

    it('should capture complex object arguments', async () => {
      // Arrange
      const effectNode = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'addToCollection', [
        'addresses',
        { street: '', city: '', postcode: '' },
      ])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()
      const handler = new EffectHandler(effectNode.id, effectNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        effectName: 'addToCollection',
        args: ['addresses', { street: '', city: '', postcode: '' }],
        nodeId: effectNode.id,
      })
    })
  })
})
