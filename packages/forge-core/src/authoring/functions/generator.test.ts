import { expectTypeOf, vi } from 'vitest'
import { z } from 'zod'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import GeneratorRegistry from '../registries/GeneratorRegistry'
import { FunctionCallType, PredicateType } from '../types/enums'
import { finaliseBuilders } from '../builders/utils/finaliseBuilders'
import { getEntryStamp } from '../builders/utils/stampEntry'
import { condition } from './condition'
import { generator } from './generator'
import type { Callsite } from '../builders/utils/captureCallsite'
import type { ChainableGenerator } from '../builders/types'
import type {
  GeneratorFunctionExpr,
  PredicateTestExpr,
  Resolvable,
  TransformerFunctionExpr,
} from '../types/expressions.type'

const callsiteOf = (value: unknown): Callsite | undefined =>
  Object.getOwnPropertyDescriptor(value, '__callsite')?.value as Callsite | undefined

const tomorrowFactory = () => (offset: number) => Date.now() + offset

const Tomorrow = generator('Date.Tomorrow', {
  argumentsSchema: z.tuple([z.number()]),
  factory: tomorrowFactory,
})

const asBuilder = (value: ChainableGenerator): GeneratorBuilder<any[]> => value as GeneratorBuilder<any[]>

describe('generator()', () => {
  describe('entry creation', () => {
    it('should carry the given name, function type, schemas, and factory on a named entry', () => {
      expect(Tomorrow.name).toBe('Date.Tomorrow')
      expect(Tomorrow.functionType).toBe(FunctionCallType.GENERATOR)
      expect(Tomorrow.inputSchema).toBeUndefined()
      expect(Tomorrow.argumentsSchema?.safeParse([1]).success).toBe(true)
      expect(Tomorrow.outputSchema).toBeUndefined()
      expect(Tomorrow.factory).toBe(tomorrowFactory)
    })

    it('should leave the name undefined on an anonymous entry', () => {
      // Arrange & Act
      const anonymous = generator({ factory: () => () => 'value' })

      // Assert
      expect(anonymous.name).toBeUndefined()
      expect(asBuilder(anonymous()).build().name).toBe('generator')
    })
  })

  describe('builder building', () => {
    it('should return a generator builder wrapping an expression carrying the author name', () => {
      // Arrange & Act
      const builder = Tomorrow(1)

      // Assert
      expect(builder).toBeInstanceOf(GeneratorBuilder)
      expect(asBuilder(builder).build()).toEqual({
        type: FunctionCallType.GENERATOR,
        name: 'Date.Tomorrow',
        arguments: [1],
      })
    })

    it('should apply prepare to the authored arguments', () => {
      // Arrange
      const prepare = vi.fn((offset: number) => [offset * 2])
      const doubled = generator('Doubled', {
        argumentsSchema: z.tuple([z.number()]),
        prepare,
        factory: () => offset => offset,
      })

      // Act
      const builder = doubled(5)

      // Assert
      expect(prepare).toHaveBeenCalledWith(5)
      expect(asBuilder(builder).build().arguments).toEqual([10])
    })

    it('should match the builder a registry handle produces', () => {
      // Arrange
      const registry = new GeneratorRegistry()
      const handle = registry.register(
        'Now',
        { prepare: (offset: number) => [offset, 'padded'] },
        () => (_offset: number) => 0,
      )
      const entry = generator('Now', {
        prepare: (offset: number) => [offset, 'padded'],
        factory: () => () => 0,
      })

      // Act
      const registryExpr = asBuilder(handle(5)).build()
      const entryExpr = asBuilder(entry(5)).build()

      // Assert
      expect(entry(5)).toBeInstanceOf(GeneratorBuilder)
      expect(Object.keys(entryExpr)).toEqual(Object.keys(registryExpr))
      expect(entryExpr).toEqual(registryExpr)
    })

    it('should compose like a registry generator handle', () => {
      // Arrange
      const isFuture = condition({ factory: () => () => true })
      const step: TransformerFunctionExpr = { type: FunctionCallType.TRANSFORMER, name: 'AddDays', arguments: [7] }

      // Act
      const matched = Tomorrow(1).match(isFuture())
      const negated = Tomorrow(1).not.match(isFuture())
      const piped = Tomorrow(1).pipe(step)

      // Assert
      expect(matched).toEqual(expect.objectContaining({ type: PredicateType.TEST, negate: false }))
      expect(negated).toEqual(expect.objectContaining({ type: PredicateType.TEST, negate: true }))
      expect(piped).toBeDefined()
    })
  })

  describe('stamping', () => {
    it('should stamp the builder and its expression with the entry itself, non-enumerably', () => {
      // Arrange & Act
      const builder = Tomorrow(1)
      const expr = asBuilder(builder).build()

      // Assert
      expect(getEntryStamp(builder)).toBe(Tomorrow)
      expect(getEntryStamp(expr)).toBe(Tomorrow)
      expect(Object.getOwnPropertyDescriptor(expr, '__entry')?.enumerable).toBe(false)
    })

    it('should stamp the builder with a callsite that names the calling file', () => {
      // Arrange & Act
      const builder = Tomorrow(1)

      // Assert
      expect(callsiteOf(builder)?.stack).toContain('generator.test.ts')
      expect(callsiteOf(asBuilder(builder).build())?.stack).toContain('generator.test.ts')
    })

    it('should keep the entry stamp on the finalised expression of a standalone builder', () => {
      // Arrange & Act
      const finalised = finaliseBuilders({ value: Tomorrow(1) }) as { value: GeneratorFunctionExpr }

      // Assert
      expect(finalised.value.name).toBe('Date.Tomorrow')
      expect(getEntryStamp(finalised.value)).toBe(Tomorrow)
    })

    it('should keep the entry stamp on the finalised subject of a match', () => {
      // Arrange
      const isFuture = condition({ factory: () => () => true })

      // Act
      const finalised = finaliseBuilders({ rule: Tomorrow(1).match(isFuture()) }) as { rule: PredicateTestExpr }

      // Assert
      expect((finalised.rule.subject as GeneratorFunctionExpr).name).toBe('Date.Tomorrow')
      expect(getEntryStamp(finalised.rule.subject)).toBe(Tomorrow)
      expect(getEntryStamp(finalised.rule.condition)).toBe(isFuture)
    })
  })

  describe('types', () => {
    it('should accept author annotations on the evaluator parameters', () => {
      const typed = generator('Typed', {
        factory: () => (offset: number, strict: boolean) => (strict ? offset : 0),
      })

      expect(typed.name).toBe('Typed')
      expectTypeOf<Parameters<typeof typed>>().toEqualTypeOf<[Resolvable<number>, Resolvable<boolean>]>()
    })

    it('should type the entry call signature as resolvable arguments from the evaluator parameters', () => {
      expectTypeOf<Parameters<typeof Tomorrow>>().toEqualTypeOf<[Resolvable<number>]>()

      // @ts-expect-error - the evaluator declares a number, so a string is rejected
      Tomorrow('1')
    })

    it('should return builders accepted wherever registry-handle builders are', () => {
      // Arrange & Act
      const builder = Tomorrow(1)
      const isFuture = condition({ factory: () => () => true })

      // Assert
      expectTypeOf(builder).toExtend<ChainableGenerator>()
      expectTypeOf(builder.match(isFuture())).toEqualTypeOf<PredicateTestExpr>()
    })
  })
})
