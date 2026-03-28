import { PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import { MetadataComputationDependencies } from '@form-engine/core/compilation/thunks/types'
import ThrowErrorOutcomeHandler from './ThrowErrorOutcomeHandler'

describe('ThrowErrorOutcomeHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return error data when there is no when condition', async () => {
      // Arrange
      const errorNode = ASTTestFactory.throwErrorOutcome({ status: 404, message: 'Not found' })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ status: 404, message: 'Not found' })
    })

    it('should return error data when when condition is truthy', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const errorNode = ASTTestFactory.throwErrorOutcome({ when: whenNode, status: 403, message: 'Forbidden' })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ status: 403, message: 'Forbidden' })
    })

    it('should return undefined when when condition is falsy', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const errorNode = ASTTestFactory.throwErrorOutcome({ when: whenNode, status: 500, message: 'Error' })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should evaluate message when it is an AST node', async () => {
      // Arrange
      const messageNode = ASTTestFactory.reference(['data', 'errorMessage'])
      const errorNode = ASTTestFactory.throwErrorOutcome({ status: 400, message: messageNode })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 'Dynamic error message' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ status: 400, message: 'Dynamic error message' })
    })

    it('should evaluate both when and message when both are AST nodes', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const messageNode = ASTTestFactory.reference(['data', 'errorMessage'])
      const errorNode = ASTTestFactory.throwErrorOutcome({ when: whenNode, status: 500, message: messageNode })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, 'Conditional error'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ status: 500, message: 'Conditional error' })
    })

    it('should return undefined when when condition evaluation fails', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const errorNode = ASTTestFactory.throwErrorOutcome({ when: whenNode, status: 404, message: 'Not found' })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ nodeId: whenNode.id })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should convert numeric message value to string', async () => {
      // Arrange
      const messageNode = ASTTestFactory.reference(['data', 'errorCode'])
      const errorNode = ASTTestFactory.throwErrorOutcome({ status: 500, message: messageNode })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 12345 })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ status: 500, message: '12345' })
    })

    it('should return empty string message when message evaluation returns undefined', async () => {
      // Arrange
      const messageNode = ASTTestFactory.reference(['data', 'missing'])
      const errorNode = ASTTestFactory.throwErrorOutcome({ status: 500, message: messageNode })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: undefined })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ status: 500, message: '' })
    })

    it('should not evaluate message when when condition is falsy', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const messageNode = ASTTestFactory.reference(['data', 'message'])
      const errorNode = ASTTestFactory.throwErrorOutcome({ when: whenNode, status: 404, message: messageNode })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
      expect(mockInvoker.invoke).toHaveBeenCalledWith(whenNode.id, mockContext)
    })

    it('should handle different HTTP status codes', async () => {
      // Arrange
      const statusCodes = [400, 401, 403, 404, 409, 500, 502, 503]

      for (const status of statusCodes) {
        ASTTestFactory.resetIds()
        const errorNode = ASTTestFactory.throwErrorOutcome({ status, message: 'Error' })
        const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker()

        // Act
        // eslint-disable-next-line no-await-in-loop
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value?.status).toBe(status)
      }
    })
  })

  describe('evaluateSync()', () => {
    it('should return error data when there is no when condition', () => {
      // Arrange
      const errorNode = ASTTestFactory.throwErrorOutcome({ status: 404, message: 'Not found' })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = handler.evaluateSync(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ status: 404, message: 'Not found' })
    })

    it('should return undefined when when condition is falsy', () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const errorNode = ASTTestFactory.throwErrorOutcome({ when: whenNode, status: 500, message: 'Error' })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = handler.evaluateSync(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })
  })

  describe('computeIsAsync()', () => {
    it('should set isAsync to false when when and message are not AST nodes', () => {
      // Arrange
      const errorNode = ASTTestFactory.throwErrorOutcome({ status: 404, message: 'Static message' })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockDeps = {
        thunkHandlerRegistry: { get: jest.fn().mockReturnValue({ isAsync: false }) },
        functionRegistry: {},
        nodeRegistry: {},
        metadataRegistry: {},
      } as unknown as MetadataComputationDependencies

      // Act
      handler.computeIsAsync(mockDeps)

      // Assert
      expect(handler.isAsync).toBe(false)
    })

    it('should set isAsync to true when when handler is async', () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const errorNode = ASTTestFactory.throwErrorOutcome({ when: whenNode, status: 404, message: 'Error' })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockDeps = {
        thunkHandlerRegistry: { get: jest.fn().mockReturnValue({ isAsync: true }) },
        functionRegistry: {},
        nodeRegistry: {},
        metadataRegistry: {},
      } as unknown as MetadataComputationDependencies

      // Act
      handler.computeIsAsync(mockDeps)

      // Assert
      expect(handler.isAsync).toBe(true)
    })

    it('should set isAsync to true when message handler is async', () => {
      // Arrange
      const messageNode = ASTTestFactory.reference(['data', 'message'])
      const errorNode = ASTTestFactory.throwErrorOutcome({ status: 500, message: messageNode })
      const handler = new ThrowErrorOutcomeHandler(errorNode.id, errorNode)
      const mockDeps = {
        thunkHandlerRegistry: { get: jest.fn().mockReturnValue({ isAsync: true }) },
        functionRegistry: {},
        nodeRegistry: {},
        metadataRegistry: {},
      } as unknown as MetadataComputationDependencies

      // Act
      handler.computeIsAsync(mockDeps)

      // Assert
      expect(handler.isAsync).toBe(true)
    })
  })
})
