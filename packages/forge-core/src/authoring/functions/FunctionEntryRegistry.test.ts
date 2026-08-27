import { condition } from './condition'
import { finaliseBuilders } from '../builders/utils/finaliseBuilders'
import { CONDITION_OUTPUT_SCHEMA } from '../registries/BaseFunctionRegistry'
import { FunctionCallType } from '../types/enums'
import ForgeFunctionEntryBuildError from '../../engine/errors/ForgeFunctionEntryBuildError'
import { FunctionEntryRegistry } from './FunctionEntryRegistry'
import type { ConditionFunctionExpr } from '../types/expressions.type'

describe('FunctionEntryRegistry', () => {
  describe('collectEmbedded()', () => {
    it('should register a stamped expression under its author name with registry row fields', () => {
      // Arrange
      const entry = condition('Test.MinLength', {
        factory: () => (value: unknown, min: number) => String(value).length >= min,
      })
      const tree = finaliseBuilders({ steps: [{ check: entry(3) }] })
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectEmbedded(tree)

      // Assert
      const row = registry.build()['Test.MinLength']

      expect(row).toBeDefined()
      expect(row.name).toBe('Test.MinLength')
      expect(row.functionType).toBe(FunctionCallType.CONDITION)
      expect(row.isAsync).toBe(false)
      expect(row.outputSchema).toBe(CONDITION_OUTPUT_SCHEMA)
      expect(row.evaluate('abcd', 3)).toBe(true)
      expect(row.evaluate('ab', 3)).toBe(false)
    })

    it('should call the factory once for an entry embedded in several positions', () => {
      // Arrange
      const factory = vi.fn(() => (value: unknown) => value === 'x')
      const entry = condition('Test.Once', { factory })
      const tree = finaliseBuilders({ first: entry(), second: entry(), nested: [{ third: entry() }] })
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectEmbedded(tree)
      const rows = registry.build()

      // Assert
      expect(factory).toHaveBeenCalledTimes(1)
      expect(Object.keys(rows)).toEqual(['Test.Once'])
    })

    it('should rename a colliding same-named entry and rewrite its expressions', () => {
      // Arrange
      const first = condition('Test.Dup', { factory: () => (value: unknown) => value === 'a' })
      const second = condition('Test.Dup', { factory: () => (value: unknown) => value === 'b' })
      const tree = finaliseBuilders({ first: first(), second: second(), secondAgain: second() }) as {
        first: ConditionFunctionExpr
        second: ConditionFunctionExpr
        secondAgain: ConditionFunctionExpr
      }
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectEmbedded(tree)

      // Assert
      const rows = registry.build()

      expect(tree.first.name).toBe('Test.Dup')
      expect(tree.second.name).toBe('Test.Dup@2')
      expect(tree.secondAgain.name).toBe('Test.Dup@2')
      expect(rows['Test.Dup'].evaluate('a')).toBe(true)
      expect(rows['Test.Dup@2'].evaluate('a')).toBe(false)
    })

    it('should disambiguate anonymous entries under the helper label', () => {
      // Arrange
      const first = condition({ factory: () => (value: unknown) => value === 'a' })
      const second = condition({ factory: () => (value: unknown) => value === 'b' })
      const tree = finaliseBuilders({ first: first(), second: second() }) as {
        first: ConditionFunctionExpr
        second: ConditionFunctionExpr
      }
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectEmbedded(tree)

      // Assert
      expect(tree.first.name).toBe('condition')
      expect(tree.second.name).toBe('condition@2')
      expect(Object.keys(registry.build())).toEqual(['condition', 'condition@2'])
    })

    it('should detect async evaluators', () => {
      // Arrange
      const entry = condition('Test.Async', { factory: () => async (value: unknown) => value === 'ok' })
      const tree = finaliseBuilders({ check: entry() })
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectEmbedded(tree)

      // Assert
      expect(registry.build()['Test.Async'].isAsync).toBe(true)
    })
  })

  describe('collectListed()', () => {
    it('should register a listed entry under its author name', () => {
      // Arrange
      const entry = condition('Test.Listed', { factory: () => (value: unknown) => value === 'yes' })
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectListed(entry)

      // Assert
      const row = registry.build()['Test.Listed']

      expect(row.name).toBe('Test.Listed')
      expect(row.evaluate('yes')).toBe(true)
    })

    it('should share one row when an entry is both listed and embedded', () => {
      // Arrange
      const factory = vi.fn(() => (value: unknown) => value === 'x')
      const entry = condition('Test.Both', { factory })
      const tree = finaliseBuilders({ check: entry() })
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectListed(entry)
      registry.collectEmbedded(tree)
      const rows = registry.build()

      // Assert
      expect(factory).toHaveBeenCalledTimes(1)
      expect(Object.keys(rows)).toEqual(['Test.Both'])
    })

    it('should rename an embedded entry colliding with a listed name', () => {
      // Arrange
      const listed = condition('Test.Taken', { factory: () => () => true })
      const embedded = condition('Test.Taken', { factory: () => () => false })
      const tree = finaliseBuilders({ check: embedded() }) as { check: ConditionFunctionExpr }
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectListed(listed)
      registry.collectEmbedded(tree)

      // Assert
      const rows = registry.build()

      expect(tree.check.name).toBe('Test.Taken@2')
      expect(rows['Test.Taken'].evaluate(undefined)).toBe(true)
      expect(rows['Test.Taken@2'].evaluate(undefined)).toBe(false)
    })

    it('should throw when listing an anonymous entry', () => {
      // Arrange
      const entry = condition({ factory: () => () => true })
      const registry = new FunctionEntryRegistry()

      // Act & Assert
      expect(() => registry.collectListed(entry)).toThrow('cannot be listed in "functions"')
    })

    it('should throw when two entries are listed under the same name', () => {
      // Arrange
      const first = condition('Test.Clash', { factory: () => () => true })
      const second = condition('Test.Clash', { factory: () => () => false })
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectListed(first)

      // Assert
      expect(() => registry.collectListed(second)).toThrow('listed under the name "Test.Clash"')
    })

    it('should register one row when the same entry is listed twice', () => {
      // Arrange
      const factory = vi.fn(() => () => true)
      const entry = condition('Test.Twice', { factory })
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectListed(entry)
      registry.collectListed(entry)
      const rows = registry.build()

      // Assert
      expect(factory).toHaveBeenCalledTimes(1)
      expect(Object.keys(rows)).toEqual(['Test.Twice'])
    })
  })

  describe('build()', () => {
    it('should pass the build dependencies to the factory', () => {
      // Arrange
      const entry = condition<{ min: number }>('Test.WithDeps', {
        factory: deps => (value: unknown) => String(value).length >= deps.min,
      })
      const tree = finaliseBuilders({ check: entry() })
      const registry = new FunctionEntryRegistry<{ min: number }>()

      // Act
      registry.collectEmbedded(tree)
      const rows = registry.build({ min: 4 })

      // Assert
      expect(rows['Test.WithDeps'].evaluate('abcd')).toBe(true)
      expect(rows['Test.WithDeps'].evaluate('abc')).toBe(false)
    })

    it('should aggregate one ForgeFunctionEntryBuildError per broken factory with expression diagnostics', () => {
      // Arrange
      const entry = condition('Test.Broken', {
        factory: (): (() => boolean) => {
          throw new Error('boom')
        },
      })
      const tree = finaliseBuilders({ steps: [{ check: entry() }, { check: entry() }] })
      const registry = new FunctionEntryRegistry()

      // Act
      registry.collectEmbedded(tree)

      // Assert
      try {
        registry.build()
        expect.unreachable('build() should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)

        const [buildError] = (error as AggregateError).errors as ForgeFunctionEntryBuildError[]

        expect((error as AggregateError).errors).toHaveLength(1)
        expect(buildError).toBeInstanceOf(ForgeFunctionEntryBuildError)
        expect(buildError.functionName).toBe('Test.Broken')
        expect(buildError.functionType).toBe(FunctionCallType.CONDITION)
        expect(buildError.formattedPath).toContain('check')
        expect(buildError.cause).toBeInstanceOf(Error)
      }
    })
  })
})
