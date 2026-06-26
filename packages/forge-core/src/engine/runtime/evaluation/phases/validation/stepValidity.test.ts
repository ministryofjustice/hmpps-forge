import { describe, expect, it } from 'vitest'
import type { NodeId } from '../../../../contracts/ast/ast.type'
import type { StepValidityResult } from '../../../../contracts/runtime/stepValidityResult.type'
import { isStepValid, stepValidity } from './stepValidity'

function fieldFailure(message: string, groups: string[], submissionOnly = false) {
  return { blockId: 'b' as NodeId, blockCode: 'c', passed: false, message, submissionOnly, groups }
}

function stored(...fieldFailures: ReturnType<typeof fieldFailure>[]): StepValidityResult {
  return { fieldFailures, domainFailures: [] }
}

describe('stepValidity()', () => {
  it('should report valid with no failures when nothing is stored', () => {
    // Arrange
    // (no stored entry)

    // Act
    const view = stepValidity(undefined, { isSubmission: false })

    // Assert
    expect(view).toEqual({ isValid: true, fieldFailures: [], domainFailures: [] })
  })

  it('should exclude submissionOnly failures in non-submission mode', () => {
    // Arrange
    const result = stored(fieldFailure('Required on submit', ['default'], true))

    // Act
    const view = stepValidity(result, { isSubmission: false })

    // Assert
    expect(view.isValid).toBe(true)
    expect(view.fieldFailures).toHaveLength(0)
  })

  it('should include submissionOnly failures in submission mode', () => {
    // Arrange
    const result = stored(fieldFailure('Required on submit', ['default'], true))

    // Act
    const view = stepValidity(result, { isSubmission: true })

    // Assert
    expect(view.isValid).toBe(false)
    expect(view.fieldFailures).toHaveLength(1)
  })

  it('should exclude failures whose groups are not active', () => {
    // Arrange
    const result = stored(fieldFailure('Enter a filter', ['filter']))

    // Act
    const view = stepValidity(result, { isSubmission: true, groups: ['search'] })

    // Assert
    expect(view.isValid).toBe(true)
  })

  it('should include failures whose groups intersect the active groups', () => {
    // Arrange
    const result = stored(fieldFailure('Enter a search term', ['search', 'continue']))

    // Act
    const view = stepValidity(result, { isSubmission: true, groups: ['search'] })

    // Assert
    expect(view.isValid).toBe(false)
    expect(view.fieldFailures[0].message).toBe('Enter a search term')
  })

  it('should treat empty failure groups as the default group', () => {
    // Arrange
    const result = stored(fieldFailure('Required', []))

    // Act
    const view = stepValidity(result, { isSubmission: false, groups: ['default'] })

    // Assert
    expect(view.isValid).toBe(false)
  })

  it('should default the active groups to the default group when none are given', () => {
    // Arrange
    const result = stored(fieldFailure('Required', ['default']))

    // Act
    const view = stepValidity(result, { isSubmission: false })

    // Assert
    expect(view.isValid).toBe(false)
  })
})

describe('isStepValid()', () => {
  it('should return false when a matching failure remains', () => {
    // Arrange
    const result = stored(fieldFailure('Required', ['default']))

    // Act
    const valid = isStepValid(result, { isSubmission: false })

    // Assert
    expect(valid).toBe(false)
  })

  it('should return true when every failure is filtered out', () => {
    // Arrange
    const result = stored(fieldFailure('Required on submit', ['default'], true))

    // Act
    const valid = isStepValid(result, { isSubmission: false })

    // Assert
    expect(valid).toBe(true)
  })
})
