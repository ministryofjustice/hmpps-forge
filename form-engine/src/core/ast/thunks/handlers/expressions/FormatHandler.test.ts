import { FormatASTNode } from '@form-engine/core/types/expressions.type'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import FormatHandler from './FormatHandler'

/**
 * Helper to create a format AST node for testing
 */
function createFormatNode(template: string, args: unknown[]): FormatASTNode {
  return ASTTestFactory.expression<FormatASTNode>(ExpressionType.FORMAT)
    .withProperty('template', template)
    .withProperty('arguments', args)
    .build()
}

describe('FormatHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate', () => {
    it('should return template unchanged when no placeholders', async () => {
      // Arrange
      const formatNode = createFormatNode('Hello World', [])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Hello World')
    })

    it('should substitute single placeholder with primitive argument', async () => {
      // Arrange
      const formatNode = createFormatNode('Hello %1', ['to whoever reviews this'])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Hello to whoever reviews this')
    })

    it('should substitute multiple placeholders with primitive arguments', async () => {
      // Arrange
      const formatNode = createFormatNode('Hello %1, you are %2 years old', ['Tom', 28])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Hello Tom, you are 28 years old')
    })

    it('should evaluate AST node arguments before substitution', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'name'])
      const formatNode = createFormatNode('Welcome %1!', [refNode])

      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        returnValueMap: new Map([[refNode.id, 'Alice']]),
      })

      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledWith(refNode.id, mockContext)
      expect(result.value).toBe('Welcome Alice!')
    })

    it('should handle mix of primitive and AST node arguments', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['data', 'itemId'])
      const formatNode = createFormatNode('/items/%1/edit?version=%2', [refNode, 'v2'])

      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        returnValueMap: new Map([[refNode.id, 'item_123']]),
      })

      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('/items/item_123/edit?version=v2')
    })

    it('should use empty string for out of bounds placeholders', async () => {
      // Arrange
      const formatNode = createFormatNode('Value: %1, Missing: %2, Also missing: %3', ['present'])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Value: present, Missing: , Also missing: ')
    })

    it('should use empty string for null argument values', async () => {
      // Arrange
      const formatNode = createFormatNode('Value: %1', [null])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Value: ')
    })

    it('should use empty string for undefined argument values', async () => {
      // Arrange
      const formatNode = createFormatNode('Value: %1', [undefined])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Value: ')
    })

    it('should use empty string for failed argument evaluations', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'missing'])
      const formatNode = createFormatNode('Value: %1', [refNode])

      const mockContext = createMockContext()
      const invoker = createMockInvokerWithError({ nodeId: refNode.id, message: 'Reference not found' })

      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Value: ')
    })

    it('should handle same placeholder used multiple times', async () => {
      // Arrange
      const formatNode = createFormatNode('%1 is %1 and %2 is %2', ['A', 'B'])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('A is A and B is B')
    })

    it('should convert number arguments to strings', async () => {
      // Arrange
      const formatNode = createFormatNode('Price: £%1', [12.99])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Price: £12.99')
    })

    it('should convert boolean arguments to strings', async () => {
      // Arrange
      const formatNode = createFormatNode('Active: %1, Verified: %2', [true, false])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Active: true, Verified: false')
    })

    it('should evaluate arguments in parallel', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['data', 'first'])
      const ref2 = ASTTestFactory.reference(['data', 'second'])
      const formatNode = createFormatNode('%1 and %2', [ref1, ref2])

      const mockContext = createMockContext()
      const invoker = createMockInvoker({
        returnValueMap: new Map([
          [ref1.id, 'First'],
          [ref2.id, 'Second'],
        ]),
      })

      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
      expect(result.value).toBe('First and Second')
    })

    it('should handle %0 placeholder as out of bounds', async () => {
      // Arrange
      const formatNode = createFormatNode('Zero: %0, One: %1', ['first'])
      const mockContext = createMockContext()
      const invoker = createMockInvoker()
      const handler = new FormatHandler(formatNode.id, formatNode)

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Zero: , One: first')
    })
  })
})
