import { Data, field } from '../index'
import { finaliseBuilders } from './finaliseBuilders'
import { BlockType, ExpressionType, StructureType } from '../../types/enums'
import { FormatGenerators } from '../../../built-ins/functions/generators/formatGenerators'
import { Condition } from '../../../built-ins/functions/conditions'
import { condition } from '../../functions/condition'
import { getEntryStamp } from './stampEntry'
import type { Callsite } from './captureCallsite'
import type { DSLSourceLocation } from '../../../shared/diagnostics/sourceLocation.type'

const sourceOf = (value: unknown): DSLSourceLocation =>
  Object.getOwnPropertyDescriptor(value, '__source')?.value as DSLSourceLocation

const callsiteOf = (value: unknown): Callsite | undefined =>
  Object.getOwnPropertyDescriptor(value, '__callsite')?.value as Callsite | undefined

const journeyInput = () => ({
  type: StructureType.JOURNEY,
  code: 'travel-declaration',
  path: '/travel-declaration',
  title: 'Travel declaration',
  steps: [
    {
      type: StructureType.STEP,
      path: '/personal-details',
      title: 'Personal details',
      blocks: [
        {
          type: StructureType.BLOCK,
          blockType: BlockType.FIELD,
          variant: 'GovUKInput',
          code: 'firstName',
          value: Data('firstName'),
        },
      ],
    },
  ],
})

describe('finaliseBuilders', () => {
  it('should stamp object nodes with their path and formatted path', () => {
    // Arrange
    const journey = journeyInput()

    // Act
    const result = finaliseBuilders(journey) as Record<string, any>

    // Assert
    expect(sourceOf(result).path).toEqual([])
    expect(sourceOf(result.steps[0]).path).toEqual(['steps', 0])
    expect(sourceOf(result.steps[0]).formattedPath).toBe('travel-declaration > personal-details')
    expect(sourceOf(result.steps[0].blocks[0]).path).toEqual(['steps', 0, 'blocks', 0])
    expect(sourceOf(result.steps[0].blocks[0]).formattedPath).toBe(
      'travel-declaration > personal-details > blocks[0] (GovUKInput - firstName)',
    )
  })

  it('should stamp built builder output at the position it occupies', () => {
    // Arrange
    const journey = journeyInput()

    // Act
    const result = finaliseBuilders(journey) as Record<string, any>

    // Assert
    expect(sourceOf(result.steps[0].blocks[0].value).path).toEqual(['steps', 0, 'blocks', 0, 'value'])
  })

  it('should overwrite stamps when a finalised tree is re-walked from a larger root', () => {
    // Arrange
    const step = (finaliseBuilders(journeyInput()) as Record<string, any>).steps[0]
    expect(sourceOf(step).path).toEqual(['steps', 0])
    const journey = { ...journeyInput(), steps: [journeyInput().steps[0], step] }

    // Act
    const result = finaliseBuilders(journey) as Record<string, any>

    // Assert
    expect(sourceOf(result.steps[1]).path).toEqual(['steps', 1])
    expect(sourceOf(result.steps[1].blocks[0]).path).toEqual(['steps', 1, 'blocks', 0])
  })

  it('should keep stamps invisible to JSON serialisation', () => {
    // Arrange
    const journey = journeyInput()

    // Act
    const result = finaliseBuilders(journey)

    // Assert
    expect(JSON.stringify(result)).not.toContain('__source')
    expect(JSON.stringify(result)).toBe(JSON.stringify(JSON.parse(JSON.stringify(result))))
  })

  it('should give a shared builder instance a distinct copy and stamp per position', () => {
    // Arrange
    const shared = Data('status')
    const input = { first: shared, second: shared }

    // Act
    const result = finaliseBuilders(input) as Record<string, any>

    // Assert
    expect(result.first).not.toBe(result.second)
    expect(result.first).toEqual(result.second)
    expect(sourceOf(result.first).path).toEqual(['first'])
    expect(sourceOf(result.second).path).toEqual(['second'])
  })

  it('should throw a descriptive error for a cyclic input', () => {
    // Arrange
    const parent: Record<string, unknown> = { code: 'parent' }
    parent.child = { code: 'child', owner: parent }

    // Act
    const act = () => finaliseBuilders(parent)

    // Assert
    expect(act).toThrow(/Circular reference detected in form configuration at "child\.owner"/)
  })

  it('should convert builders to their wire format', () => {
    // Arrange
    const input = { value: Data('firstName') }

    // Act
    const result = finaliseBuilders(input) as Record<string, any>

    // Assert
    expect(result.value).toEqual({ type: ExpressionType.REFERENCE, path: ['data', 'firstName'] })
  })

  it('should pass through an object with a build function but no builder marker untouched', () => {
    // Arrange
    const build = () => 'built'
    const input = { value: { build, label: 'not a builder' } }

    // Act
    const result = finaliseBuilders(input) as Record<string, any>

    // Assert
    expect(result.value.build).toBe(build)
    expect(result.value.label).toBe('not a builder')
  })

  describe('callsite stamps', () => {
    it('should give field() output a callsite that names the calling file', () => {
      // Act
      const block = field({ variant: 'GovUKInput', code: 'firstName' })

      // Assert
      expect(callsiteOf(block)?.stack).toContain('finaliseBuilders.test.ts')
      expect(callsiteOf(block)?.stack).not.toContain('structures.ts')
    })

    it('should carry a callsite stamp through an enclosing walk copy', () => {
      // Arrange
      const block = field({ variant: 'GovUKInput', code: 'firstName' })

      // Act
      const result = finaliseBuilders({ blocks: [block] }) as Record<string, any>

      // Assert
      expect(result.blocks[0]).not.toBe(block)
      expect(callsiteOf(result.blocks[0])?.stack).toContain('finaliseBuilders.test.ts')
    })

    it('should stamp a generator handle output and carry it through build()', () => {
      // Arrange
      const generator = FormatGenerators.FormatString('Hello %1', Data('firstName'))
      expect(callsiteOf(generator)?.stack).toContain('finaliseBuilders.test.ts')

      // Act
      const result = finaliseBuilders({ value: generator }) as Record<string, any>

      // Assert
      expect(callsiteOf(result.value)?.stack).toContain('finaliseBuilders.test.ts')
    })

    it('should stamp a condition handle output and carry it through the walk', () => {
      // Arrange
      const equals = Condition.Equals('x')
      expect(callsiteOf(equals)?.stack).toContain('finaliseBuilders.test.ts')

      // Act
      const result = finaliseBuilders({ when: equals }) as Record<string, any>

      // Assert
      expect(callsiteOf(result.when)?.stack).toContain('finaliseBuilders.test.ts')
    })

    it('should carry an entry stamp through the walk by reference identity', () => {
      // Arrange
      const IsLongEnough = condition({ factory: () => value => typeof value === 'string' })
      const expr = IsLongEnough()
      const input = { steps: [{ blocks: [{ visibleWhen: expr }] }] }

      // Act
      const result = finaliseBuilders(input) as Record<string, any>

      // Assert
      const copied = result.steps[0].blocks[0].visibleWhen
      expect(copied).not.toBe(expr)
      expect(getEntryStamp(copied)).toBe(IsLongEnough)
      expect(Object.getOwnPropertyDescriptor(copied, '__entry')?.enumerable).toBe(false)
    })

    it('should keep callsite stamps invisible to JSON serialisation', () => {
      // Arrange
      const block = field({ variant: 'GovUKInput', code: 'firstName', visibleWhen: Data('show') })

      // Act
      const result = finaliseBuilders({ blocks: [block], value: FormatGenerators.FormatString('Hi %1', 'x') })

      // Assert
      expect(JSON.stringify(result)).not.toContain('__callsite')
      expect(JSON.stringify(block)).not.toContain('__callsite')
    })
  })
})
