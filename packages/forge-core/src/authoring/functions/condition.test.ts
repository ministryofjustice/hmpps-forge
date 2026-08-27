import { expectTypeOf, vi } from 'vitest'
import { z } from 'zod'
import { Answer } from '../builders'
import ConditionRegistry from '../registries/ConditionRegistry'
import { FunctionCallType } from '../types/enums'
import { getEntryStamp } from '../builders/utils/stampEntry'
import { condition } from './condition'
import type { Callsite } from '../builders/utils/captureCallsite'
import type {
  ConditionBranchExpr,
  ConditionFunctionExpr,
  PredicateTestExpr,
  Resolvable,
  ResolvableExpression,
} from '../types/expressions.type'

const callsiteOf = (value: unknown): Callsite | undefined =>
  Object.getOwnPropertyDescriptor(value, '__callsite')?.value as Callsite | undefined

const isValidCrnFactory = () => (value: string, min: number) => value.length >= min

const IsValidCrn = condition('Caseload.IsValidCrn', {
  inputSchema: z.string(),
  argumentsSchema: z.tuple([z.number()]),
  factory: isValidCrnFactory,
})

describe('condition()', () => {
  describe('entry creation', () => {
    it('should carry the given name, function type, schemas, and factory on a named entry', () => {
      expect(IsValidCrn.name).toBe('Caseload.IsValidCrn')
      expect(IsValidCrn.functionType).toBe(FunctionCallType.CONDITION)
      expect(IsValidCrn.inputSchema?.safeParse('X123456').success).toBe(true)
      expect(IsValidCrn.argumentsSchema?.safeParse([5]).success).toBe(true)
      expect(IsValidCrn.outputSchema).toBeUndefined()
      expect(IsValidCrn.factory).toBe(isValidCrnFactory)
    })

    it('should leave the name undefined on an anonymous entry', () => {
      // Arrange & Act
      const looksOdd = condition({ factory: () => value => value !== 'ok' })

      // Assert
      expect(looksOdd.name).toBeUndefined()
      expect(looksOdd().name).toBe('condition')
    })

    it('should carry the outputSchema when provided', () => {
      // Arrange & Act
      const scored = condition({ outputSchema: z.boolean(), factory: () => () => true })

      // Assert
      expect(scored.outputSchema?.safeParse(true).success).toBe(true)
    })
  })

  describe('expression building', () => {
    it('should build a condition expression carrying the author name', () => {
      // Arrange & Act
      const expr = IsValidCrn(5)

      // Assert
      expect(expr).toEqual({
        type: FunctionCallType.CONDITION,
        name: 'Caseload.IsValidCrn',
        arguments: [5],
      })
    })

    it('should apply prepare to the authored arguments', () => {
      // Arrange
      const prepare = vi.fn((min: number) => [min * 2])
      const doubled = condition('Doubled', {
        argumentsSchema: z.tuple([z.number()]),
        prepare,
        factory: () => (value, min) => Number(value) >= min,
      })

      // Act
      const expr = doubled(5)

      // Assert
      expect(prepare).toHaveBeenCalledWith(5)
      expect(expr.arguments).toEqual([10])
    })

    it('should match the expression shape a registry handle produces', () => {
      // Arrange
      const registry = new ConditionRegistry()
      const handle = registry.register(
        'MinLength',
        { prepare: (min: number) => [min, 'padded'] },
        () => (value: string, min: number) => value.length >= min,
      )
      const entry = condition('MinLength', {
        prepare: (min: number) => [min, 'padded'],
        factory: () => () => true,
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
      const expr = IsValidCrn(5)

      // Assert
      expect(getEntryStamp(expr)).toBe(IsValidCrn)
      expect(Object.getOwnPropertyDescriptor(expr, '__entry')?.enumerable).toBe(false)
    })

    it('should stamp each expression with a callsite that names the calling file', () => {
      // Arrange & Act
      const expr = IsValidCrn(5)

      // Assert
      expect(callsiteOf(expr)?.stack).toContain('condition.test.ts')
      expect(callsiteOf(expr)?.stack).not.toContain('createEntry.ts:')
    })

    it('should keep the stamps invisible to JSON serialisation', () => {
      // Arrange & Act
      const json = JSON.stringify(IsValidCrn(5))

      // Assert
      expect(json).not.toContain('__entry')
      expect(json).not.toContain('__callsite')
    })
  })

  describe('types', () => {
    it('should accept narrower author annotations on the evaluator', () => {
      const typed = condition('Typed', {
        factory: () => (value: string, min: number, strict: boolean) => value.length >= min && strict,
      })

      expect(typed.name).toBe('Typed')
      expectTypeOf<Parameters<typeof typed>>().toEqualTypeOf<[Resolvable<number>, Resolvable<boolean>]>()
    })

    it('should type the entry call signature as resolvable arguments from the evaluator parameters', () => {
      expectTypeOf<Parameters<typeof IsValidCrn>>().toEqualTypeOf<[Resolvable<number>]>()

      // A reference resolving to the argument at runtime is accepted
      IsValidCrn(Answer('minimumLength'))

      // An expression declaring the matching resolved type is accepted
      IsValidCrn(null as unknown as ResolvableExpression<number>)

      // @ts-expect-error - the evaluator declares a number, so a string is rejected
      IsValidCrn('5')

      // @ts-expect-error - an expression declaring a string resolution cannot fill a number argument
      IsValidCrn(null as unknown as ResolvableExpression<string>)
    })

    it('should build expressions accepted wherever registry-handle expressions are', () => {
      // Arrange & Act
      const expr = IsValidCrn(5)
      const predicate = Answer('crn').match(expr)

      // Assert
      expectTypeOf(expr).toExtend<ConditionFunctionExpr>()
      expectTypeOf(expr).toExtend<ConditionBranchExpr>()
      expectTypeOf(predicate).toEqualTypeOf<PredicateTestExpr>()
    })

    it('should type the factory dependencies from an annotated deps parameter', () => {
      interface Api {
        check(value: string): boolean
      }

      const checked = condition('Checked', {
        inputSchema: z.string(),
        factory: (deps: { api: Api }) => value => deps.api.check(value),
      })

      expectTypeOf(checked.factory).parameter(0).toEqualTypeOf<{ api: Api }>()
    })
  })
})
