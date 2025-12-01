import { ExpressionType } from '@form-engine/form/types/enums'
import AnswerLocalHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/AnswerLocalHandler'
import {
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
  createMockContext,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { PseudoNode } from '@form-engine/core/types/pseudoNodes.type'

describe('AnswerLocalHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should use formatPipeline result when formatPipeline exists', async () => {
      // Arrange
      const formatPipelineNode = ASTTestFactory.expression(ExpressionType.PIPELINE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('email')
        .withProperty('formatPipeline', formatPipelineNode)
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('email', fieldNode.id)
      const mockInvoker = createMockInvoker({ defaultValue: 'user@example.com' })
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map([[fieldNode.id, fieldNode]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('user@example.com')
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.email).toBe('user@example.com')
      expect(mockInvoker.invoke).toHaveBeenCalledWith(formatPipelineNode.id, mockContext)
    })

    it('should fall back to POST when formatPipeline returns undefined', async () => {
      // Arrange
      const formatPipelineNode = ASTTestFactory.expression(ExpressionType.PIPELINE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('email')
        .withProperty('formatPipeline', formatPipelineNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('email')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('email', fieldNode.id)
      const mockInvoker = createSequentialMockInvoker([undefined, 'raw@example.com'])
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('raw@example.com')
      expect(mockContext.global.answers.email).toBe('raw@example.com')
    })

    it('should use raw POST value when no formatPipeline exists', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('TextInput', 'field').withCode('name').build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('name')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('name', fieldNode.id)
      const mockInvoker = createMockInvoker({ defaultValue: 'John Doe' })
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('John Doe')
      expect(mockContext.global.answers.name).toBe('John Doe')
      expect(mockInvoker.invoke).toHaveBeenCalledWith(postPseudoNode.id, mockContext)
    })

    it('should fall back to defaultValue when POST is undefined', async () => {
      // Arrange
      const defaultValueNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('country')
        .withProperty('defaultValue', defaultValueNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('country')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('country', fieldNode.id)
      const mockInvoker = createSequentialMockInvoker([undefined, 'UK'])
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('UK')
      expect(mockContext.global.answers.country).toBe('UK')
      expect(mockInvoker.invoke).toHaveBeenCalledWith(defaultValueNode.id, mockContext)
    })

    it('should use literal defaultValue when defaultValue is a literal', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('status')
        .withProperty('defaultValue', 'pending')
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('status')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('status', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockInvoker = createMockInvoker({ defaultValue: undefined })
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('pending')
      expect(mockContext.global.answers.status).toBe('pending')
    })

    it('should return undefined and store undefined in answers when all sources return undefined', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('TextInput', 'field').withCode('optional').build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('optional', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockInvoker = createMockInvoker()
      const mockContext = createMockContext({
        mockNodes: new Map([[fieldNode.id, fieldNode]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockContext.global.answers.optional).toBeUndefined()
    })

    it('should fall back to POST when formatPipeline returns error', async () => {
      // Arrange
      const formatPipelineNode = ASTTestFactory.expression(ExpressionType.PIPELINE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('email')
        .withProperty('formatPipeline', formatPipelineNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('email')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('email', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: formatPipelineNode.id,
            message: 'Pipeline evaluation failed',
          },
          metadata: { source: 'formatPipeline', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          value: 'fallback@example.com',
          metadata: { source: 'POST', timestamp: Date.now() },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('fallback@example.com')
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.email).toBe('fallback@example.com')
    })

    it('should fall back to defaultValue when POST returns error', async () => {
      // Arrange
      const defaultValueNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('country')
        .withProperty('defaultValue', defaultValueNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('country')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('country', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: postPseudoNode.id,
            message: 'POST access failed',
          },
          metadata: { source: 'POST', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          value: 'UK',
          metadata: { source: 'defaultValue', timestamp: Date.now() },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('UK')
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.country).toBe('UK')
    })

    it('should fall back through all steps when formatPipeline and POST both return errors', async () => {
      // Arrange
      const formatPipelineNode = ASTTestFactory.expression(ExpressionType.PIPELINE).build()
      const defaultValueNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('status')
        .withProperty('formatPipeline', formatPipelineNode)
        .withProperty('defaultValue', defaultValueNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('status')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('status', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: formatPipelineNode.id,
            message: 'Pipeline failed',
          },
          metadata: { source: 'formatPipeline', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: postPseudoNode.id,
            message: 'POST failed',
          },
          metadata: { source: 'POST', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          value: 'default-status',
          metadata: { source: 'defaultValue', timestamp: Date.now() },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('default-status')
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.status).toBe('default-status')
    })

    it('should return undefined when all steps return errors', async () => {
      // Arrange
      const formatPipelineNode = ASTTestFactory.expression(ExpressionType.PIPELINE).build()
      const defaultValueNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('failing')
        .withProperty('formatPipeline', formatPipelineNode)
        .withProperty('defaultValue', defaultValueNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('failing')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('failing', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockInvoker = createMockInvokerWithError()
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.failing).toBeUndefined()
    })

    it('should return error result when field node is not found', async () => {
      // Arrange
      const missingFieldNodeId = ASTTestFactory.getId()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('missing', missingFieldNodeId)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockInvoker = createMockInvoker()
      const mockContext = createMockContext()
      mockContext.nodeRegistry.get = jest.fn().mockReturnValue(undefined)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.type).toBe('LOOKUP_FAILED')
      expect(result.error?.message).toContain(`Node "${missingFieldNodeId}" not found`)
      expect(result.value).toBeUndefined()
    })
  })
})
