import { describe, expect, it, vi } from 'vitest'
import {
  access,
  condition,
  createForgePackage,
  effect,
  generator,
  transformer,
  FunctionType,
  Self,
} from '../../src/authoring'
import type { EffectContext } from '../../src/authoring'
import type { ConditionFunctionExpr } from '../../src/authoring/types/expressions.type'
import { ForgeTestHarness } from '../../src/testing'
import ForgeRegistrationError from '../../src/engine/errors/ForgeRegistrationError'
import { createEntriesClient, fieldWithRule, journeyWithFields, testInput } from './functionEntryRegistration.fixtures'

describe('function entry registration contracts', () => {
  describe('embedded entries', () => {
    it('should register and evaluate a named embedded entry with no functions listing', async () => {
      // Arrange
      const IsAtLeast = condition('Test.IsAtLeast', {
        factory: () => (value: unknown, min: number) => String(value ?? '').length >= min,
      })
      const client = createEntriesClient([fieldWithRule('crn', Self().match(IsAtLeast(3)), 'Too short')])

      // Act
      const invalid = await client.post('/entries/step-one', { session: {}, body: { crn: 'ab' } })
      const valid = await client.post('/entries/step-one', { session: {}, body: { crn: 'abcd' } })

      // Assert
      expect(invalid.type).toBe('render')

      if (invalid.type === 'render') {
        expect(invalid.getValidationErrorsByFieldCode('crn')).toHaveLength(1)
      }

      if (valid.type === 'render') {
        expect(valid.getValidationErrorsByFieldCode('crn')).toHaveLength(0)
      }
    })

    it('should register and evaluate an anonymous inline entry', async () => {
      // Arrange
      const isYes = condition({ factory: () => (value: unknown) => value === 'yes' })
      const client = createEntriesClient([fieldWithRule('agree', Self().match(isYes()), 'Say yes')])

      // Act
      const invalid = await client.post('/entries/step-one', { session: {}, body: { agree: 'no' } })
      const valid = await client.post('/entries/step-one', { session: {}, body: { agree: 'yes' } })

      // Assert
      if (invalid.type === 'render') {
        expect(invalid.getValidationErrorsByFieldCode('agree')).toHaveLength(1)
      }

      if (valid.type === 'render') {
        expect(valid.getValidationErrorsByFieldCode('agree')).toHaveLength(0)
      }
    })

    it('should call the factory once when an entry is used in several positions', () => {
      // Arrange
      const factory = vi.fn(() => (value: unknown) => value === 'x')
      const OnlyX = condition('Test.OnlyX', { factory })

      // Act
      createEntriesClient([
        fieldWithRule('first', Self().match(OnlyX()), 'Must be x'),
        fieldWithRule('second', Self().match(OnlyX()), 'Must be x'),
      ])

      // Assert
      expect(factory).toHaveBeenCalledTimes(1)
    })

    it('should keep two same-named entries isolated within one journey', async () => {
      // Arrange
      const IsA = condition('Test.Dup', { factory: () => (value: unknown) => value === 'a' })
      const IsB = condition('Test.Dup', { factory: () => (value: unknown) => value === 'b' })
      const client = createEntriesClient([
        fieldWithRule('fieldA', Self().match(IsA()), 'Must be a'),
        fieldWithRule('fieldB', Self().match(IsB()), 'Must be b'),
      ])

      // Act
      const bothValid = await client.post('/entries/step-one', { session: {}, body: { fieldA: 'a', fieldB: 'b' } })
      const firstInvalid = await client.post('/entries/step-one', { session: {}, body: { fieldA: 'b', fieldB: 'b' } })

      // Assert
      if (bothValid.type === 'render') {
        expect(bothValid.getValidationErrorsByFieldCode('fieldA')).toHaveLength(0)
        expect(bothValid.getValidationErrorsByFieldCode('fieldB')).toHaveLength(0)
      }

      if (firstInvalid.type === 'render') {
        expect(firstInvalid.getValidationErrorsByFieldCode('fieldA')).toHaveLength(1)
        expect(firstInvalid.getValidationErrorsByFieldCode('fieldB')).toHaveLength(0)
      }
    })

    it('should pass package dependencies to the entry factory', async () => {
      // Arrange
      const MeetsMinimum = condition<{ min: number }>('Test.MeetsMinimum', {
        factory: deps => (value: unknown) => String(value ?? '').length >= deps.min,
      })
      const client = new ForgeTestHarness()
        .registerPackage(
          createForgePackage<{ min: number }>({
            journey: journeyWithFields([fieldWithRule('crn', Self().match(MeetsMinimum()), 'Too short')]),
            components: [testInput],
          }),
          { min: 4 },
        )
        .createClient()

      // Act
      const invalid = await client.post('/entries/step-one', { session: {}, body: { crn: 'abc' } })
      const valid = await client.post('/entries/step-one', { session: {}, body: { crn: 'abcd' } })

      // Assert
      if (invalid.type === 'render') {
        expect(invalid.getValidationErrorsByFieldCode('crn')).toHaveLength(1)
      }

      if (valid.type === 'render') {
        expect(valid.getValidationErrorsByFieldCode('crn')).toHaveLength(0)
      }
    })

    it('should await an async embedded entry end-to-end', async () => {
      // Arrange
      const IsOkAsync = condition('Test.IsOkAsync', { factory: () => async (value: unknown) => value === 'ok' })
      const client = createEntriesClient([fieldWithRule('status', Self().match(IsOkAsync()), 'Not ok')])

      // Act
      const invalid = await client.post('/entries/step-one', { session: {}, body: { status: 'nope' } })
      const valid = await client.post('/entries/step-one', { session: {}, body: { status: 'ok' } })

      // Assert
      if (invalid.type === 'render') {
        expect(invalid.getValidationErrorsByFieldCode('status')).toHaveLength(1)
      }

      if (valid.type === 'render') {
        expect(valid.getValidationErrorsByFieldCode('status')).toHaveLength(0)
      }
    })
  })

  describe('listed entries', () => {
    const nameOnlyReference = (name: string): ConditionFunctionExpr =>
      ({ type: FunctionType.CONDITION, name, arguments: [] }) as ConditionFunctionExpr

    it('should resolve a name-only reference through a listed entry', async () => {
      // Arrange
      const IsYes = condition('Test.IsYes', { factory: () => (value: unknown) => value === 'yes' })
      const client = new ForgeTestHarness()
        .registerPackage(
          createForgePackage({
            journey: journeyWithFields([
              fieldWithRule('agree', Self().match(nameOnlyReference('Test.IsYes')), 'Say yes'),
            ]),
            components: [testInput],
            functions: [IsYes],
          }),
        )
        .createClient()

      // Act
      const invalid = await client.post('/entries/step-one', { session: {}, body: { agree: 'no' } })
      const valid = await client.post('/entries/step-one', { session: {}, body: { agree: 'yes' } })

      // Assert
      if (invalid.type === 'render') {
        expect(invalid.getValidationErrorsByFieldCode('agree')).toHaveLength(1)
      }

      if (valid.type === 'render') {
        expect(valid.getValidationErrorsByFieldCode('agree')).toHaveLength(0)
      }
    })

    it('should reject an unlisted name-only reference during semantic analysis', () => {
      // Arrange
      const harness = new ForgeTestHarness()
      const pkg = createForgePackage({
        journey: journeyWithFields([fieldWithRule('agree', Self().match(nameOnlyReference('Test.Unlisted')), 'No')]),
        components: [testInput],
      })

      // Act
      const act = () => harness.registerPackage(pkg)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow(/Test\.Unlisted.*is not registered/)
    })

    it('should reject listing an anonymous entry when the package is created', () => {
      // Arrange
      const anonymous = condition({ factory: () => () => true })

      // Act
      const act = () =>
        createForgePackage({
          journey: journeyWithFields([]),
          components: [testInput],
          functions: [anonymous],
        })

      // Assert
      expect(act).toThrow('cannot be listed in "functions"')
    })

    it('should reject two listed entries sharing a name when the package is created', () => {
      // Arrange
      const first = condition('Test.Clash', { factory: () => () => true })
      const second = condition('Test.Clash', { factory: () => () => false })

      // Act
      const act = () =>
        createForgePackage({
          journey: journeyWithFields([]),
          components: [testInput],
          functions: [first, second],
        })

      // Assert
      expect(act).toThrow('listed under the name "Test.Clash"')
    })
  })

  describe('transformer, generator, and effect entries', () => {
    it('should transform a value through an embedded transformer entry', async () => {
      // Arrange
      const Doubled = transformer('Test.Doubled', { factory: () => (value: unknown) => String(value ?? '').repeat(2) })
      const IsAtLeast = condition('Test.MinAfterDouble', {
        factory: () => (value: unknown, min: number) => String(value ?? '').length >= min,
      })
      const client = createEntriesClient([
        fieldWithRule('crn', Self().pipe(Doubled()).match(IsAtLeast(4)), 'Too short'),
      ])

      // Act
      const invalid = await client.post('/entries/step-one', { session: {}, body: { crn: 'a' } })
      const valid = await client.post('/entries/step-one', { session: {}, body: { crn: 'ab' } })

      // Assert
      if (invalid.type === 'render') {
        expect(invalid.getValidationErrorsByFieldCode('crn')).toHaveLength(1)
      }

      if (valid.type === 'render') {
        expect(valid.getValidationErrorsByFieldCode('crn')).toHaveLength(0)
      }
    })

    it('should generate a value through an embedded generator entry', async () => {
      // Arrange
      const Fixed = generator('Test.Fixed', { factory: () => (text: string) => text })
      const Equals = condition('Test.EqualsExpected', {
        factory: () => (value: unknown, expected: unknown) => value === expected,
      })
      const client = createEntriesClient([
        fieldWithRule('passes', Fixed('yes').match(Equals('yes')), 'Never shown'),
        fieldWithRule('fails', Fixed('no').match(Equals('yes')), 'Always shown'),
      ])

      // Act
      const result = await client.post('/entries/step-one', { session: {}, body: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.getValidationErrorsByFieldCode('passes')).toHaveLength(0)
        expect(result.getValidationErrorsByFieldCode('fails')).toHaveLength(1)
      }
    })

    it('should run an embedded effect entry with the hook context', async () => {
      // Arrange
      const ran = vi.fn()
      const RecordVisit = effect('Test.RecordVisit', {
        factory: () => (context: EffectContext, label: string) => ran(context, label),
      })
      const client = createEntriesClient([], [access({ effects: [RecordVisit('step-one')] })])

      // Act
      await client.get('/entries/step-one', { session: {} })

      // Assert
      expect(ran).toHaveBeenCalledTimes(1)
      expect(ran.mock.calls[0][1]).toBe('step-one')
      expect(typeof ran.mock.calls[0][0].setAnswer).toBe('function')
    })

    it('should register a journey mixing all four entry kinds', async () => {
      // Arrange
      const ran = vi.fn()
      const Trimmed = transformer('Mixed.Trimmed', { factory: () => (value: unknown) => String(value ?? '').trim() })
      const IsYes = condition('Mixed.IsYes', { factory: () => (value: unknown) => value === 'yes' })
      const Always = generator('Mixed.Always', { factory: () => (text: string) => text })
      const Track = effect('Mixed.Track', { factory: () => () => ran() })
      const client = createEntriesClient(
        [
          fieldWithRule('agree', Self().pipe(Trimmed()).match(IsYes()), 'Say yes'),
          fieldWithRule('static', Always('yes').match(IsYes()), 'Never shown'),
        ],
        [access({ effects: [Track()] })],
      )

      // Act
      const result = await client.post('/entries/step-one', { session: {}, body: { agree: ' yes ' } })

      // Assert
      expect(ran).toHaveBeenCalled()
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.getValidationErrorsByFieldCode('agree')).toHaveLength(0)
        expect(result.getValidationErrorsByFieldCode('static')).toHaveLength(0)
      }
    })
  })

  describe('factory failures', () => {
    it('should surface the function name, path, and callsite when an embedded factory throws', () => {
      // Arrange
      const Broken = condition('Test.Broken', {
        factory: (): (() => boolean) => {
          throw new Error('missing api client')
        },
      })
      const pkg = createForgePackage({
        journey: journeyWithFields([fieldWithRule('crn', Self().match(Broken()), 'Nope')]),
        components: [testInput],
      })

      // Act
      const act = () => new ForgeTestHarness().registerPackage(pkg)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)

      try {
        act()
      } catch (error) {
        expect(error).toBeInstanceOf(ForgeRegistrationError)

        if (error instanceof ForgeRegistrationError) {
          expect(error.message).toContain('Test.Broken')
          expect(error.message).toContain('factory threw during registration')
          expect(error.message).toContain('Path: ')
          expect(error.message).toContain('Defined at: ')
          expect(error.message).toContain('functionEntryRegistration.test.ts')
          expect(error.message).toContain('missing api client')
        }
      }
    })
  })
})
