import type { ZodType } from 'zod'
import { z } from 'zod'
import { FunctionType } from '../../../../authoring/types/enums'
import { generatedFunctionHelpers } from './GeneratedFunctionHelpers'

interface StubRegistryEntry {
  evaluate: (...args: unknown[]) => unknown
  inputSchema?: ZodType
  argumentsSchema?: ZodType
  outputSchema?: ZodType
  functionType?: FunctionType
}

const contextFor = (entry: StubRegistryEntry) => ({
  conditions: {
    get: () => entry,
  },
})

describe('generatedFunctionHelpers', () => {
  describe('evaluateFunction()', () => {
    it('should return false without invoking the implementation when a condition value is absent', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.CONDITION, inputSchema: z.string() })

      // Act
      const nullResult = generatedFunctionHelpers.evaluateFunction(ctx, undefined, {}, 'isNotEmpty', [null])
      const undefinedResult = generatedFunctionHelpers.evaluateFunction(ctx, undefined, {}, 'isNotEmpty', [undefined])

      // Assert
      expect(nullResult).toBe(false)
      expect(undefinedResult).toBe(false)
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should return false without invoking the implementation when a condition value is wrongly typed', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.CONDITION, inputSchema: z.string() })

      // Act
      const result = generatedFunctionHelpers.evaluateFunction(ctx, undefined, {}, 'isNotEmpty', [123])

      // Assert
      expect(result).toBe(false)
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should evaluate normally when a condition value satisfies its input schema', () => {
      // Arrange
      const evaluate = vi.fn(() => true)
      const ctx = contextFor({ evaluate, functionType: FunctionType.CONDITION, inputSchema: z.string() })

      // Act
      const result = generatedFunctionHelpers.evaluateFunction(ctx, undefined, {}, 'isNotEmpty', ['hello'])

      // Assert
      expect(result).toBe(true)
      expect(evaluate).toHaveBeenCalledWith('hello')
    })

    it('should throw TypeError when arguments fail the arguments schema', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.CONDITION, argumentsSchema: z.tuple([z.string()]) })

      // Act
      const call = () => generatedFunctionHelpers.evaluateFunction(ctx, undefined, {}, 'equals', ['field', 42])

      // Assert
      expect(call).toThrow(TypeError)
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should throw TypeError when a non-condition value fails its input schema', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.TRANSFORMER, inputSchema: z.string() })

      // Act
      const call = () => generatedFunctionHelpers.evaluateFunction(ctx, undefined, {}, 'toUpperCase', [123])

      // Assert
      expect(call).toThrow(TypeError)
      expect(evaluate).not.toHaveBeenCalled()
    })
  })
})
