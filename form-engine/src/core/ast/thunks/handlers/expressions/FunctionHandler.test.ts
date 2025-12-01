import { FunctionType } from '@form-engine/form/types/enums'
import { FunctionRegistryEntry } from '@form-engine/registry/types/functions.type'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import FunctionHandler from './FunctionHandler'

describe('FunctionHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should call function with no arguments when function exists in registry', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'generateId')

      const mockFunction: FunctionRegistryEntry = {
        name: 'generateId',
        evaluate: jest.fn().mockReturnValue('generated-id-123'),
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['generateId', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockFunction.evaluate).toHaveBeenCalledWith(undefined)
      expect(result.value).toBe('generated-id-123')
    })

    it('should call function with primitive arguments when function exists in registry', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', ['hello', 'world'])

      const mockFunction: FunctionRegistryEntry = {
        name: 'equals',
        evaluate: jest.fn().mockReturnValue(false),
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['equals', mockFunction]]),
      })

      const handler = new FunctionHandler(functionNode.id, functionNode)
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockFunction.evaluate).toHaveBeenCalledWith(undefined, 'hello', 'world')
      expect(result.value).toBe(false)
    })

    it('should evaluate AST node arguments before calling function when function exists in registry', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'email'])

      const functionNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'uppercase', [refNode])

      const mockFunction: FunctionRegistryEntry = {
        name: 'uppercase',
        evaluate: jest.fn((_, str: string) => str.toUpperCase()),
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['uppercase', mockFunction]]),
      })

      const mockInvoker = createMockInvoker({ defaultValue: 'test@example.com' })

      const handler = new FunctionHandler(functionNode.id, functionNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledWith(refNode.id, mockContext)
      expect(mockFunction.evaluate).toHaveBeenCalledWith(undefined, 'test@example.com')
      expect(result.value).toBe('TEST@EXAMPLE.COM')
    })

    it('should handle mix of primitive and AST node arguments when function exists in registry', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'count'])

      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'greaterThan', [refNode, 10])

      const mockFunction: FunctionRegistryEntry = {
        name: 'greaterThan',
        evaluate: jest.fn((_, a: number, b: number) => a > b),
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['greaterThan', mockFunction]]),
      })

      const mockInvoker = createMockInvoker({ defaultValue: 15 })

      const handler = new FunctionHandler(functionNode.id, functionNode)

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockFunction.evaluate).toHaveBeenCalledWith(undefined, 15, 10)
      expect(result.value).toBe(true)
    })

    it('should use undefined for failed argument evaluations when function exists in registry', async () => {
      // Arrange
      const refNode = ASTTestFactory.reference(['answers', 'missing'])

      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isPresent', [refNode])

      const mockFunction: FunctionRegistryEntry = {
        name: 'isPresent',
        evaluate: jest.fn((value: any) => value !== undefined && value !== null),
      }

      const mockContext = createMockContext({
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
      expect(mockFunction.evaluate).toHaveBeenCalledWith(undefined, undefined)
      expect(result.value).toBe(false)
    })

    it('should return error when function does not exist in registry', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'unknownFunction')

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([
          ['equals', { name: 'equals', evaluate: jest.fn() }],
          ['greaterThan', { name: 'greaterThan', evaluate: jest.fn() }],
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

    it('should wrap error in ThunkError when function throws', async () => {
      // Arrange
      const functionNode = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'divide', [10, 0])

      const mockFunction: FunctionRegistryEntry = {
        name: 'divide',
        evaluate: jest.fn(() => {
          throw new Error('Division by zero')
        }),
      }

      const mockContext = createMockContext({
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
        evaluate: jest.fn((_, a: string, b: string) => `${a}${b}`),
      }

      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['concat', mockFunction]]),
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
      expect(mockFunction.evaluate).toHaveBeenCalledWith(undefined, 'Hello', 'World')
      expect(result.value).toBe('HelloWorld')
    })
  })
})
