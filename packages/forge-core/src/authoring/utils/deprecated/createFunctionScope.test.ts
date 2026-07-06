import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionType } from '../../types/enums'
import { createFunctionsRegistry } from './createFunctionsRegistry'
import { createFunctionScope } from './createFunctionScope'

interface TestDeps {
  readonly prefix: string
  readonly values: readonly string[]
}

// These utilities now emit runtime deprecation warnings; silence them so the suite output stays clean.
beforeEach(() => {
  vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createFunctionScope()', () => {
  describe('transformer()', () => {
    it('should collect a dependency-injected implementation when creating a transformer expression', () => {
      // Arrange
      const scope = createFunctionScope<TestDeps>()
      const deps = { prefix: 'case-', values: [] }

      // Act
      const expression = scope.transformer(
        'ToCaseReference',
        injectedDeps => (value: string, suffix: string) => `${injectedDeps.prefix}${value}${suffix}`,
        '-summary',
      )
      const registry = createFunctionsRegistry(scope.implementations, deps)
      const result = registry.ToCaseReference.evaluate('123', '-summary')

      // Assert
      expect(expression).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'ToCaseReference',
        arguments: ['-summary'],
      })
      expect(result).toBe('case-123-summary')
    })
  })

  describe('function types', () => {
    it('should create normal Forge expressions and builders for every function type', async () => {
      // Arrange
      const scope = createFunctionScope<TestDeps>()
      const contextData: Record<string, unknown> = {}
      const context = {
        setData: (key: string, value: unknown) => {
          contextData[key] = value
        },
      }

      // Act
      const conditionExpression = scope.condition('HasPrefix', deps => (value: string) => value.startsWith(deps.prefix))
      const effectExpression = scope.effect(
        'SetFirstValue',
        deps => async (effectContext: typeof context, key: string) => {
          effectContext.setData(key, deps.values[0])
        },
        'firstValue',
      )
      const generatorExpression = scope.generator('FirstValue', deps => () => deps.values[0]).build()
      const registry = createFunctionsRegistry(scope.implementations, {
        prefix: 'case-',
        values: ['alpha'],
      })

      await registry.SetFirstValue.evaluate(context, 'firstValue')

      // Assert
      expect(conditionExpression).toEqual({
        type: FunctionType.CONDITION,
        name: 'HasPrefix',
        arguments: [],
      })
      expect(effectExpression).toEqual({
        type: FunctionType.EFFECT,
        name: 'SetFirstValue',
        arguments: ['firstValue'],
      })
      expect(generatorExpression).toEqual({
        type: FunctionType.GENERATOR,
        name: 'FirstValue',
        arguments: [],
      })
      expect(registry.HasPrefix.evaluate('case-123')).toBe(true)
      expect(registry.FirstValue.evaluate()).toBe('alpha')
      expect(contextData.firstValue).toBe('alpha')
    })

    it('should reuse a collected implementation when the same factory reference is used more than once', () => {
      // Arrange
      const scope = createFunctionScope<TestDeps>()
      const factory = (deps: TestDeps) => (value: string, suffix: string) => `${deps.prefix}${value}${suffix}`

      // Act
      const firstExpression = scope.transformer('ReusableName', factory, 'a')
      const secondExpression = scope.transformer('ReusableName', factory, 'b')
      const registry = createFunctionsRegistry(scope.implementations, { prefix: 'case-', values: [] })

      // Assert
      expect(firstExpression.arguments).toEqual(['a'])
      expect(secondExpression.arguments).toEqual(['b'])
      expect(registry.ReusableName.evaluate('123', '-summary')).toBe('case-123-summary')
    })

    it('should reuse a collected implementation when inline factories have the same source', () => {
      // Arrange
      const scope = createFunctionScope<TestDeps>()
      const firstExpression = scope.transformer(
        'ReusableName',
        deps => (value: string, suffix: string) => `${deps.prefix}${value}${suffix}`,
        'a',
      )

      // Act
      const secondExpression = scope.transformer(
        'ReusableName',
        deps => (value: string, suffix: string) => `${deps.prefix}${value}${suffix}`,
        'b',
      )
      const registry = createFunctionsRegistry(scope.implementations, { prefix: 'case-', values: [] })

      // Assert
      expect(firstExpression.arguments).toEqual(['a'])
      expect(secondExpression.arguments).toEqual(['b'])
      expect(registry.ReusableName.evaluate('123', '-summary')).toBe('case-123-summary')
    })

    it('should throw when the same name is used for a different implementation', () => {
      // Arrange
      const scope = createFunctionScope<TestDeps>()
      scope.transformer('ConflictingName', deps => (value: string) => `${deps.prefix}${value}`)

      // Act
      const act = () => scope.transformer('ConflictingName', () => (value: string) => value)

      // Assert
      expect(act).toThrow(
        'Function scope already contains a different implementation named "ConflictingName". ' +
          'Reuse a name only for the same inline function, or choose a unique name.',
      )
    })
  })
})
