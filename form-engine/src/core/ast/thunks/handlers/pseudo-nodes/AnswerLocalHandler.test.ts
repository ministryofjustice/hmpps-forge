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
      const postPseudoNode = ASTTestFactory.postPseudoNode('email')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('email', fieldNode.id)
      const mockInvoker = createSequentialMockInvoker(['raw-value', 'user@example.com'])
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { email: 'raw-value' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('user@example.com')
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.email).toEqual({
        current: 'user@example.com',
        mutations: [
          { value: 'raw-value', source: 'post' },
          { value: 'user@example.com', source: 'processed' },
        ],
      })
    })

    it('should use raw POST value when formatPipeline returns undefined', async () => {
      // Arrange
      const formatPipelineNode = ASTTestFactory.expression(ExpressionType.PIPELINE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('email')
        .withProperty('formatPipeline', formatPipelineNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('email')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('email', fieldNode.id)
      const mockInvoker = createSequentialMockInvoker(['raw@example.com', undefined])
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { email: 'raw@example.com' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('raw@example.com')
      expect(mockContext.global.answers.email).toEqual({
        current: 'raw@example.com',
        mutations: [{ value: 'raw@example.com', source: 'post' }],
      })
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
        mockRequest: { method: 'POST', post: { name: 'John Doe' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('John Doe')
      expect(mockContext.global.answers.name).toEqual({
        current: 'John Doe',
        mutations: [{ value: 'John Doe', source: 'post' }],
      })
      expect(mockInvoker.invoke).toHaveBeenCalledWith(postPseudoNode.id, mockContext)
    })

    it('should use defaultValue on GET when no existing answer', async () => {
      // Arrange
      const defaultValueNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('country')
        .withProperty('defaultValue', defaultValueNode)
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('country', fieldNode.id)
      const mockInvoker = createMockInvoker({ defaultValue: 'UK' })
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([[fieldNode.id, fieldNode]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('UK')
      expect(mockContext.global.answers.country).toEqual({
        current: 'UK',
        mutations: [{ value: 'UK', source: 'default' }],
      })
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
      expect(mockContext.global.answers.status).toEqual({
        current: 'pending',
        mutations: [{ value: 'pending', source: 'default' }],
      })
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
      expect(mockContext.global.answers.optional).toEqual({
        current: undefined,
        mutations: [{ value: undefined, source: 'default' }],
      })
    })

    it('should preserve existing answer value from onLoad effects when no POST or defaultValue', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('TextInput', 'field').withCode('preloaded').build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('preloaded', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockInvoker = createMockInvoker()
      const mockContext = createMockContext({
        mockNodes: new Map([[fieldNode.id, fieldNode]]),
        mockAnswers: { preloaded: 'value-from-api' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('value-from-api')
      // History unchanged - still has original load mutation
      expect(mockContext.global.answers.preloaded).toEqual({
        current: 'value-from-api',
        mutations: [{ value: 'value-from-api', source: 'load' }],
      })
    })

    it('should use existing answer over defaultValue when both exist', async () => {
      // Arrange - field with defaultValue but also existing answer from API
      const defaultValueNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('address')
        .withProperty('defaultValue', defaultValueNode)
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('address', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      // DefaultValue would return empty string, but we have existing answer
      const mockInvoker = createMockInvoker({ defaultValue: '' })
      const mockContext = createMockContext({
        mockNodes: new Map([[fieldNode.id, fieldNode]]),
        mockAnswers: { address: '123 Main Street' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - existing answer should take precedence over defaultValue
      expect(result.value).toBe('123 Main Street')
      // History unchanged - still has original load mutation
      expect(mockContext.global.answers.address).toEqual({
        current: '123 Main Street',
        mutations: [{ value: '123 Main Street', source: 'load' }],
      })
      // defaultValue should NOT have been invoked
      expect(mockInvoker.invoke).not.toHaveBeenCalled()
    })

    it('should use raw POST value when formatPipeline returns error', async () => {
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
          value: 'raw@example.com',
          metadata: { source: 'POST', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: formatPipelineNode.id,
            message: 'Pipeline evaluation failed',
          },
          metadata: { source: 'formatPipeline', timestamp: Date.now() },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { email: 'raw@example.com' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('raw@example.com')
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.email).toEqual({
        current: 'raw@example.com',
        mutations: [{ value: 'raw@example.com', source: 'post' }],
      })
    })

    it('should return undefined on POST when POST pseudo node returns error', async () => {
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
      mockInvoker.invoke.mockResolvedValueOnce({
        error: {
          type: 'EVALUATION_FAILED',
          nodeId: postPseudoNode.id,
          message: 'POST access failed',
        },
        metadata: { source: 'POST', timestamp: Date.now() },
      })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { country: 'any' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.country).toEqual({
        current: undefined,
        mutations: [{ value: undefined, source: 'post' }],
      })
    })

    it('should return undefined on POST when both POST and formatPipeline return errors', async () => {
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
            nodeId: postPseudoNode.id,
            message: 'POST failed',
          },
          metadata: { source: 'POST', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: formatPipelineNode.id,
            message: 'Pipeline failed',
          },
          metadata: { source: 'formatPipeline', timestamp: Date.now() },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { status: 'any' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.status).toEqual({
        current: undefined,
        mutations: [{ value: undefined, source: 'post' }],
      })
    })

    it('should return undefined on GET when defaultValue returns error', async () => {
      // Arrange
      const defaultValueNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('failing')
        .withProperty('defaultValue', defaultValueNode)
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('failing', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockInvoker = createMockInvokerWithError()
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([[fieldNode.id, fieldNode]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.failing).toEqual({
        current: undefined,
        mutations: [{ value: undefined, source: 'default' }],
      })
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

    it('should protect action-set answers from POST override', async () => {
      // Arrange - simulating postcode lookup scenario
      // An action effect has set 'town' to 'Birmingham' with source 'action'
      // POST data has empty string for 'town' (user didn't type anything)
      const fieldNode = ASTTestFactory.block('TextInput', 'field').withCode('town').build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('town')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('town', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      // POST would return empty string, but we have action-set answer
      const mockInvoker = createMockInvoker({ defaultValue: '' })
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        // Simulating answer set by onAction effect (e.g., postcode lookup)
        mockAnswers: {
          town: {
            current: 'Birmingham',
            mutations: [{ value: 'Birmingham', source: 'action' }],
          },
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - action-set answer is protected, POST is NOT invoked
      expect(result.value).toBe('Birmingham')
      expect(mockContext.global.answers.town).toEqual({
        current: 'Birmingham',
        mutations: [{ value: 'Birmingham', source: 'action' }],
      })
      // POST handler should NOT have been called because action takes precedence
      expect(mockInvoker.invoke).not.toHaveBeenCalled()
    })

    it('should allow POST to override load-set answers', async () => {
      // Arrange - user editing a previously saved value
      const fieldNode = ASTTestFactory.block('TextInput', 'field').withCode('town').build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('town')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('town', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      // POST returns new value from user
      const mockInvoker = createMockInvoker({ defaultValue: 'Manchester' })
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        // Previously loaded from API with source 'load'
        mockAnswers: { town: 'London' },
        mockRequest: { method: 'POST', post: { town: 'Manchester' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - load-set answer CAN be overridden by POST, mutation appended
      expect(result.value).toBe('Manchester')
      expect(mockContext.global.answers.town).toEqual({
        current: 'Manchester',
        mutations: [
          { value: 'London', source: 'load' },
          { value: 'Manchester', source: 'post' },
        ],
      })
    })

    it('should clear answer when dependent condition is false on POST', async () => {
      // Arrange - field with dependent condition that evaluates to false
      const dependentNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('conditionalField')
        .withProperty('dependent', dependentNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('conditionalField')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('conditionalField', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({
          value: 'user-input',
          metadata: { source: 'POST', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          value: false,
          metadata: { source: 'dependent', timestamp: Date.now() },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { conditionalField: 'user-input' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - value is cleared because dependent is false
      expect(result.value).toBeUndefined()
      expect(mockContext.global.answers.conditionalField).toEqual({
        current: undefined,
        mutations: [
          { value: 'user-input', source: 'post' },
          { value: undefined, source: 'dependent' },
        ],
      })
    })

    it('should keep answer when dependent condition is true on POST', async () => {
      // Arrange - field with dependent condition that evaluates to true
      const dependentNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('conditionalField')
        .withProperty('dependent', dependentNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('conditionalField')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('conditionalField', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({
          value: 'user-input',
          metadata: { source: 'POST', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          value: true,
          metadata: { source: 'dependent', timestamp: Date.now() },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { conditionalField: 'user-input' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - value is kept because dependent is true
      expect(result.value).toBe('user-input')
      expect(mockContext.global.answers.conditionalField).toEqual({
        current: 'user-input',
        mutations: [{ value: 'user-input', source: 'post' }],
      })
    })

    it('should keep answer when dependent evaluation returns error on POST', async () => {
      // Arrange - dependent condition evaluation fails
      const dependentNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('conditionalField')
        .withProperty('dependent', dependentNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('conditionalField')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('conditionalField', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({
          value: 'user-input',
          metadata: { source: 'POST', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: dependentNode.id,
            message: 'Dependent evaluation failed',
          },
          metadata: { source: 'dependent', timestamp: Date.now() },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { conditionalField: 'user-input' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - value is kept because dependent evaluation failed (fail open)
      expect(result.value).toBe('user-input')
      expect(mockContext.global.answers.conditionalField).toEqual({
        current: 'user-input',
        mutations: [{ value: 'user-input', source: 'post' }],
      })
    })

    it('should not check dependent condition on GET request', async () => {
      // Arrange - field with dependent condition, but request is GET
      const dependentNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('conditionalField')
        .withProperty('dependent', dependentNode)
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('conditionalField', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([[fieldNode.id, fieldNode]]),
        mockAnswers: { conditionalField: 'existing-value' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - value is returned without checking dependent (GET doesn't check dependent)
      expect(result.value).toBe('existing-value')
      // Dependent node should NOT have been invoked
      expect(mockInvoker.invoke).not.toHaveBeenCalledWith(dependentNode.id, mockContext)
    })
  })

  describe('sanitization', () => {
    it('should sanitize string values with HTML characters by default', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('TextInput', 'field').withCode('comment').build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('comment')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('comment', fieldNode.id)
      const mockInvoker = createMockInvoker({ defaultValue: '<script>alert("xss")</script>' })
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { comment: '<script>alert("xss")</script>' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(mockContext.global.answers.comment).toEqual({
        current: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
        mutations: [
          { value: '<script>alert("xss")</script>', source: 'post' },
          { value: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', source: 'sanitized' },
        ],
      })
    })

    it('should not add sanitized mutation when value has no HTML characters', async () => {
      // Arrange - value has no characters to escape
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
        mockRequest: { method: 'POST', post: { name: 'John Doe' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - no 'sanitized' mutation because value didn't change
      expect(result.value).toBe('John Doe')
      expect(mockContext.global.answers.name).toEqual({
        current: 'John Doe',
        mutations: [{ value: 'John Doe', source: 'post' }],
      })
    })

    it('should skip sanitization when sanitize is explicitly false', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('htmlContent')
        .withProperty('sanitize', false)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('htmlContent')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('htmlContent', fieldNode.id)
      const mockInvoker = createMockInvoker({ defaultValue: '<b>Bold</b>' })
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { htmlContent: '<b>Bold</b>' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - raw HTML preserved
      expect(result.value).toBe('<b>Bold</b>')
      expect(mockContext.global.answers.htmlContent).toEqual({
        current: '<b>Bold</b>',
        mutations: [{ value: '<b>Bold</b>', source: 'post' }],
      })
    })

    it('should not sanitize non-string values like arrays', async () => {
      // Arrange - array of values (checkboxes)
      const fieldNode = ASTTestFactory.block('CheckboxInput', 'field')
        .withCode('options')
        .withProperty('multiple', true)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('options')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('options', fieldNode.id)
      const mockInvoker = createMockInvoker({ defaultValue: ['<a>', '<b>'] })
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { options: ['<a>', '<b>'] } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - arrays pass through unchanged (sanitizeValue only affects strings)
      expect(result.value).toEqual(['<a>', '<b>'])
      expect(mockContext.global.answers.options).toEqual({
        current: ['<a>', '<b>'],
        mutations: [{ value: ['<a>', '<b>'], source: 'post' }],
      })
    })

    it('should sanitize before formatPipeline runs', async () => {
      // Arrange
      const formatPipelineNode = ASTTestFactory.expression(ExpressionType.PIPELINE).build()
      const fieldNode = ASTTestFactory.block('TextInput', 'field')
        .withCode('email')
        .withProperty('formatPipeline', formatPipelineNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('email')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('email', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      // Pipeline receives sanitized value and transforms it further (e.g., uppercase)
      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({
          value: '<script>test</script>',
          metadata: { source: 'POST', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          value: '&LT;SCRIPT&GT;TEST&LT;/SCRIPT&GT;', // Pipeline uppercased sanitized value
          metadata: { source: 'formatPipeline', timestamp: Date.now() },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { email: '<script>test</script>' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - mutations show full pipeline: post -> sanitized -> processed
      expect(result.value).toBe('&LT;SCRIPT&GT;TEST&LT;/SCRIPT&GT;')
      expect(mockContext.global.answers.email).toEqual({
        current: '&LT;SCRIPT&GT;TEST&LT;/SCRIPT&GT;',
        mutations: [
          { value: '<script>test</script>', source: 'post' },
          { value: '&lt;script&gt;test&lt;/script&gt;', source: 'sanitized' },
          { value: '&LT;SCRIPT&GT;TEST&LT;/SCRIPT&GT;', source: 'processed' },
        ],
      })
    })

    it('should sanitize common XSS payloads', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('TextInput', 'field').withCode('input').build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('input')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('input', fieldNode.id)
      const mockInvoker = createMockInvoker({ defaultValue: '<img src=x onerror="alert(\'XSS\')">' })
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { input: '<img src=x onerror="alert(\'XSS\')">' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('&lt;img src=x onerror=&quot;alert(&#39;XSS&#39;)&quot;&gt;')
    })
  })
})
