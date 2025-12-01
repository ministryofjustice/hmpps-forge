import { FunctionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import PipelineHandler from './PipelineHandler'

describe('PipelineHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should evaluate pipeline with primitive input and no steps', async () => {
      // Arrange
      const pipeline = ASTTestFactory.pipelineExpression({
        input: 'test-value',
        steps: [],
      })
      const handler = new PipelineHandler(pipeline.id, pipeline)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('test-value')
    })

    it('should evaluate pipeline with primitive input and AST node steps', async () => {
      // Arrange
      const step1 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'toUpperCase')
      const step2 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')
      const pipeline = ASTTestFactory.pipelineExpression({
        input: 'test-value',
        steps: [step1, step2],
      })
      const handler = new PipelineHandler(pipeline.id, pipeline)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker(['TEST-VALUE', 'TEST-VALUE'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('TEST-VALUE')
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should evaluate pipeline with AST node input and no steps', async () => {
      // Arrange
      const inputNode = ASTTestFactory.reference(['answers', 'email'])
      const pipeline = ASTTestFactory.pipelineExpression({
        input: inputNode,
        steps: [],
      })
      const handler = new PipelineHandler(pipeline.id, pipeline)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker(['user@example.com'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('user@example.com')
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
    })

    it('should evaluate pipeline with AST node input and multiple steps', async () => {
      // Arrange
      const inputNode = ASTTestFactory.reference(['answers', 'email'])
      const step1 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')
      const step2 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'toLowerCase')
      const pipeline = ASTTestFactory.pipelineExpression({
        input: inputNode,
        steps: [step1, step2],
      })
      const handler = new PipelineHandler(pipeline.id, pipeline)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker(['  USER@EXAMPLE.COM  ', 'user@example.com', 'user@example.com'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('user@example.com')
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
    })

    it('should return error when AST node input fails to evaluate', async () => {
      // Arrange
      const inputNode = ASTTestFactory.reference(['answers', 'email'])
      const pipeline = ASTTestFactory.pipelineExpression({
        input: inputNode,
        steps: [],
      })
      const handler = new PipelineHandler(pipeline.id, pipeline)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.type).toBe('EVALUATION_FAILED')
      expect(result.error?.message).toContain('Pipeline input evaluation failed')
    })

    it('should return error when first step fails to evaluate', async () => {
      // Arrange
      const step1 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')
      const step2 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'toLowerCase')
      const pipeline = ASTTestFactory.pipelineExpression({
        input: 'test-value',
        steps: [step1, step2],
      })
      const handler = new PipelineHandler(pipeline.id, pipeline)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.type).toBe('EVALUATION_FAILED')
      expect(result.error?.message).toContain('Pipeline step 0 evaluation failed')
    })

    it('should return error when middle step fails to evaluate', async () => {
      // Arrange
      const step1 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')
      const step2 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'toLowerCase')
      const step3 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'validateEmail')
      const pipeline = ASTTestFactory.pipelineExpression({
        input: 'test-value',
        steps: [step1, step2, step3],
      })
      const handler = new PipelineHandler(pipeline.id, pipeline)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({
        value: 'trimmed',
        metadata: { source: 'test', timestamp: Date.now() },
      })
      mockInvoker.invoke.mockResolvedValueOnce({
        error: {
          type: 'EVALUATION_FAILED',
          nodeId: 'compile_ast:100',
          message: 'Evaluation failed',
        },
        metadata: { source: 'test', timestamp: Date.now() },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.type).toBe('EVALUATION_FAILED')
      expect(result.error?.message).toContain('Pipeline step 1 evaluation failed')
    })
  })
})
