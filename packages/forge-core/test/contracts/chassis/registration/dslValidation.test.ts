import { describe, expect, it } from 'vitest'
import {
  access,
  BlockType,
  Condition,
  Data,
  ExpressionType,
  field,
  journey,
  redirect,
  Self,
  step,
  StructureType,
  submit,
  tieBreaker,
} from '../../../../src/authoring'
import ForgeRegistrationError from '../../../../src/engine/errors/ForgeRegistrationError'
import { ContractConditions } from '../../contractHelpers'
import { registerJourney, registerRawJourney } from './dslValidation.fixtures'

/** A one-step journey with arbitrary (possibly illegal) step properties spliced in. */
function journeyWithStep(stepOverrides: object) {
  const stepDefinition = step({
    code: 'first',
    path: '/first',
    title: 'First',
    blocks: [],
    ...stepOverrides,
  } as Parameters<typeof step>[0])

  return journey({ code: 'placement', path: '/placement', title: 'Placement', steps: [stepDefinition] })
}

describe('DSL validation contracts', () => {
  describe('schema validation', () => {
    it('should reject a journey when its code is missing', () => {
      // Arrange
      const rawJourney = { type: StructureType.JOURNEY, path: '/broken', title: 'Broken', steps: [] }

      // Act
      const act = () => registerRawJourney(rawJourney)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Schema validation failed')
      expect(act).toThrow('Invalid input: expected string, received undefined')
      expect(act).toThrow('Path: broken > code')
    })

    it('should report every schema issue when one registration has several', () => {
      // Arrange
      const rawJourney = {
        type: StructureType.JOURNEY,
        path: '/broken',
        title: 'Broken',
        steps: [{ type: StructureType.STEP, path: '/one', blocks: [] }],
      }

      // Act
      const act = () => registerRawJourney(rawJourney)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('1. ForgeSchemaError:')
      expect(act).toThrow('2. ForgeSchemaError:')
      expect(act).toThrow('Path: broken > code')
      expect(act).toThrow('Path: broken > one > title')
    })

    it('should reject condition-backed validation when its message is missing', () => {
      // Arrange
      const IsYes = ContractConditions.register('Dsl.IsYes', {
        factory: () => (value: unknown) => value === 'yes',
      })
      const rawJourney = {
        type: StructureType.JOURNEY,
        code: 'broken',
        path: '/broken',
        title: 'Broken',
        steps: [
          {
            type: StructureType.STEP,
            path: '/one',
            title: 'One',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'test-input',
                code: 'crn',
                validWhen: [{ type: ExpressionType.VALIDATION, condition: Self().match(IsYes()) }],
              },
            ],
          },
        ],
      }

      // Act
      const act = () => registerRawJourney(rawJourney)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Invalid input')
      expect(act).toThrow('validWhen[0] > message')
    })

    it('should reject static data when it contains a forge expression', () => {
      // Arrange
      const rawJourney = {
        type: StructureType.JOURNEY,
        code: 'broken',
        path: '/broken',
        title: 'Broken',
        data: { user: { type: ExpressionType.REFERENCE, path: ['answers', 'crn'] } },
        steps: [],
      }

      // Act
      const act = () => registerRawJourney(rawJourney)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Forge expressions are not supported in static data')
      expect(act).toThrow('Path: broken > data > user')
    })
  })

  describe('serialisation validation', () => {
    it('should reject a definition when a property is explicitly undefined', () => {
      // Arrange
      const journeyDefinition = journey({
        code: 'undefined-values',
        path: '/undefined-values',
        title: 'Undefined Values',
        steps: [step({ code: 'first', path: '/first', title: 'First', description: undefined, blocks: [] })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('JSON validation failed due to non-serializable types')
      expect(act).toThrow('Undefined value at undefined-values > first > description (not JSON serializable)')
      expect(act).toThrow('Defined at: ')
    })

    it('should reject a definition when a value is a function', () => {
      // Arrange
      const generateNow = (() => 'now') as unknown as string
      const journeyDefinition = journey({
        code: 'function-values',
        path: '/function-values',
        title: 'Function Values',
        data: { generate: generateNow },
        steps: [step({ code: 'first', path: '/first', title: 'First', blocks: [] })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('JSON validation failed due to non-serializable types')
      expect(act).toThrow('Function at function-values > data > generate (not JSON serializable)')
    })

    it('should reject a definition when a value is a bigint', () => {
      // Arrange
      const big = BigInt(9) as unknown as string
      const journeyDefinition = journey({
        code: 'bigint-values',
        path: '/bigint-values',
        title: 'Bigint Values',
        data: { big },
        steps: [step({ code: 'first', path: '/first', title: 'First', blocks: [] })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('JSON validation failed due to non-serializable types')
      expect(act).toThrow('BigInt at bigint-values > data > big (not JSON serializable)')
    })

    it('should reject a definition when a value is a symbol', () => {
      // Arrange
      const sym = Symbol('marker') as unknown as string
      const journeyDefinition = journey({
        code: 'symbol-values',
        path: '/symbol-values',
        title: 'Symbol Values',
        data: { sym },
        steps: [step({ code: 'first', path: '/first', title: 'First', blocks: [] })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('JSON validation failed due to non-serializable types')
      expect(act).toThrow('Symbol at symbol-values > data > sym (not JSON serializable)')
    })

    it('should reject a definition when a value is a Date instance', () => {
      // Arrange
      const now = new Date('2026-01-01') as unknown as string
      const journeyDefinition = journey({
        code: 'date-values',
        path: '/date-values',
        title: 'Date Values',
        data: { now },
        steps: [step({ code: 'first', path: '/first', title: 'First', blocks: [] })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('JSON validation failed due to non-serializable types')
      expect(act).toThrow('Date object at date-values > data > now (not JSON serializable)')
    })

    it('should reject a definition when a value is a class instance', () => {
      // Arrange
      const lookup = new Map([['a', 1]]) as unknown as string
      const journeyDefinition = journey({
        code: 'instance-values',
        path: '/instance-values',
        title: 'Instance Values',
        data: { lookup },
        steps: [step({ code: 'first', path: '/first', title: 'First', blocks: [] })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('JSON validation failed due to non-serializable types')
      expect(act).toThrow('Non-plain object (Map) at instance-values > data > lookup (not JSON serializable)')
    })
  })

  // These placements also have semantic-analysis rules (validateContainerTypes
  // and the *Scope placement rules), but the Zod schema rejects every authored
  // shape we could construct before semantic analysis runs, so the schema
  // rejection is the author-visible contract pinned here. The semantic rules
  // remain as defense in depth behind it.
  describe('placement schema validation', () => {
    it('should reject a submit hook at schema validation when placed in an onAccess array', () => {
      // Arrange
      const journeyDefinition = journeyWithStep({ onAccess: [submit({ validate: false })] })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Schema validation failed')
      expect(act).toThrow('expected "HookType.Access"')
      expect(act).toThrow('Path: placement > first > onAccess[0] > type')
    })

    it('should reject a non-block value at schema validation when placed in a blocks array', () => {
      // Arrange
      const journeyDefinition = journeyWithStep({ blocks: [redirect({ goto: 'first' })] })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Schema validation failed')
      expect(act).toThrow('Path: placement > first > blocks[0]')
    })

    it('should reject a non-outcome value at schema validation when placed in a next array', () => {
      // Arrange
      const misplacedField = field({ variant: 'test-input', code: 'misplaced' })
      const journeyDefinition = journeyWithStep({
        onAccess: [access({ next: [misplacedField] as never })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Schema validation failed')
      expect(act).toThrow('Path: placement > first > onAccess[0] > next[0]')
    })

    it('should reject an outcome at schema validation when placed outside a hook', () => {
      // Arrange
      const journeyDefinition = journeyWithStep({
        blocks: [field({ variant: 'test-input', code: 'z', defaultValue: redirect({ goto: 'first' }) as never })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Schema validation failed')
      expect(act).toThrow('Path: placement > first > blocks[0] (test-input - z) > defaultValue')
    })

    it('should reject a tie-breaker at schema validation when placed outside step reachability', () => {
      // Arrange
      const misplacedTieBreaker = tieBreaker({ priority: 1, when: Data('flag').match(Condition.Equals(true)) })
      const journeyDefinition = journeyWithStep({
        blocks: [field({ variant: 'test-input', code: 'z', defaultValue: misplacedTieBreaker as never })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Schema validation failed')
      expect(act).toThrow('Path: placement > first > blocks[0] (test-input - z) > defaultValue')
    })

    it('should reject a hook at schema validation when placed outside an onAccess or onSubmission array', () => {
      // Arrange
      const journeyDefinition = journeyWithStep({
        blocks: [field({ variant: 'test-input', code: 'z', defaultValue: access({}) as never })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Schema validation failed')
      expect(act).toThrow('Path: placement > first > blocks[0] (test-input - z) > defaultValue')
    })

    it('should reject a block at schema validation when placed outside a step blocks array', () => {
      // Arrange
      const misplacedBlock = field({ variant: 'test-input', code: 'inner' })
      const journeyDefinition = journeyWithStep({
        blocks: [field({ variant: 'test-input', code: 'z', defaultValue: misplacedBlock as never })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Schema validation failed')
      expect(act).toThrow('Path: placement > first > blocks[0] (test-input - z) > defaultValue')
    })

    it('should reject a step at schema validation when defined outside a journey steps array', () => {
      // Arrange
      const misplacedStep = step({ code: 'rogue', title: 'Rogue', path: '/rogue', blocks: [] })
      const journeyDefinition = journeyWithStep({
        blocks: [field({ variant: 'test-input', code: 'z', defaultValue: misplacedStep as never })],
      })

      // Act
      const act = () => registerJourney(journeyDefinition)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Schema validation failed')
      expect(act).toThrow('Path: placement > first > blocks[0] (test-input - z) > defaultValue')
    })
  })
})
