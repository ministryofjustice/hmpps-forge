import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext, createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { CompileAstNodeId, ASTNode } from '@form-engine/core/types/engine.type'
import BaseReferenceHandler from './BaseReferenceHandler'

/**
 * Create a reference node with a base expression
 */
function createReferenceWithBase(base: ASTNode, path: string[]): ReferenceASTNode {
  return {
    id: `compile_ast:${Math.random().toString(36).slice(2)}` as CompileAstNodeId,
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.REFERENCE,
    properties: { base, path },
    raw: { type: ExpressionType.REFERENCE, path, base: {} },
  }
}

describe('BaseReferenceHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should evaluate base expression and return result when path is empty', async () => {
      // Arrange
      const baseNode = ASTTestFactory.reference(['data', 'items'])
      const referenceNode = createReferenceWithBase(baseNode, [])
      const handler = new BaseReferenceHandler(referenceNode.id, referenceNode)

      const baseResult = { id: 1, name: 'Test Item' }
      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        returnValueMap: new Map([[baseNode.id, baseResult]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toEqual(baseResult)
    })

    it('should evaluate base expression and navigate into result using path', async () => {
      // Arrange
      const baseNode = ASTTestFactory.reference(['data', 'items'])
      const referenceNode = createReferenceWithBase(baseNode, ['name'])
      const handler = new BaseReferenceHandler(referenceNode.id, referenceNode)

      const baseResult = { id: 1, name: 'Test Item', goals: ['goal1', 'goal2'] }
      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        returnValueMap: new Map([[baseNode.id, baseResult]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Test Item')
    })

    it('should navigate deeply nested paths after base evaluation', async () => {
      // Arrange
      const baseNode = ASTTestFactory.reference(['data', 'user'])
      const referenceNode = createReferenceWithBase(baseNode, ['profile', 'settings', 'theme'])
      const handler = new BaseReferenceHandler(referenceNode.id, referenceNode)

      const baseResult = {
        profile: {
          settings: {
            theme: 'dark',
          },
        },
      }
      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        returnValueMap: new Map([[baseNode.id, baseResult]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('dark')
    })

    it('should return array property from base result', async () => {
      // Arrange - simulates: Literal(areas).each(Iterator.Find(...)).path('goals')
      const baseNode = ASTTestFactory.reference(['data', 'areas'])
      const referenceNode = createReferenceWithBase(baseNode, ['goals'])
      const handler = new BaseReferenceHandler(referenceNode.id, referenceNode)

      const baseResult = {
        slug: 'accommodation',
        goals: ['Goal 1', 'Goal 2', 'Goal 3'],
      }
      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        returnValueMap: new Map([[baseNode.id, baseResult]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toEqual(['Goal 1', 'Goal 2', 'Goal 3'])
    })

    it('should return undefined when base evaluation returns error', async () => {
      // Arrange
      const baseNode = ASTTestFactory.reference(['data', 'missing'])
      const referenceNode = createReferenceWithBase(baseNode, ['name'])
      const handler = new BaseReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        invokeImpl: async () => ({
          error: { type: 'EVALUATION_FAILED' as const, nodeId: baseNode.id, message: 'Not found' },
        }),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.error).toBeDefined()
    })

    it('should return undefined for non-existent path in base result', async () => {
      // Arrange
      const baseNode = ASTTestFactory.reference(['data', 'item'])
      const referenceNode = createReferenceWithBase(baseNode, ['nonexistent', 'path'])
      const handler = new BaseReferenceHandler(referenceNode.id, referenceNode)

      const baseResult = { id: 1, name: 'Test' }
      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        returnValueMap: new Map([[baseNode.id, baseResult]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when base is not set', async () => {
      // Arrange - edge case: base is undefined (shouldn't happen but handle gracefully)
      const referenceNode: ReferenceASTNode = {
        id: 'compile_ast:test' as CompileAstNodeId,
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.REFERENCE,
        properties: { path: ['name'], base: undefined },
        raw: { type: ExpressionType.REFERENCE, path: ['name'] },
      }
      const handler = new BaseReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext()
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })
  })

  describe('evaluateSync()', () => {
    it('should evaluate base synchronously and navigate into result', () => {
      // Arrange
      const baseNode = ASTTestFactory.reference(['data', 'item'])
      const referenceNode = createReferenceWithBase(baseNode, ['value'])
      const handler = new BaseReferenceHandler(referenceNode.id, referenceNode)

      const baseResult = { value: 42 }
      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        returnValueMap: new Map([[baseNode.id, baseResult]]),
      })

      // Act
      const result = handler.evaluateSync(mockContext, invoker)

      // Assert
      expect(result.value).toBe(42)
    })
  })
})
