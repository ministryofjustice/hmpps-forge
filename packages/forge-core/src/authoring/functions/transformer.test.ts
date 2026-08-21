import { expectTypeOf, vi } from 'vitest'
import { z } from 'zod'
import { Answer } from '../builders'
import TransformerRegistry from '../registries/TransformerRegistry'
import { FunctionType } from '../types/enums'
import { getEntryStamp } from '../builders/utils/stampEntry'
import { transformer } from './transformer'
import type { Callsite } from '../builders/utils/captureCallsite'
import type { PipelineExpr, Resolvable, TransformerFunctionExpr } from '../types/expressions.type'

const callsiteOf = (value: unknown): Callsite | undefined =>
  Object.getOwnPropertyDescriptor(value, '__callsite')?.value as Callsite | undefined

const truncateFactory = () => (value: string, max: number) => value.slice(0, max)

const Truncate = transformer('Text.Truncate', {
  inputSchema: z.string(),
  argumentsSchema: z.tuple([z.number()]),
  factory: truncateFactory,
})

describe('transformer()', () => {
  describe('entry creation', () => {
    it('should carry the given name, function type, schemas, and factory on a named entry', () => {
      expect(Truncate.name).toBe('Text.Truncate')
      expect(Truncate.functionType).toBe(FunctionType.TRANSFORMER)
      expect(Truncate.inputSchema?.safeParse('summary').success).toBe(true)
      expect(Truncate.argumentsSchema?.safeParse([20]).success).toBe(true)
      expect(Truncate.outputSchema).toBeUndefined()
      expect(Truncate.factory).toBe(truncateFactory)
    })

    it('should leave the name undefined on an anonymous entry', () => {
      // Arrange & Act
      const shouty = transformer({ factory: () => value => String(value).toUpperCase() })

      // Assert
      expect(shouty.name).toBeUndefined()
      expect(shouty().name).toBe('transformer')
    })
  })

  describe('expression building', () => {
    it('should build a transformer expression carrying the author name', () => {
      // Arrange & Act
      const expr = Truncate(20)

      // Assert
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'Text.Truncate',
        arguments: [20],
      })
    })

    it('should apply prepare to the authored arguments', () => {
      // Arrange
      const prepare = vi.fn((max: number) => [max * 2])
      const doubled = transformer('Doubled', {
        argumentsSchema: z.tuple([z.number()]),
        prepare,
        factory: () => (value, max) => String(value).slice(0, max),
      })

      // Act
      const expr = doubled(5)

      // Assert
      expect(prepare).toHaveBeenCalledWith(5)
      expect(expr.arguments).toEqual([10])
    })

    it('should match the expression shape a registry handle produces', () => {
      // Arrange
      const registry = new TransformerRegistry()
      const handle = registry.register(
        'Truncate',
        { prepare: (max: number) => [max, 'padded'] },
        () => (value: string, max: number) => value.slice(0, max),
      )
      const entry = transformer('Truncate', {
        prepare: (max: number) => [max, 'padded'],
        factory: () => value => value,
      })

      // Act
      const registryExpr = handle(5)
      const entryExpr = entry(5)

      // Assert
      expect(Object.keys(entryExpr)).toEqual(Object.keys(registryExpr))
      expect(entryExpr).toEqual(registryExpr)
    })
  })

  describe('stamping', () => {
    it('should stamp each expression with the entry itself, non-enumerably', () => {
      // Arrange & Act
      const expr = Truncate(20)

      // Assert
      expect(getEntryStamp(expr)).toBe(Truncate)
      expect(Object.getOwnPropertyDescriptor(expr, '__entry')?.enumerable).toBe(false)
    })

    it('should stamp each expression with a callsite that names the calling file', () => {
      // Arrange & Act
      const expr = Truncate(20)

      // Assert
      expect(callsiteOf(expr)?.stack).toContain('transformer.test.ts')
      expect(callsiteOf(expr)?.stack).not.toContain('createEntry.ts:')
    })
  })

  describe('types', () => {
    it('should accept narrower author annotations on the evaluator', () => {
      const typed = transformer('Typed', {
        factory: () => (value: string, max: number, strict: boolean) => value.slice(0, strict ? max : max + 1),
      })

      expect(typed.name).toBe('Typed')
      expectTypeOf<Parameters<typeof typed>>().toEqualTypeOf<[Resolvable<number>, Resolvable<boolean>]>()
    })

    it('should type the entry call signature as resolvable arguments from the evaluator parameters', () => {
      expectTypeOf<Parameters<typeof Truncate>>().toEqualTypeOf<[Resolvable<number>]>()

      // A reference resolving to the argument at runtime is accepted
      Truncate(Answer('maximumLength'))

      // @ts-expect-error - the evaluator declares a number, so a string is rejected
      Truncate('20')
    })

    it('should build expressions accepted wherever registry-handle expressions are', () => {
      // Arrange & Act
      const expr = Truncate(20)
      const piped = Answer('summary').pipe(expr)

      // Assert
      expectTypeOf(expr).toExtend<TransformerFunctionExpr>()
      expectTypeOf(expr).toExtend<PipelineExpr['steps'][number]>()
      expect(piped).toBeDefined()
    })
  })
})
