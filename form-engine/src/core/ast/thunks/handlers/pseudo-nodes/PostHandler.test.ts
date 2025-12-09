import PostHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/PostHandler'
import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'

describe('PostHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return POST value for existing field', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('email')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { email: 'user@example.com' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('user@example.com')
      expect(result.error).toBeUndefined()
    })

    it('should return undefined for non-existent field', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('missingField')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { email: 'user@example.com' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return first non-empty value from array when no fieldNodeId', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('interests')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { interests: ['coding', 'reading', 'gaming'] } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('coding')
      expect(result.error).toBeUndefined()
    })

    it('should return full array when field has multiple: true', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('CheckboxInput', 'field')
        .withCode('interests')
        .withProperty('multiple', true)
        .build()
      const pseudoNode = ASTTestFactory.postPseudoNode('interests', fieldNode.id)
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { interests: ['coding', 'reading', 'gaming'] } },
        mockNodes: new Map<NodeId, ASTNode>([[fieldNode.id, fieldNode]]),
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toEqual(['coding', 'reading', 'gaming'])
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should wrap single value in array when field has multiple: true', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('CheckboxInput', 'field')
        .withCode('interests')
        .withProperty('multiple', true)
        .build()
      const pseudoNode = ASTTestFactory.postPseudoNode('interests', fieldNode.id)
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { interests: 'coding' } },
        mockNodes: new Map<NodeId, ASTNode>([[fieldNode.id, fieldNode]]),
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toEqual(['coding'])
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return undefined when field is not in POST even with multiple: true', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('CheckboxInput', 'field')
        .withCode('interests')
        .withProperty('multiple', true)
        .build()
      const pseudoNode = ASTTestFactory.postPseudoNode('interests', fieldNode.id)
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: {} },
        mockNodes: new Map<NodeId, ASTNode>([[fieldNode.id, fieldNode]]),
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return empty array when field has multiple: true and value is null', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('CheckboxInput', 'field')
        .withCode('interests')
        .withProperty('multiple', true)
        .build()
      const pseudoNode = ASTTestFactory.postPseudoNode('interests', fieldNode.id)
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { interests: null } },
        mockNodes: new Map<NodeId, ASTNode>([[fieldNode.id, fieldNode]]),
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toEqual([])
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return first non-empty value when field has multiple: false', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('CheckboxInput', 'field')
        .withCode('selections')
        .withProperty('multiple', false)
        .build()
      const pseudoNode = ASTTestFactory.postPseudoNode('selections', fieldNode.id)
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { selections: ['', 'first', 'second'] } },
        mockNodes: new Map<NodeId, ASTNode>([[fieldNode.id, fieldNode]]),
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('first')
      expect(result.error).toBeUndefined()
    })

    it('should skip empty strings when finding first non-empty value', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('choices')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { choices: ['', '  ', 'actual-value', 'another'] } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('actual-value')
      expect(result.error).toBeUndefined()
    })

    it('should return raw unformatted value', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('name')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { name: '  JOHN DOE  ' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('  JOHN DOE  ')
      expect(result.error).toBeUndefined()
    })

    it('should handle empty string values', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('optionalField')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { optionalField: '' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('')
      expect(result.error).toBeUndefined()
    })

    it('should store nodeId correctly', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('test')

      // Act
      const handler = new PostHandler(pseudoNode.id, pseudoNode)

      // Assert
      expect(handler.nodeId).toBe(pseudoNode.id)
    })
  })
})
