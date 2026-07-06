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

interface StubComponentEntry {
  inputSchema?: ZodType
}

const componentContextFor = (entry: StubComponentEntry | undefined) => ({
  components: {
    get: vi.fn(() => entry),
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

  describe('checkComponentInputValue()', () => {
    it('should return the value unchanged when it is undefined', () => {
      // Arrange
      const ctx = componentContextFor({ inputSchema: z.string() })

      // Act
      const result = generatedFunctionHelpers.checkComponentInputValue(ctx, 'textInput', undefined, false)

      // Assert
      expect(result).toBeUndefined()
      expect(ctx.components.get).not.toHaveBeenCalled()
    })

    it('should return the value unchanged when the variant has no registry entry', () => {
      // Arrange
      const ctx = componentContextFor(undefined)

      // Act
      const result = generatedFunctionHelpers.checkComponentInputValue(
        ctx,
        'unknownVariant',
        { unexpected: true },
        false,
      )

      // Assert
      expect(result).toEqual({ unexpected: true })
    })

    it('should return the value unchanged when the entry declares no input schema', () => {
      // Arrange
      const ctx = componentContextFor({})

      // Act
      const result = generatedFunctionHelpers.checkComponentInputValue(ctx, 'textInput', { unexpected: true }, false)

      // Assert
      expect(result).toEqual({ unexpected: true })
    })

    it('should return the original value when it satisfies the input schema', () => {
      // Arrange
      const ctx = componentContextFor({ inputSchema: z.string() })

      // Act
      const result = generatedFunctionHelpers.checkComponentInputValue(ctx, 'textInput', 'Ada', false)

      // Assert
      expect(result).toBe('Ada')
    })

    it('should return undefined when a single-value schema rejects the value', () => {
      // Arrange
      const ctx = componentContextFor({ inputSchema: z.string() })

      // Act
      const result = generatedFunctionHelpers.checkComponentInputValue(ctx, 'textInput', { unexpected: true }, false)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return an empty array when a multiple schema rejects the value', () => {
      // Arrange
      const ctx = componentContextFor({ inputSchema: z.array(z.string()) })

      // Act
      const result = generatedFunctionHelpers.checkComponentInputValue(ctx, 'checkbox', 'not-an-array', true)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('normalizePostValue()', () => {
    it('should return the array unchanged when multiple and the value is an array', () => {
      // Arrange
      const rawValue = ['a', 'b']

      // Act
      const result = generatedFunctionHelpers.normalizePostValue(rawValue, true)

      // Assert
      expect(result).toEqual(['a', 'b'])
    })

    it('should wrap a scalar in an array when multiple', () => {
      // Arrange
      const rawValue = 'a'

      // Act
      const result = generatedFunctionHelpers.normalizePostValue(rawValue, true)

      // Assert
      expect(result).toEqual(['a'])
    })

    it('should return an empty array when multiple and the value is undefined', () => {
      // Arrange
      const rawValue = undefined

      // Act
      const result = generatedFunctionHelpers.normalizePostValue(rawValue, true)

      // Assert
      expect(result).toEqual([])
    })

    it('should return the scalar unchanged when not multiple', () => {
      // Arrange
      const rawValue = 'a'

      // Act
      const result = generatedFunctionHelpers.normalizePostValue(rawValue, false)

      // Assert
      expect(result).toBe('a')
    })

    it('should pick the first non-empty entry when not multiple and the value is an array', () => {
      // Arrange
      const rawValue = ['   ', '', 'chosen', 'ignored']

      // Act
      const result = generatedFunctionHelpers.normalizePostValue(rawValue, false)

      // Assert
      expect(result).toBe('chosen')
    })
  })
})
