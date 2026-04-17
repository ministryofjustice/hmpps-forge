import { FunctionType } from '../../../../authoring/types/enums'
import { FunctionRegistryEntry } from '../../../../authoring/types/functions.type'
import { ASTTestFactory } from '../../../../testing/ASTTestFactory'
import { createMockContext, createMockInvoker, createMockInvokerWithError } from '../../../../testing/thunkTestHelpers'
import FunctionHandler from './FunctionHandler'

describe('FunctionHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should call generator function with no arguments (generators do not receive @value)', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'generateId')

      const mockFunction: FunctionRegistryEntry = {
        name: 'generateId',
        evaluate: vi.fn().mockReturnValue('generated-id-123'),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['generateId', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockFunction.evaluate).toHaveBeenCalledWith()
      expect(result.value).toBe('generated-id-123')
    })

    it('should call function with primitive arguments when function exists in registry', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', ['hello', 'world'])

      const mockFunction: FunctionRegistryEntry = {
        name: 'equals',
        evaluate: vi.fn().mockReturnValue(false),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': 'test-value', '@type': 'predicate' }],
        mockRegisteredFunctions: new Map([['equals', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockFunction.evaluate).toHaveBeenCalledWith('test-value', 'hello', 'world')
      expect(result.value).toBe(false)
    })

    it('should evaluate AST node arguments before calling function when function exists in registry', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'email'])

      const functionNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'uppercase', [refNode])

      const mockFunction: FunctionRegistryEntry = {
        name: 'uppercase',
        evaluate: vi.fn((_, str: string) => str.toUpperCase()),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': 'input-value', '@type': 'pipeline' }],
        mockRegisteredFunctions: new Map([['uppercase', mockFunction]]),
        mockNodes: new Map([[refNode.id, refNode]]),
      })

      const mockInvoker = createMockInvoker({ defaultValue: 'test@example.com' })

      const handler = new FunctionHandler(functionNode.id, functionNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledWith(refNode.id, mockContext)
      expect(mockFunction.evaluate).toHaveBeenCalledWith('input-value', 'test@example.com')
      expect(result.value).toBe('TEST@EXAMPLE.COM')
    })

    it('should handle mix of primitive and AST node arguments when function exists in registry', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'count'])

      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'greaterThan', [refNode, 10])

      const mockFunction: FunctionRegistryEntry = {
        name: 'greaterThan',
        evaluate: vi.fn((_, a: number, b: number) => a > b),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': 'test-value', '@type': 'predicate' }],
        mockRegisteredFunctions: new Map([['greaterThan', mockFunction]]),
        mockNodes: new Map([[refNode.id, refNode]]),
      })

      const mockInvoker = createMockInvoker({ defaultValue: 15 })

      const handler = new FunctionHandler(functionNode.id, functionNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockFunction.evaluate).toHaveBeenCalledWith('test-value', 15, 10)
      expect(result.value).toBe(true)
    })

    it('should use undefined for failed argument evaluations when function exists in registry', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'missing'])

      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isPresent', [refNode])

      const mockFunction: FunctionRegistryEntry = {
        name: 'isPresent',
        evaluate: vi.fn((_value: any, arg: any) => arg !== undefined && arg !== null),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': 'test-value', '@type': 'predicate' }],
        mockRegisteredFunctions: new Map([['isPresent', mockFunction]]),
      })

      const mockInvoker = createMockInvokerWithError({
        nodeId: refNode.id,
        message: 'Reference not found',
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockFunction.evaluate).toHaveBeenCalledWith('test-value', undefined)
      expect(result.value).toBe(false)
    })

    it('should return error when function does not exist in registry', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'unknownFunction')

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([
          ['equals', { name: 'equals', evaluate: vi.fn() }],
          ['greaterThan', { name: 'greaterThan', evaluate: vi.fn() }],
        ]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.type).toBe('LOOKUP_FAILED')
      expect(result.error?.message).toContain('unknownFunction')
      expect(result.error?.message).toContain('not found')
    })

    it('should wrap error in ThunkError with EVALUATION_FAILED when function throws non-TypeError', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'divide', [10, 0])

      const mockFunction: FunctionRegistryEntry = {
        name: 'divide',
        evaluate: vi.fn(() => {
          throw new Error('Division by zero')
        }),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': 100, '@type': 'pipeline' }],
        mockRegisteredFunctions: new Map([['divide', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.type).toBe('EVALUATION_FAILED')
      expect(result.error?.message).toContain('divide')
      expect(result.error?.message).toContain('Division by zero')
      expect(result.error?.cause).toBeInstanceOf(Error)
    })

    it('should evaluate arguments in parallel', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['answers', 'first'])
      const ref2 = ASTTestFactory.reference(['answers', 'second'])

      const functionNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'concat', [ref1, ref2])

      const mockFunction: FunctionRegistryEntry = {
        name: 'concat',
        evaluate: vi.fn((_, a: string, b: string) => `${a}${b}`),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': 'input-value', '@type': 'pipeline' }],
        mockRegisteredFunctions: new Map([['concat', mockFunction]]),
        mockNodes: new Map([
          [ref1.id, ref1],
          [ref2.id, ref2],
        ]),
      })

      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([
          [ref1.id, 'Hello'],
          [ref2.id, 'World'],
        ]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
      expect(mockFunction.evaluate).toHaveBeenCalledWith('input-value', 'Hello', 'World')
      expect(result.value).toBe('HelloWorld')
    })

    it('should return false when @value is undefined for CONDITION', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', ['hello'])

      const mockFunction: FunctionRegistryEntry = {
        name: 'equals',
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': undefined, '@type': 'predicate' }],
        mockRegisteredFunctions: new Map([['equals', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
      expect(mockFunction.evaluate).not.toHaveBeenCalled()
    })

    it('should return false when @value is null for CONDITION', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', ['hello'])

      const mockFunction: FunctionRegistryEntry = {
        name: 'equals',
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': null, '@type': 'predicate' }],
        mockRegisteredFunctions: new Map([['equals', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
      expect(mockFunction.evaluate).not.toHaveBeenCalled()
    })

    it('should return undefined when @value is undefined for TRANSFORMER', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'uppercase')

      const mockFunction: FunctionRegistryEntry = {
        name: 'uppercase',
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': undefined, '@type': 'pipeline' }],
        mockRegisteredFunctions: new Map([['uppercase', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockFunction.evaluate).not.toHaveBeenCalled()
    })

    it('should return undefined when @value is null for TRANSFORMER', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'uppercase')

      const mockFunction: FunctionRegistryEntry = {
        name: 'uppercase',
        evaluate: vi.fn(),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': null, '@type': 'pipeline' }],
        mockRegisteredFunctions: new Map([['uppercase', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(mockFunction.evaluate).not.toHaveBeenCalled()
    })

    it('should return TYPE_MISMATCH error when function throws TypeError', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'greaterThan', [10])

      const mockFunction: FunctionRegistryEntry = {
        name: 'greaterThan',
        evaluate: vi.fn(() => {
          throw new TypeError('greaterThan expects a number but received string')
        }),
        isAsync: false,
      }

      const mockContext = createMockContext({
        mockScope: [{ '@value': 'not-a-number', '@type': 'predicate' }],
        mockRegisteredFunctions: new Map([['greaterThan', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.type).toBe('TYPE_MISMATCH')
      expect(result.error?.message).toContain('greaterThan')
      expect(result.error?.message).toContain('expects a number but received string')
      expect(result.error?.cause).toBeInstanceOf(Error)
    })
  })
})
