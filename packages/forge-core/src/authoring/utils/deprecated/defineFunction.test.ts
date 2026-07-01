import { FunctionType } from '../../types/enums'
import { ConditionFunctionExpr, EffectFunctionExpr, TransformerFunctionExpr } from '../../types/expressions.type'
import { GeneratorBuilder } from '../../builders/GeneratorBuilder'
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
    expect(registry.IsInteger).toMatchObject({
      name: 'IsInteger',
      evaluate: expect.any(Function),
      isAsync: false,
      functionType: FunctionType.CONDITION,
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

    const logger = { info: vi.fn() }
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

describe('factory prepare hook', () => {
  it('should run prepare synchronously when a condition builder is called', () => {
    // Arrange
    const prepare = vi.fn((threshold: number): [number] => [threshold])
    const { conditions } = defineConditionFunctions<{
      GreaterThan: (threshold: number) => ConditionFunctionExpr<[number]>
    }>({
      GreaterThan: {
        prepare,
        factory: () => (value: unknown, threshold: number) => Number(value) > threshold,
      },
    })

    // Act
    conditions.GreaterThan(10)

    // Assert
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith(10)
  })

  it('should propagate prepare errors from condition builders at author-call time', () => {
    // Arrange
    const { conditions } = defineConditionFunctions<{
      Between: (min: number, max: number) => ConditionFunctionExpr<[number, number]>
    }>({
      Between: {
        prepare: (min: number, max: number): [number, number] => {
          if (min > max) {
            throw new Error('min must be <= max')
          }

          return [min, max]
        },
        factory: () => (value: unknown, min: number, max: number) => {
          return Number(value) >= min && Number(value) <= max
        },
      },
    })

    // Act / Assert
    expect(() => conditions.Between(5, 1)).toThrow('min must be <= max')
  })

  it('should use prepared args in the built expression', () => {
    // Arrange
    type ListItem = { value: string; divider?: boolean }

    const { conditions } = defineConditionFunctions<{
      IsIn: (items: ListItem[]) => ConditionFunctionExpr<[ListItem[]]>
    }>({
      IsIn: {
        prepare: (items: ListItem[]): [ListItem[]] => {
          return [items.filter(item => !item.divider)]
        },
        factory: () => (value: unknown, items: Array<{ value: string }>) => {
          return items.some(item => item.value === value)
        },
      },
    })

    // Act
    const expr = conditions.IsIn([{ value: 'a' }, { value: '', divider: true }, { value: 'b' }])

    // Assert
    expect(expr).toEqual({
      type: FunctionType.CONDITION,
      name: 'IsIn',
      arguments: [[{ value: 'a' }, { value: 'b' }]],
    })
  })

  it('should still build a working registry from a factory with prepare', () => {
    // Arrange
    const { implementations } = defineConditionFunctions<{
      IsPositive: () => ConditionFunctionExpr<[]>
    }>({
      IsPositive: {
        prepare: (): [] => [] as [],
        factory: () => (value: unknown) => Number(value) > 0,
      },
    })

    // Act
    const registry = createFunctionsRegistry(implementations)

    // Assert
    expect(registry.IsPositive.evaluate(5)).toBe(true)
    expect(registry.IsPositive.evaluate(-1)).toBe(false)
  })

  it('should run prepare when a transformer builder is called', () => {
    // Arrange
    const prepare = vi.fn((prefix: string): [string] => [prefix])
    const { transformers, implementations } = defineTransformerFunctions<{
      AddPrefix: (prefix: string) => TransformerFunctionExpr<[string]>
    }>({
      AddPrefix: {
        prepare,
        factory: () => (value: unknown, prefix: string) => `${prefix}${String(value)}`,
      },
    })

    // Act
    transformers.AddPrefix('hello-')
    const registry = createFunctionsRegistry(implementations)

    // Assert
    expect(prepare).toHaveBeenCalledWith('hello-')
    expect(registry.AddPrefix.evaluate('world', 'hello-')).toBe('hello-world')
  })

  it('should run prepare when an effect builder is called', () => {
    // Arrange
    const prepare = vi.fn((action: string): [string] => [action])
    const { effects } = defineEffectFunctions<{
      LogAction: (action: string) => EffectFunctionExpr<[string]>
    }>({
      LogAction: {
        prepare,
        factory: () => () => {},
      },
    })

    // Act
    effects.LogAction('SUBMIT')

    // Assert
    expect(prepare).toHaveBeenCalledWith('SUBMIT')
  })

  it('should run prepare when a generator builder is called', () => {
    // Arrange
    const prepare = vi.fn((prefix: string): [string] => [prefix])
    const { generators, implementations } = defineGeneratorFunctions<{
      PrefixedId: (prefix: string) => GeneratorBuilder<[string]>
    }>({
      PrefixedId: {
        prepare,
        factory: () => (prefix: string) => `${prefix}123`,
      },
    })

    // Act
    const expr = generators.PrefixedId('id-').build()
    const registry = createFunctionsRegistry(implementations)

    // Assert
    expect(prepare).toHaveBeenCalledWith('id-')
    expect(expr).toEqual({
      type: FunctionType.GENERATOR,
      name: 'PrefixedId',
      arguments: ['id-'],
    })
    expect(registry.PrefixedId.evaluate('id-')).toBe('id-123')
  })

  it('should use prepared args in generator expression', () => {
    // Arrange
    type ListItem = { value: string; text: string; divider?: boolean }

    const { generators } = defineGeneratorFunctions<{
      LookupText: (items: ListItem[], selected: string) => GeneratorBuilder<[ListItem[], string]>
    }>({
      LookupText: {
        prepare: (items: ListItem[], selected: string): [ListItem[], string] => {
          return [items.filter(item => !item.divider).map(item => ({ value: item.value, text: item.text })), selected]
        },
        factory: () => (items: Array<{ value: string; text: string }>, selected: string) => {
          return items.find(item => item.value === selected)?.text ?? ''
        },
      },
    })

    // Act
    const expr = generators
      .LookupText(
        [
          { value: 'a', text: 'Alpha' },
          { value: '', text: '', divider: true },
          { value: 'b', text: 'Beta' },
        ],
        'b',
      )
      .build()

    // Assert
    expect(expr).toEqual({
      type: FunctionType.GENERATOR,
      name: 'LookupText',
      arguments: [
        [
          { value: 'a', text: 'Alpha' },
          { value: 'b', text: 'Beta' },
        ],
        'b',
      ],
    })
  })

  it('should not require prepare on the object-form factory', () => {
    // Arrange / Act
    const { generators } = defineGeneratorFunctions<{
      Today: () => GeneratorBuilder<[]>
    }>({
      Today: {
        factory: () => () => '2026-04-01',
      },
    })

    // Assert
    expect(generators.Today().build()).toEqual({
      type: FunctionType.GENERATOR,
      name: 'Today',
      arguments: [],
    })
  })
})
