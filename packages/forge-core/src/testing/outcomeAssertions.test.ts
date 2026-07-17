import ForgeTestOutcomeAssertionError from './ForgeTestOutcomeAssertionError'
import { expectErrorOutcome, expectRedirectOutcome, expectRenderOutcome } from './outcomeAssertions'
import type { RenderContext } from '../framework/rendering/types'
import type { TestErrorResult, TestRedirectResult, TestRenderResult } from './types'

function renderResult(title?: string): TestRenderResult {
  return {
    type: 'render',
    context: { step: { title } } as unknown as RenderContext,
    headers: new Map(),
    cookies: new Map(),
    getBlocksByVariant: () => [],
    getValidationErrorsByFieldCode: () => [],
  }
}

function redirectResult(url: string): TestRedirectResult {
  return {
    type: 'redirect',
    url,
    headers: new Map(),
    cookies: new Map(),
  }
}

function errorResult(status: number, message: string): TestErrorResult {
  return {
    type: 'error',
    status,
    message,
    headers: new Map(),
    cookies: new Map(),
  }
}

describe('expectRenderOutcome()', () => {
  it('should return without throwing and narrow to a render result when the outcome matches', () => {
    // Arrange
    const result = renderResult('Check your answers')

    // Act
    expectRenderOutcome(result)

    // Assert
    expect(result.context.step.title).toBe('Check your answers')
  })

  it('should throw ForgeTestOutcomeAssertionError describing the redirect when the outcome is a redirect', () => {
    // Arrange
    const result = redirectResult('/booking/location')

    // Act & Assert
    expect(() => expectRenderOutcome(result)).toThrow(ForgeTestOutcomeAssertionError)
    expect(() => expectRenderOutcome(result)).toThrow(
      "Expected a render outcome but received a redirect to '/booking/location'",
    )
  })

  it('should throw describing the status and message when the outcome is an error', () => {
    // Arrange
    const result = errorResult(404, 'Not found')

    // Act & Assert
    expect(() => expectRenderOutcome(result)).toThrow("Expected a render outcome but received a 404 error: 'Not found'")
  })
})

describe('expectRedirectOutcome()', () => {
  it('should return without throwing and narrow to a redirect result when the outcome matches', () => {
    // Arrange
    const result = redirectResult('/booking/location')

    // Act
    expectRedirectOutcome(result)

    // Assert
    expect(result.url).toBe('/booking/location')
  })

  it('should throw ForgeTestOutcomeAssertionError describing the render step title when the outcome is a render', () => {
    // Arrange
    const result = renderResult('Check your answers')

    // Act & Assert
    expect(() => expectRedirectOutcome(result)).toThrow(ForgeTestOutcomeAssertionError)
    expect(() => expectRedirectOutcome(result)).toThrow(
      "Expected a redirect outcome but received a render of step 'Check your answers'",
    )
  })

  it('should throw describing the status and message when the outcome is an error', () => {
    // Arrange
    const result = errorResult(500, 'Boom')

    // Act & Assert
    expect(() => expectRedirectOutcome(result)).toThrow("Expected a redirect outcome but received a 500 error: 'Boom'")
  })
})

describe('expectErrorOutcome()', () => {
  it('should return without throwing and narrow to an error result when the outcome matches', () => {
    // Arrange
    const result = errorResult(404, 'Not found')

    // Act
    expectErrorOutcome(result)

    // Assert
    expect(result.status).toBe(404)
    expect(result.message).toBe('Not found')
  })

  it('should throw ForgeTestOutcomeAssertionError describing the redirect when the outcome is a redirect', () => {
    // Arrange
    const result = redirectResult('/booking/location')

    // Act & Assert
    expect(() => expectErrorOutcome(result)).toThrow(ForgeTestOutcomeAssertionError)
    expect(() => expectErrorOutcome(result)).toThrow(
      "Expected an error outcome but received a redirect to '/booking/location'",
    )
  })

  it('should describe an untitled step when the render outcome has no title', () => {
    // Arrange
    const result = renderResult()

    // Act & Assert
    expect(() => expectErrorOutcome(result)).toThrow(
      "Expected an error outcome but received a render of step '<untitled>'",
    )
  })
})
