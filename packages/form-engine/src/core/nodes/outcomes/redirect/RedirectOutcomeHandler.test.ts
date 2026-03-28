import { PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import { MetadataComputationDependencies } from '@form-engine/core/compilation/thunks/types'
import RedirectOutcomeHandler from './RedirectOutcomeHandler'

describe('RedirectOutcomeHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return goto value when there is no when condition', async () => {
      // Arrange
      const redirectNode = ASTTestFactory.redirectOutcome({ goto: '/next-step' })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/next-step')
    })

    it('should return goto value when when condition is truthy', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const redirectNode = ASTTestFactory.redirectOutcome({ when: whenNode, goto: '/success' })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/success')
    })

    it('should return undefined when when condition is falsy', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const redirectNode = ASTTestFactory.redirectOutcome({ when: whenNode, goto: '/success' })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
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
      const redirectNode = ASTTestFactory.redirectOutcome({ goto: gotoNode })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: '/dynamic-path' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/dynamic-path')
    })

    it('should evaluate both when and goto when both are AST nodes', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const gotoNode = ASTTestFactory.reference(['data', 'nextPath'])
      const redirectNode = ASTTestFactory.redirectOutcome({ when: whenNode, goto: gotoNode })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, '/conditional-path'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/conditional-path')
    })

    it('should return undefined when when condition evaluation fails', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const redirectNode = ASTTestFactory.redirectOutcome({ when: whenNode, goto: '/next' })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ nodeId: whenNode.id })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return undefined when goto evaluation returns undefined', async () => {
      // Arrange
      const gotoNode = ASTTestFactory.reference(['data', 'missing'])
      const redirectNode = ASTTestFactory.redirectOutcome({ goto: gotoNode })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: undefined })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should convert numeric goto value to string', async () => {
      // Arrange
      const gotoNode = ASTTestFactory.reference(['data', 'numericPath'])
      const redirectNode = ASTTestFactory.redirectOutcome({ goto: gotoNode })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 123 })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('123')
    })

    it('should not evaluate goto when when condition is falsy', async () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const gotoNode = ASTTestFactory.reference(['data', 'path'])
      const redirectNode = ASTTestFactory.redirectOutcome({ when: whenNode, goto: gotoNode })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
      expect(mockInvoker.invoke).toHaveBeenCalledWith(whenNode.id, mockContext)
    })
  })

  describe('evaluateSync()', () => {
    it('should return goto value when there is no when condition', () => {
      // Arrange
      const redirectNode = ASTTestFactory.redirectOutcome({ goto: '/next-step' })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = handler.evaluateSync(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('/next-step')
    })

    it('should return undefined when when condition is falsy', () => {
      // Arrange
      const whenNode = ASTTestFactory.predicate(PredicateType.TEST)
      const redirectNode = ASTTestFactory.redirectOutcome({ when: whenNode, goto: '/success' })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = handler.evaluateSync(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })
  })

  describe('computeIsAsync()', () => {
    it('should set isAsync to false when when and goto are not AST nodes', () => {
      // Arrange
      const redirectNode = ASTTestFactory.redirectOutcome({ goto: '/static-path' })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
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
      const redirectNode = ASTTestFactory.redirectOutcome({ when: whenNode, goto: '/path' })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
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

    it('should set isAsync to true when goto handler is async', () => {
      // Arrange
      const gotoNode = ASTTestFactory.reference(['data', 'path'])
      const redirectNode = ASTTestFactory.redirectOutcome({ goto: gotoNode })
      const handler = new RedirectOutcomeHandler(redirectNode.id, redirectNode)
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
