import { ExpressionType, LogicType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ThunkResult } from '@form-engine/core/ast/thunks/types'
import { NextASTNode } from '@form-engine/core/types/expressions.type'
import NextHandler from './NextHandler'

describe('NextHandler', () => {

  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return goto value when there is no when condition', async () => {
      // Arrange
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', '/next-step')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/next-step')
    })

    it('should return goto value when when condition is truthy', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', '/success')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/success')
    })

    it('should return undefined when when condition is falsy', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', '/success')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should evaluate goto when it is an AST node', async () => {
      // Arrange
      const gotoNode = ASTTestFactory.reference(['data', 'nextPath'])
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', gotoNode)
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: '/dynamic-path' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/dynamic-path')
    })

    it('should evaluate both when and goto when both are AST nodes', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const gotoNode = ASTTestFactory.reference(['data', 'nextPath'])
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', gotoNode)
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, '/conditional-path'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/conditional-path')
    })

    it('should handle truthy numeric value in when condition', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', '/next')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 1 })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/next')
    })

    it('should handle truthy string value in when condition', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', '/next')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 'yes' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/next')
    })

    it('should handle null as falsy in when condition', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', '/next')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: null })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should handle undefined as falsy in when condition', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', '/next')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: undefined })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should handle 0 as falsy in when condition', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', '/next')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 0 })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should handle empty string as falsy in when condition', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', '/next')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: '' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when when condition evaluation fails', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', '/next')
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ nodeId: whenNode.id })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return undefined when goto evaluation fails', async () => {
      // Arrange
      const gotoNode = ASTTestFactory.reference(['data', 'missing'])
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', gotoNode)
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ nodeId: gotoNode.id })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return undefined when goto evaluation fails after when condition passes', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const gotoNode = ASTTestFactory.reference(['data', 'missing'])
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', gotoNode)
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      let callIndex = 0
      const mockInvoker = createMockInvoker({
        invokeImpl: async (): Promise<ThunkResult> => {
          if (callIndex === 0) {
            callIndex += 1

            return {
              value: true,
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

          callIndex += 1

          return {
            error: {
              type: 'EVALUATION_FAILED',
              nodeId: gotoNode.id,
              message: 'Evaluation failed',
            },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should not evaluate goto when when condition is falsy', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(LogicType.TEST)
      const gotoNode = ASTTestFactory.reference(['data', 'path'])
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', gotoNode)
        .build()
      const handler = new NextHandler(nextNode.id, nextNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      // Should only have been called once for the when condition
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
      expect(mockInvoker.invoke).toHaveBeenCalledWith(whenNode.id, mockContext)
    })
  })
})
