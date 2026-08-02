import { Data } from '../index'
import { finaliseBuilders } from './finaliseBuilders'
import { BlockType, ExpressionType, StructureType } from '../../types/enums'
import type { DSLSourceLocation } from '../../../shared/diagnostics/sourceLocation.type'

const sourceOf = (value: unknown): DSLSourceLocation =>
  Object.getOwnPropertyDescriptor(value, '__source')?.value as DSLSourceLocation

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
})
