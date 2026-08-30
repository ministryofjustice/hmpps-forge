import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { access, Answer, Data, field, Format, Item, Iterator, Self, validation } from '../../../../src/authoring'
import ForgeRegistrationError from '../../../../src/engine/errors/ForgeRegistrationError'
import { ContractConditions, ContractEffects } from '../../contractHelpers'
import { journeyWithFields, registerJourney, type TestInputBlock } from './semanticAnalysis.fixtures'

const IsYes = ContractConditions.register('Semantic.IsYes', {
  factory: () => (value: unknown) => value === 'yes',
})

describe('semantic analysis contracts', () => {
  describe('reference scopes', () => {
    it('should reject Item() when used outside an iterator', () => {
      // Arrange
      const journeyDefinition = journeyWithFields([
        field({ variant: 'test-input', code: 'task', defaultValue: Item().path('id') }),
      ])

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('AST semantic validation failed')
      expect(act).toThrow('Item() can only be used inside an iterator')
      expect(act).toThrow('blocks[0] (test-input - task) > defaultValue')
    })

    it('should reject Self() when used outside a field block', () => {
      // Arrange
      const journeyDefinition = journeyWithFields([], {
        validWhen: [validation({ condition: Self().match(IsYes()), message: 'Say yes' })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Self() reference used outside of a field block')
      expect(act).toThrow('validWhen[0] > condition > subject')
    })

    it("should reject Self() when used inside the field's own code expression", () => {
      // Arrange
      const journeyDefinition = journeyWithFields([field({ variant: 'test-input', code: Format('f-%1', Self()) })])

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('AST semantic validation failed')
      expect(act).toThrow("Self() cannot be used within the field's code expression")
    })

    // An iterator in a field's defaultValue is rejected by schema validation
    // outright, so the only authored route to an over-deep parent reference
    // is an expression placed in a hook effect argument.
    it('should reject a parent item reference when it exceeds the available iterator depth', () => {
      // Arrange
      const Emit = ContractEffects.register('Semantic.Emit', {
        factory: () => (_context, _value: unknown) => undefined,
      })
      const journeyDefinition = journeyWithFields([], {
        onAccess: [
          access({
            effects: [Emit(Data('items').each(Iterator.Map(Format('%1', Item().parent.path('name')))))],
          }),
        ],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('AST semantic validation failed')
      expect(act).toThrow('Item().parent references level 1, but only 1 iterator scope is available')
    })

    it('should reject Answer() when read inside an access hook', () => {
      // Arrange
      const journeyDefinition = journeyWithFields([], {
        onAccess: [access({ when: Answer('approved').match(IsYes()) })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Answer() cannot be used in an onAccess hook: answer preparation runs after access hooks')
      expect(act).toThrow('onAccess[0] > when > subject')
    })
  })

  describe('placement rules', () => {
    it('should reject an effect when placed outside a hook', () => {
      // Arrange
      const Track = ContractEffects.register('Semantic.Track', { factory: () => () => undefined })
      const journeyDefinition = journeyWithFields([
        field({ variant: 'test-input', code: 'visits', defaultValue: Track() }),
      ])

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Effect "Semantic.Track" can only be used inside a hook (onAccess or onSubmission)')
      expect(act).toThrow('blocks[0] (test-input - visits) > defaultValue')
    })

    it('should reject a validation rule when placed outside validWhen', () => {
      // Arrange
      const journeyDefinition = journeyWithFields([
        field<TestInputBlock>({
          variant: 'test-input',
          code: 'crn',
          hint: validation({ condition: Self().match(IsYes()), message: 'Misplaced' }),
        }),
      ])

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Validation rules can only be used inside validWhen on a field block or step')
      expect(act).toThrow('blocks[0] (test-input - crn) > hint')
    })

    it('should reject shared field codes when a duplicate lacks dependentWhen', () => {
      // Arrange
      const journeyDefinition = journeyWithFields([
        field({ variant: 'test-input', code: 'contact' }),
        field({ variant: 'test-input', code: 'contact' }),
      ])

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow("Field code 'contact' is shared by multiple blocks on the same step")
      expect(act).toThrow('every one of them must declare dependentWhen')
      expect(act).toThrow('blocks[0] (test-input - contact)')
      expect(act).toThrow('blocks[1] (test-input - contact)')
    })
  })

  // Only the block-as-function-argument rule is reachable end to end here —
  // the semantic container rules for onAccess/onSubmission/blocks/effects/next
  // never fire for authored input because schema validation rejects those
  // shapes first (pinned in dslValidation.test.ts, placement schema validation).
  describe('container types', () => {
    it('should reject a block definition when passed as a function argument', () => {
      // Arrange
      const journeyDefinition = journeyWithFields([
        field({
          variant: 'test-input',
          code: 'label',
          defaultValue: Format('%1', field({ variant: 'test-input', code: 'inner' }) as unknown as string),
        }),
      ])

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('AST semantic validation failed')
      expect(act).toThrow('Block definitions cannot be used as function arguments')
    })
  })

  describe('function arity', () => {
    it('should reject a function call when its arguments violate the registered tuple schema', () => {
      // Arrange
      const HasMinLength = ContractConditions.register('Semantic.HasMinLength', {
        factory: () => (value: unknown, min?: number) => String(value ?? '').length >= (min ?? 0),
        argumentsSchema: z.tuple([z.number()]),
      })
      const journeyDefinition = journeyWithFields([
        field({
          variant: 'test-input',
          code: 'crn',
          validWhen: [validation({ condition: Self().match(HasMinLength()), message: 'Too short' })],
        }),
      ])

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Function "Semantic.HasMinLength" expects 1 argument but received 0')
      expect(act).toThrow('Type: FunctionType.Condition')
    })
  })
})
