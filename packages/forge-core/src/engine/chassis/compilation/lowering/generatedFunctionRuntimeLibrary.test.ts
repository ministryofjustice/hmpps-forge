import type { ZodType } from 'zod'
import { z } from 'zod'
import { FunctionType } from '../../../../authoring/types/enums'
import { generatedFunctionRuntimeLibrary } from './generatedFunctionRuntimeLibrary'

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

describe('generatedFunctionRuntimeLibrary', () => {
  describe('collectFieldValidationFailures()', () => {
    const fieldIdentity = { blockId: 'block:1', blockCode: 'firstName' }

    it('should flatten rules while preserving active-rule evaluation order and laziness', () => {
      // Arrange
      const passingMessage = vi.fn(() => 'unused')
      const passingRule = { evaluate: vi.fn(() => true), message: passingMessage }
      const inactiveRule = { evaluate: vi.fn(() => false), message: 'inactive', groups: ['other'] }
      const failingRule = { evaluate: vi.fn(() => false), message: undefined, details: { reason: 'required' } }
      const ruleIsActive = vi.fn(
        (rule: { groups?: unknown }) => !(Array.isArray(rule.groups) && rule.groups.includes('other')),
      )

      // Act
      const failures = generatedFunctionRuntimeLibrary.collectFieldValidationFailures(
        [passingRule, [undefined, inactiveRule, failingRule]],
        ruleIsActive,
        fieldIdentity,
      )

      // Assert
      expect(failures).toEqual([
        {
          blockId: 'block:1',
          blockCode: 'firstName',
          passed: false,
          message: '',
          submissionOnly: false,
          groups: undefined,
          details: { reason: 'required' },
        },
      ])
      expect(passingRule.evaluate).toHaveBeenCalledOnce()
      expect(passingMessage).not.toHaveBeenCalled()
      expect(inactiveRule.evaluate).not.toHaveBeenCalled()
      expect(failingRule.evaluate).toHaveBeenCalledOnce()
      expect(ruleIsActive.mock.calls.map(([rule]) => rule)).toEqual([passingRule, inactiveRule, failingRule])
    })

    it('should treat a generated condition TypeError as a validation failure', () => {
      // Arrange
      const conditionRule = {
        condition: vi.fn(() => {
          throw new TypeError('Wrong input shape')
        }),
        message: 'Invalid value',
        submissionOnly: true,
        groups: ['default'],
      }

      // Act
      const failures = generatedFunctionRuntimeLibrary.collectFieldValidationFailures(
        [conditionRule],
        () => true,
        fieldIdentity,
      )

      // Assert
      expect(failures).toEqual([
        {
          blockId: 'block:1',
          blockCode: 'firstName',
          passed: false,
          message: 'Invalid value',
          submissionOnly: true,
          groups: ['default'],
          details: undefined,
        },
      ])
      expect(conditionRule.condition).toHaveBeenCalledOnce()
    })

    it('should preserve errors from legacy evaluate callbacks', () => {
      // Arrange
      const evaluateRule = {
        evaluate: vi.fn(() => {
          throw new TypeError('Broken custom validation')
        }),
      }

      // Act
      const collect = () =>
        generatedFunctionRuntimeLibrary.collectFieldValidationFailures([evaluateRule], () => true, fieldIdentity)

      // Assert
      expect(collect).toThrow('Broken custom validation')
    })
  })

  describe('collectFieldValidationFailuresAsync()', () => {
    const fieldIdentity = { blockId: 'block:1', blockCode: 'firstName' }

    it('should await each failed rule before advancing to the next rule', async () => {
      // Arrange
      const evaluationOrder: string[] = []
      const firstRule = {
        evaluate: vi.fn(async () => {
          evaluationOrder.push('first condition')

          return false
        }),
        message: vi.fn(async () => {
          evaluationOrder.push('first message')

          return 'First failure'
        }),
      }
      const secondRule = {
        evaluate: vi.fn(async () => {
          evaluationOrder.push('second condition')

          return false
        }),
        message: 'Second failure',
      }

      // Act
      const failures = await generatedFunctionRuntimeLibrary.collectFieldValidationFailuresAsync(
        [firstRule, secondRule],
        () => true,
        fieldIdentity,
      )

      // Assert
      expect(failures.map(failure => failure.message)).toEqual(['First failure', 'Second failure'])
      expect(evaluationOrder).toEqual(['first condition', 'first message', 'second condition'])
    })

    it('should treat an asynchronous generated condition TypeError as a validation failure', async () => {
      // Arrange
      const conditionRule = {
        condition: vi.fn(async () => {
          throw new TypeError('Wrong input shape')
        }),
        message: 'Invalid value',
      }

      // Act
      const failures = await generatedFunctionRuntimeLibrary.collectFieldValidationFailuresAsync(
        [conditionRule],
        () => true,
        fieldIdentity,
      )

      // Assert
      expect(failures).toEqual([
        {
          blockId: 'block:1',
          blockCode: 'firstName',
          passed: false,
          message: 'Invalid value',
          submissionOnly: false,
          groups: undefined,
          details: undefined,
        },
      ])
      expect(conditionRule.condition).toHaveBeenCalledOnce()
    })
  })

  describe('collectDomainValidationFailures()', () => {
    it('should shape failed rules as step-level failures without field identity', () => {
      // Arrange
      const failingRule = { evaluate: () => false, message: 'Broken', submissionOnly: true, groups: ['default'] }

      // Act
      const failures = generatedFunctionRuntimeLibrary.collectDomainValidationFailures([failingRule], () => true)

      // Assert
      expect(failures).toEqual([
        { passed: false, message: 'Broken', submissionOnly: true, groups: ['default'], details: undefined },
      ])
    })
  })

  describe('collectDomainValidationFailuresAsync()', () => {
    it('should shape failed rules as step-level failures when conditions are async', async () => {
      // Arrange
      const failingRule = { condition: async () => false, message: 'Broken' }

      // Act
      const failures = await generatedFunctionRuntimeLibrary.collectDomainValidationFailuresAsync(
        [failingRule],
        () => true,
      )

      // Assert
      expect(failures).toEqual([
        { passed: false, message: 'Broken', submissionOnly: false, groups: undefined, details: undefined },
      ])
    })
  })

  describe('evaluateFunction()', () => {
    it('should return false without invoking the implementation when a condition value is absent', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.CONDITION, inputSchema: z.string() })

      // Act
      const nullResult = generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'isNotEmpty', [null])
      const undefinedResult = generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'isNotEmpty', [
        undefined,
      ])

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
      const result = generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'isNotEmpty', [123])

      // Assert
      expect(result).toBe(false)
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should evaluate normally when a condition value satisfies its input schema', () => {
      // Arrange
      const evaluate = vi.fn(() => true)
      const ctx = contextFor({ evaluate, functionType: FunctionType.CONDITION, inputSchema: z.string() })

      // Act
      const result = generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'isNotEmpty', ['hello'])

      // Assert
      expect(result).toBe(true)
      expect(evaluate).toHaveBeenCalledWith('hello')
    })

    it('should throw TypeError when arguments fail the arguments schema', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.CONDITION, argumentsSchema: z.tuple([z.string()]) })

      // Act
      const call = () => generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'equals', ['field', 42])

      // Assert
      expect(call).toThrow(TypeError)
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should throw TypeError when a non-condition value fails its input schema', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.TRANSFORMER, inputSchema: z.string() })

      // Act
      const call = () => generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'toUpperCase', [123])

      // Assert
      expect(call).toThrow(TypeError)
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should return undefined without invoking the implementation when a transformer value is absent', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.TRANSFORMER })

      // Act
      const result = generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'toUpperCase', [undefined])

      // Assert
      expect(result).toBeUndefined()
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should return false without invoking the implementation when a condition value is absent and no input schema is registered', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.CONDITION })

      // Act
      const result = generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'isNotEmpty', [undefined])

      // Assert
      expect(result).toBe(false)
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should throw TypeError when a transformer value is absent but its arguments fail the arguments schema', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({
        evaluate,
        functionType: FunctionType.TRANSFORMER,
        argumentsSchema: z.tuple([z.string()]),
      })

      // Act
      const call = () =>
        generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'padStart', [undefined, 42])

      // Assert
      expect(call).toThrow(TypeError)
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should invoke the implementation for a generator whose first argument is undefined', () => {
      // Arrange
      const evaluate = vi.fn(() => 'generated')
      const ctx = contextFor({ evaluate, functionType: FunctionType.GENERATOR })

      // Act
      const result = generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'uuid', [undefined])

      // Assert
      expect(result).toBe('generated')
      expect(evaluate).toHaveBeenCalledWith(undefined)
    })

    it('should not consult the output schema when a transformer short-circuits on an absent value', () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.TRANSFORMER, outputSchema: z.string() })

      // Act
      const result = generatedFunctionRuntimeLibrary.evaluateFunction(ctx, undefined, 0, 'toUpperCase', [undefined])

      // Assert
      expect(result).toBeUndefined()
      expect(evaluate).not.toHaveBeenCalled()
    })
  })

  describe('evaluateFunctionAsync()', () => {
    it('should return undefined without invoking the implementation when a transformer value is absent', async () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.TRANSFORMER })

      // Act
      const result = await generatedFunctionRuntimeLibrary.evaluateFunctionAsync(ctx, undefined, 0, 'toUpperCase', [
        undefined,
      ])

      // Assert
      expect(result).toBeUndefined()
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should return false without invoking the implementation when a condition value is absent', async () => {
      // Arrange
      const evaluate = vi.fn()
      const ctx = contextFor({ evaluate, functionType: FunctionType.CONDITION })

      // Act
      const result = await generatedFunctionRuntimeLibrary.evaluateFunctionAsync(ctx, undefined, 0, 'isNotEmpty', [
        undefined,
      ])

      // Assert
      expect(result).toBe(false)
      expect(evaluate).not.toHaveBeenCalled()
    })
  })

  describe('checkComponentInputValue()', () => {
    it('should return the value unchanged when it is undefined', () => {
      // Arrange
      const ctx = componentContextFor({ inputSchema: z.string() })

      // Act
      const result = generatedFunctionRuntimeLibrary.checkComponentInputValue(ctx, 'textInput', undefined, false)

      // Assert
      expect(result).toBeUndefined()
      expect(ctx.components.get).not.toHaveBeenCalled()
    })

    it('should return the value unchanged when the variant has no registry entry', () => {
      // Arrange
      const ctx = componentContextFor(undefined)

      // Act
      const result = generatedFunctionRuntimeLibrary.checkComponentInputValue(
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
      const result = generatedFunctionRuntimeLibrary.checkComponentInputValue(
        ctx,
        'textInput',
        { unexpected: true },
        false,
      )

      // Assert
      expect(result).toEqual({ unexpected: true })
    })

    it('should return the original value when it satisfies the input schema', () => {
      // Arrange
      const ctx = componentContextFor({ inputSchema: z.string() })

      // Act
      const result = generatedFunctionRuntimeLibrary.checkComponentInputValue(ctx, 'textInput', 'Ada', false)

      // Assert
      expect(result).toBe('Ada')
    })

    it('should return undefined when a single-value schema rejects the value', () => {
      // Arrange
      const ctx = componentContextFor({ inputSchema: z.string() })

      // Act
      const result = generatedFunctionRuntimeLibrary.checkComponentInputValue(
        ctx,
        'textInput',
        { unexpected: true },
        false,
      )

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return an empty array when a multiple schema rejects the value', () => {
      // Arrange
      const ctx = componentContextFor({ inputSchema: z.array(z.string()) })

      // Act
      const result = generatedFunctionRuntimeLibrary.checkComponentInputValue(ctx, 'checkbox', 'not-an-array', true)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('normalizePostValue()', () => {
    it('should return the array unchanged when multiple and the value is an array', () => {
      // Arrange
      const rawValue = ['a', 'b']

      // Act
      const result = generatedFunctionRuntimeLibrary.normalizePostValue(rawValue, true)

      // Assert
      expect(result).toEqual(['a', 'b'])
    })

    it('should wrap a scalar in an array when multiple', () => {
      // Arrange
      const rawValue = 'a'

      // Act
      const result = generatedFunctionRuntimeLibrary.normalizePostValue(rawValue, true)

      // Assert
      expect(result).toEqual(['a'])
    })

    it('should return an empty array when multiple and the value is undefined', () => {
      // Arrange
      const rawValue = undefined

      // Act
      const result = generatedFunctionRuntimeLibrary.normalizePostValue(rawValue, true)

      // Assert
      expect(result).toEqual([])
    })

    it('should return the scalar unchanged when not multiple', () => {
      // Arrange
      const rawValue = 'a'

      // Act
      const result = generatedFunctionRuntimeLibrary.normalizePostValue(rawValue, false)

      // Assert
      expect(result).toBe('a')
    })

    it('should pick the first non-empty entry when not multiple and the value is an array', () => {
      // Arrange
      const rawValue = ['   ', '', 'chosen', 'ignored']

      // Act
      const result = generatedFunctionRuntimeLibrary.normalizePostValue(rawValue, false)

      // Assert
      expect(result).toBe('chosen')
    })
  })

  describe('applyTransformerPipeline()', () => {
    it('should thread each transformer result into the next transformer', () => {
      // Arrange
      const transformers = [(value: unknown) => `${value}!`, (value: unknown) => `${value}?`]

      // Act
      const result = generatedFunctionRuntimeLibrary.applyTransformerPipeline('a', transformers)

      // Assert
      expect(result).toBe('a!?')
    })

    it('should keep the previous value when a transformer returns undefined', () => {
      // Arrange
      const transformers = [(value: unknown) => `${value}!`, () => undefined]

      // Act
      const result = generatedFunctionRuntimeLibrary.applyTransformerPipeline('a', transformers)

      // Assert
      expect(result).toBe('a!')
    })

    it('should revert to the original value when a transformer throws TypeError', () => {
      // Arrange
      const laterTransformer = vi.fn((value: unknown) => value)
      const transformers = [
        (value: unknown) => `${value}!`,
        () => {
          throw new TypeError('wrong shape')
        },
        laterTransformer,
      ]

      // Act
      const result = generatedFunctionRuntimeLibrary.applyTransformerPipeline('a', transformers)

      // Assert
      expect(result).toBe('a')
      expect(laterTransformer).not.toHaveBeenCalled()
    })

    it('should revert to the original value when a transformer error has a TypeError cause', () => {
      // Arrange
      const transformers = [
        () => {
          throw new Error('wrapped', { cause: new TypeError('wrong shape') })
        },
      ]

      // Act
      const result = generatedFunctionRuntimeLibrary.applyTransformerPipeline('a', transformers)

      // Assert
      expect(result).toBe('a')
    })

    it('should rethrow when a transformer throws a non-TypeError', () => {
      // Arrange
      const transformers = [
        () => {
          throw new Error('boom')
        },
      ]

      // Act
      const act = () => generatedFunctionRuntimeLibrary.applyTransformerPipeline('a', transformers)

      // Assert
      expect(act).toThrow('boom')
    })
  })

  describe('applyTransformerPipelineAsync()', () => {
    it('should await each transformer before running the next one', async () => {
      // Arrange
      const transformers = [async (value: unknown) => `${value}!`, (value: unknown) => `${value}?`]

      // Act
      const result = await generatedFunctionRuntimeLibrary.applyTransformerPipelineAsync('a', transformers)

      // Assert
      expect(result).toBe('a!?')
    })

    it('should revert to the original value when an async transformer rejects with TypeError', async () => {
      // Arrange
      const transformers = [
        async () => {
          throw new TypeError('wrong shape')
        },
      ]

      // Act
      const result = await generatedFunctionRuntimeLibrary.applyTransformerPipelineAsync('a', transformers)

      // Assert
      expect(result).toBe('a')
    })
  })
})
