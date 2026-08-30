import { expectTypeOf, vi } from 'vitest'
import { z } from 'zod'
import EffectRegistry from '../registries/EffectRegistry'
import { FunctionCallType, FunctionEntryType } from '../../shared/taxonomy'
import { getEntryStamp } from '../builders/utils/stampEntry'
import { effect } from './effect'
import type { Callsite } from '../builders/utils/captureCallsite'
import type { EffectContext } from './effect'
import type { AccessHook, EffectFunctionExpr, Resolvable } from '../types/expressions.type'

const callsiteOf = (value: unknown): Callsite | undefined =>
  Object.getOwnPropertyDescriptor(value, '__callsite')?.value as Callsite | undefined

const saveDraftFactory = () => (context: EffectContext, key: string) => {
  context.setAnswer(key, 'saved')
}

const SaveDraft = effect('Draft.Save', {
  argumentsSchema: z.tuple([z.string()]),
  factory: saveDraftFactory,
})

describe('effect()', () => {
  describe('entry creation', () => {
    it('should carry the given name, function type, schemas, and factory on a named entry', () => {
      expect(SaveDraft.name).toBe('Draft.Save')
      expect(SaveDraft._forge).toBe(FunctionEntryType.EFFECT)
      expect(SaveDraft.argumentsSchema?.safeParse(['draft']).success).toBe(true)
      expect(SaveDraft.factory).toBe(saveDraftFactory)
    })

    it('should leave the name undefined on an anonymous entry', () => {
      // Arrange & Act
      const anonymous = effect({ factory: () => () => undefined })

      // Assert
      expect(anonymous.name).toBeUndefined()
      expect(anonymous().name).toBe('effect')
    })
  })

  describe('expression building', () => {
    it('should build an effect expression carrying the author name', () => {
      // Arrange & Act
      const expr = SaveDraft('draft')

      // Assert
      expect(expr).toEqual({
        _forge: FunctionCallType.EFFECT,
        name: 'Draft.Save',
        arguments: ['draft'],
      })
    })

    it('should apply prepare to the authored arguments', () => {
      // Arrange
      const prepare = vi.fn((key: string) => [key.trim()])
      const trimmed = effect('Trimmed', {
        argumentsSchema: z.tuple([z.string()]),
        prepare,
        factory: () => () => undefined,
      })

      // Act
      const expr = trimmed(' draft ')

      // Assert
      expect(prepare).toHaveBeenCalledWith(' draft ')
      expect(expr.arguments).toEqual(['draft'])
    })

    it('should match the expression shape a registry handle produces', () => {
      // Arrange
      const registry = new EffectRegistry()
      const handle = registry.register(
        'Save',
        { prepare: (key: string) => [key, 'padded'] },
        () => (_context: unknown, _key: string) => undefined,
      )
      const entry = effect('Save', {
        prepare: (key: string) => [key, 'padded'],
        factory: () => () => undefined,
      })

      // Act
      const registryExpr = handle('draft')
      const entryExpr = entry('draft')

      // Assert
      expect(Object.keys(entryExpr)).toEqual(Object.keys(registryExpr))
      expect(entryExpr).toEqual(registryExpr)
    })
  })

  describe('stamping', () => {
    it('should stamp each expression with the entry itself, non-enumerably', () => {
      // Arrange & Act
      const expr = SaveDraft('draft')

      // Assert
      expect(getEntryStamp(expr)).toBe(SaveDraft)
      expect(Object.getOwnPropertyDescriptor(expr, '__entry')?.enumerable).toBe(false)
    })

    it('should stamp each expression with a callsite that names the calling file', () => {
      // Arrange & Act
      const expr = SaveDraft('draft')

      // Assert
      expect(callsiteOf(expr)?.stack).toContain('effect.test.ts')
      expect(callsiteOf(expr)?.stack).not.toContain('createEntry.ts:')
    })
  })

  describe('types', () => {
    it('should not expose input or output schemas', () => {
      type HasInputSchema = 'inputSchema' extends keyof typeof SaveDraft ? true : false
      type HasOutputSchema = 'outputSchema' extends keyof typeof SaveDraft ? true : false

      expectTypeOf<HasInputSchema>().toEqualTypeOf<false>()
      expectTypeOf<HasOutputSchema>().toEqualTypeOf<false>()
    })

    it('should type the evaluator as context first, then the annotated arguments', () => {
      const typed = effect('Typed', {
        factory: () => (context, key: string, overwrite: boolean) => {
          expectTypeOf(context).toEqualTypeOf<EffectContext>()
          if (overwrite) {
            context.setAnswer(key, 'saved')
          }
        },
      })

      expect(typed.name).toBe('Typed')
      expectTypeOf<Parameters<typeof typed>>().toEqualTypeOf<[Resolvable<string>, Resolvable<boolean>]>()
    })

    it('should type the entry call signature as resolvable arguments from the evaluator parameters', () => {
      expectTypeOf<Parameters<typeof SaveDraft>>().toEqualTypeOf<[Resolvable<string>]>()

      // @ts-expect-error - the evaluator declares a string, so a number is rejected
      SaveDraft(5)
    })

    it('should build expressions accepted wherever registry-handle expressions are', () => {
      // Arrange & Act
      const expr = SaveDraft('draft')
      const hookEffects: AccessHook['effects'] = [expr]

      // Assert
      expectTypeOf(expr).toExtend<EffectFunctionExpr>()
      expect(hookEffects).toHaveLength(1)
    })
  })
})
