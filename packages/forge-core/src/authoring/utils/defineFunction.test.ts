import { FunctionType } from '../types/enums'
import { ConditionFunctionExpr } from '../types/expressions.type'
import { createFunctionsRegistry } from './createFunctionsRegistry'
import { defineConditionFunctions } from './defineConditionFunctions'
import { defineEffectFunctions } from './defineEffectFunctions'
import { defineGeneratorFunctions } from './defineGeneratorFunctions'
import { defineTransformerFunctions } from './defineTransformerFunctions'

describe('createFunctionsRegistry', () => {
  it('should materialise implementations into registry entries', () => {
    // Arrange
    const { implementations } = defineConditionFunctions({
      IsInteger: () => (value: unknown) => {
        return typeof value === 'number' && !Number.isNaN(value) && Number.isInteger(value)
      },
    })

    // Act
    const registry = createFunctionsRegistry(implementations)

    // Assert
    expect(registry.IsInteger).toEqual({
      name: 'IsInteger',
      evaluate: expect.any(Function),
      isAsync: false,
    })
    expect(registry.IsInteger.evaluate(12)).toBe(true)
    expect(registry.IsInteger.evaluate(12.5)).toBe(false)
    expect(registry.IsInteger.evaluate('12')).toBe(false)
  })

  it('should mark async evaluators as async', async () => {
    // Arrange
    const { implementations } = defineConditionFunctions({
      IsAvailable: () => async (value: string, prefix: string) => {
        await Promise.resolve()

        return value.startsWith(prefix)
      },
    })

    // Act
    const registry = createFunctionsRegistry(implementations, {})

    // Assert
    expect(registry.IsAvailable.isAsync).toBe(true)
    await expect(registry.IsAvailable.evaluate('forge', 'for')).resolves.toBe(true)
  })

  it('should inject dependencies into factory functions', () => {
    // Arrange
    interface TestDeps {
      minValue: number
    }

    const { implementations } = defineConditionFunctions<{ ExceedsMin: (value: number) => boolean }, TestDeps>({
      ExceedsMin: deps => value => value > deps.minValue,
    })

    // Act
    const registry = createFunctionsRegistry(implementations, { minValue: 10 })

    // Assert
    expect(registry.ExceedsMin.evaluate(11)).toBe(true)
    expect(registry.ExceedsMin.evaluate(10)).toBe(false)
  })
})

describe('typed function wrappers', () => {
  it('should create condition function expressions', () => {
    const { conditions, implementations } = defineConditionFunctions({
      GreaterThan: () => (value: unknown, threshold: number) => Number(value) > threshold,
    })
    const registry = createFunctionsRegistry(implementations)

    expect(conditions.GreaterThan(10)).toEqual({
      type: FunctionType.CONDITION,
      name: 'GreaterThan',
      arguments: [10],
    })
    expect(registry.GreaterThan.evaluate(11, 10)).toBe(true)
  })

  it('should support public condition group interfaces as the generic input', () => {
    interface TestConditionGroup {
      IsPositive: () => ConditionFunctionExpr<[]>
      GreaterThan: (threshold: number) => ConditionFunctionExpr<[threshold: number]>
    }

    const { conditions, implementations } = defineConditionFunctions<TestConditionGroup>({
      IsPositive: () => (value: unknown) => Number(value) > 0,
      GreaterThan: () => (value: unknown, threshold: number) => Number(value) > threshold,
    })
    const registry = createFunctionsRegistry(implementations)

    expect(conditions.IsPositive()).toEqual({
      type: FunctionType.CONDITION,
      name: 'IsPositive',
      arguments: [],
    })
    expect(conditions.GreaterThan(3)).toEqual({
      type: FunctionType.CONDITION,
      name: 'GreaterThan',
      arguments: [3],
    })
    expect(registry.GreaterThan.evaluate(4, 3)).toBe(true)
  })

  it('should create transformer function expressions', () => {
    const { transformers, implementations } = defineTransformerFunctions({
      AddPrefix: () => (value: unknown, prefix: string) => `${prefix}${String(value)}`,
    })
    const registry = createFunctionsRegistry(implementations)

    expect(transformers.AddPrefix('prefix-')).toEqual({
      type: FunctionType.TRANSFORMER,
      name: 'AddPrefix',
      arguments: ['prefix-'],
    })
    expect(registry.AddPrefix.evaluate('value', 'prefix-')).toBe('prefix-value')
  })

  it('should create effect function expressions', () => {
    interface TestDeps {
      logger: {
        info: (message: string) => void
      }
    }

    const logger = { info: jest.fn() }
    const { effects, implementations } = defineEffectFunctions<
      { LogAction: (context: unknown, action: string) => void },
      TestDeps
    >({
      LogAction: deps => (_context, action) => {
        deps.logger.info(action)
      },
    })
    const registry = createFunctionsRegistry(implementations, { logger })

    expect(effects.LogAction('SUBMIT')).toEqual({
      type: FunctionType.EFFECT,
      name: 'LogAction',
      arguments: ['SUBMIT'],
    })

    registry.LogAction.evaluate({}, 'SUBMIT')
    expect(logger.info).toHaveBeenCalledWith('SUBMIT')
  })

  it('should create generator builders with generator expressions', () => {
    const { generators, implementations } = defineGeneratorFunctions({
      Today: () => () => '2026-04-01',
      PrefixedId: () => (prefix: string) => `${prefix}123`,
    })
    const registry = createFunctionsRegistry(implementations)
    const expr = generators.PrefixedId('id-').build()

    expect(expr).toEqual({
      type: FunctionType.GENERATOR,
      name: 'PrefixedId',
      arguments: ['id-'],
    })
    expect(typeof generators.Today().pipe).toBe('function')
    expect(registry.PrefixedId.evaluate('id-')).toBe('id-123')
  })
})
