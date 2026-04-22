import { BlockType, ExpressionType, FunctionType } from '../../../../authoring/types/enums'
import { createMockInvoker, createMockInvokerWithError, createMockContext } from '../../../../testing/thunkTestHelpers'
import { ASTTestFactory } from '../../../../testing/ASTTestFactory'
import { ASTNode, NodeId } from '../../../types/engine.type'
import { PseudoNode } from '../../../types/pseudoNodes.type'
import AnswerLocalHandler from './AnswerLocalHandler'

describe('AnswerLocalHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should use formatter result when formatters exist', async () => {
      // Arrange
      const formatterNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('email')
        .withProperty('formatters', [formatterNode])
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('email')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('email', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: '  raw-value  ' }) // POST pseudo node
        .mockResolvedValueOnce({ value: 'raw-value' }) // formatter (trim)

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
          [formatterNode.id, formatterNode],
        ]),
        mockRequest: { method: 'POST', post: { email: '  raw-value  ' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('raw-value')
      expect(result.error).toBeUndefined()
      expect(mockContext.global.answers.email).toEqual({
        current: 'raw-value',
        mutations: [
          { value: '  raw-value  ', source: 'post' },
          { value: 'raw-value', source: 'processed' },
        ],
      })
    })

    it('should use raw POST value when formatters return undefined', async () => {
      // Arrange
      const formatterNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'transform')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('email')
        .withProperty('formatters', [formatterNode])
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('email')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('email', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: 'raw@example.com' }) // POST pseudo node
        .mockResolvedValueOnce({ value: undefined }) // formatter returns undefined

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
          [formatterNode.id, formatterNode],
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

    it('should use raw POST value when no formatters exist', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('name').build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('name')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('name', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({ value: 'John Doe' }) // POST pseudo node

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
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
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
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
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
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('optional').build()
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

    it('should preserve existing answer value from onAccess effects when no POST or defaultValue', async () => {
      // Arrange
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('preloaded').build()
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
        mutations: [{ value: 'value-from-api', source: 'access' }],
      })
    })

    it('should use existing answer over defaultValue when both exist', async () => {
      // Arrange - field with defaultValue but also existing answer from API
      const defaultValueNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
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
        mutations: [{ value: '123 Main Street', source: 'access' }],
      })
      // defaultValue should NOT have been invoked
      expect(mockInvoker.invoke).not.toHaveBeenCalled()
    })

    it('should use raw POST value when formatter returns error', async () => {
      // Arrange
      const formatterNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'transform')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('email')
        .withProperty('formatters', [formatterNode])
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('email')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('email', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: 'raw@example.com' }) // POST pseudo node
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: formatterNode.id,
            message: 'Formatter evaluation failed',
          },
        })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
          [formatterNode.id, formatterNode],
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
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
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

    it('should return undefined on GET when defaultValue returns error', async () => {
      // Arrange
      const defaultValueNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
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
      mockContext.nodeRegistry.get = vi.fn().mockReturnValue(undefined)

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
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('town').build()
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
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('town').build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('town')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('town', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      // POST returns new value from user
      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({ value: 'Manchester' }) // POST pseudo node

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        // Previously loaded from API with source 'access'
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
          { value: 'London', source: 'access' },
          { value: 'Manchester', source: 'post' },
        ],
      })
    })

    it('should clear answer when dependentWhen condition is false on POST', async () => {
      // Arrange - field with dependentWhen condition that evaluates to false
      const dependentNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('conditionalField')
        .withProperty('dependentWhen', dependentNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('conditionalField')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('conditionalField', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: 'user-input' }) // POST pseudo node
        .mockResolvedValueOnce({ value: false }) // dependentWhen condition

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { conditionalField: 'user-input' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - value is cleared because dependentWhen is false
      expect(result.value).toBeUndefined()
      expect(mockContext.global.answers.conditionalField).toEqual({
        current: undefined,
        mutations: [
          { value: 'user-input', source: 'post' },
          { value: undefined, source: 'dependentWhen' },
        ],
      })
    })

    it('should keep answer when dependentWhen condition is true on POST', async () => {
      // Arrange - field with dependentWhen condition that evaluates to true
      const dependentNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('conditionalField')
        .withProperty('dependentWhen', dependentNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('conditionalField')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('conditionalField', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: 'user-input' }) // POST pseudo node
        .mockResolvedValueOnce({ value: true }) // dependentWhen condition

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
        ]),
        mockRequest: { method: 'POST', post: { conditionalField: 'user-input' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - value is kept because dependentWhen is true
      expect(result.value).toBe('user-input')
      expect(mockContext.global.answers.conditionalField).toEqual({
        current: 'user-input',
        mutations: [{ value: 'user-input', source: 'post' }],
      })
    })

    it('should keep answer when dependentWhen evaluation returns error on POST', async () => {
      // Arrange - dependentWhen condition evaluation fails
      const dependentNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('conditionalField')
        .withProperty('dependentWhen', dependentNode)
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('conditionalField')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('conditionalField', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: 'user-input' }) // POST pseudo node
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: dependentNode.id,
            message: 'dependentWhen evaluation failed',
          },
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

      // Assert - value is kept because dependentWhen evaluation failed (fail open)
      expect(result.value).toBe('user-input')
      expect(mockContext.global.answers.conditionalField).toEqual({
        current: 'user-input',
        mutations: [{ value: 'user-input', source: 'post' }],
      })
    })

    it('should not check dependentWhen condition on GET request', async () => {
      // Arrange - field with dependentWhen condition, but request is GET
      const dependentNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('conditionalField')
        .withProperty('dependentWhen', dependentNode)
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

      // Assert - value is returned without checking dependentWhen (GET doesn't check dependentWhen)
      expect(result.value).toBe('existing-value')
      // dependentWhen node should NOT have been invoked
      expect(mockInvoker.invoke).not.toHaveBeenCalledWith(dependentNode.id, mockContext)
    })
  })

  describe('formatter execution', () => {
    it('should execute multiple formatters in sequence', async () => {
      // Arrange
      const trimFormatter = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')
      const upperFormatter = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'toUpperCase')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('name')
        .withProperty('formatters', [trimFormatter, upperFormatter])
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('name')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('name', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: '  hello  ' }) // POST
        .mockResolvedValueOnce({ value: 'hello' }) // trim formatter
        .mockResolvedValueOnce({ value: 'HELLO' }) // toUpperCase formatter

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
          [trimFormatter.id, trimFormatter],
          [upperFormatter.id, upperFormatter],
        ]),
        mockRequest: { method: 'POST', post: { name: '  hello  ' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('HELLO')
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
    })

    it('should push value onto scope as @value for each formatter', async () => {
      // Arrange
      const formatterNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'double')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('number')
        .withProperty('formatters', [formatterNode])
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('number')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('number', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: '5' }) // POST
        .mockResolvedValueOnce({ value: '10' }) // formatter

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
          [formatterNode.id, formatterNode],
        ]),
        mockRequest: { method: 'POST', post: { number: '5' } },
      })

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert - scope should have been pushed with @value
      // After evaluation, scope should be empty (popped)
      expect(mockContext.scope.length).toBe(0)
    })
  })

  describe('parser execution', () => {
    it('should apply parser to existing answer on GET', async () => {
      // Arrange
      const parserNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'fromISO')
      const fieldNode = ASTTestFactory.block('DateInput', BlockType.FIELD)
        .withCode('date_of_birth')
        .withProperty('parsers', [parserNode])
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('date_of_birth', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({ value: { day: '15', month: '01', year: '2024' } })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [parserNode.id, parserNode],
        ]),
        mockAnswers: { date_of_birth: '2024-01-15' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ day: '15', month: '01', year: '2024' })
      expect(mockContext.global.answers.date_of_birth.current).toBe('2024-01-15')
      expect(mockContext.global.answers.date_of_birth.parsed).toEqual({ day: '15', month: '01', year: '2024' })
    })

    it('should apply parser to default value on GET', async () => {
      // Arrange
      const parserNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'fromISO')
      const fieldNode = ASTTestFactory.block('DateInput', BlockType.FIELD)
        .withCode('start_date')
        .withProperty('defaultValue', '2024-06-01')
        .withProperty('parsers', [parserNode])
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('start_date', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({ value: { day: '01', month: '06', year: '2024' } })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [parserNode.id, parserNode],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ day: '01', month: '06', year: '2024' })
      expect(mockContext.global.answers.start_date.current).toBe('2024-06-01')
      expect(mockContext.global.answers.start_date.parsed).toEqual({ day: '01', month: '06', year: '2024' })
    })

    it('should NOT run parsers on POST', async () => {
      // Arrange
      const formatterNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'toISO')
      const parserNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'fromISO')
      const fieldNode = ASTTestFactory.block('DateInput', BlockType.FIELD)
        .withCode('date')
        .withProperty('formatters', [formatterNode])
        .withProperty('parsers', [parserNode])
        .build()
      const postPseudoNode = ASTTestFactory.postPseudoNode('date')
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('date', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: '15/01/2024' }) // POST
        .mockResolvedValueOnce({ value: '2024-01-15' }) // formatter

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [postPseudoNode.id, postPseudoNode],
          [formatterNode.id, formatterNode],
          [parserNode.id, parserNode],
        ]),
        mockRequest: { method: 'POST', post: { date: '15/01/2024' } },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('2024-01-15')
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
      expect(mockInvoker.invoke).not.toHaveBeenCalledWith(parserNode.id, mockContext)
    })

    it('should NOT modify history.current when parser runs', async () => {
      // Arrange
      const parserNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'split')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('tags')
        .withProperty('parsers', [parserNode])
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('tags', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({ value: ['a', 'b', 'c'] })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [parserNode.id, parserNode],
        ]),
        mockAnswers: { tags: 'a,b,c' },
      })

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockContext.global.answers.tags.current).toBe('a,b,c')
      expect(mockContext.global.answers.tags.mutations).toEqual([{ value: 'a,b,c', source: 'access' }])
    })

    it('should chain multiple parsers sequentially', async () => {
      // Arrange
      const parser1 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'split')
      const parser2 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'first')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('value')
        .withProperty('parsers', [parser1, parser2])
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('value', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({ value: ['a', 'b', 'c'] }) // parser1
        .mockResolvedValueOnce({ value: 'a' }) // parser2

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [parser1.id, parser1],
          [parser2.id, parser2],
        ]),
        mockAnswers: { value: 'a,b,c' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('a')
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should push and pop scope correctly for parsers', async () => {
      // Arrange
      const parserNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'parse')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('field')
        .withProperty('parsers', [parserNode])
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('field', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({ value: 'parsed' })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [parserNode.id, parserNode],
        ]),
        mockAnswers: { field: 'stored' },
      })

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockContext.scope.length).toBe(0)
    })

    it('should preserve value when parser returns undefined', async () => {
      // Arrange
      const parserNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'noop')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('field')
        .withProperty('parsers', [parserNode])
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('field', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({ value: undefined })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [parserNode.id, parserNode],
        ]),
        mockAnswers: { field: 'original' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('original')
    })

    it('should preserve value when parser returns error', async () => {
      // Arrange
      const parserNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'failing')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('field')
        .withProperty('parsers', [parserNode])
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('field', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({
        error: {
          type: 'EVALUATION_FAILED',
          nodeId: parserNode.id,
          message: 'Parser failed',
        },
      })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [parserNode.id, parserNode],
        ]),
        mockAnswers: { field: 'original' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('original')
      expect(result.error).toBeUndefined()
    })

    it('should not set history.parsed when value is unchanged', async () => {
      // Arrange
      const parserNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'identity')
      const fieldNode = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('field')
        .withProperty('parsers', [parserNode])
        .build()
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('field', fieldNode.id)
      const handler = new AnswerLocalHandler(pseudoNode.id, pseudoNode)

      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({ value: 'same-value' })

      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode | PseudoNode>([
          [fieldNode.id, fieldNode],
          [parserNode.id, parserNode],
        ]),
        mockAnswers: { field: 'same-value' },
      })

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockContext.global.answers.field.parsed).toBeUndefined()
    })
  })
})
