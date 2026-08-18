import ForgeTestOutcomeAssertionError from './ForgeTestOutcomeAssertionError'
import type { TestErrorResult, TestRedirectResult, TestRenderResult, TestResult } from '../test-client/testResult.type'

export function expectRenderOutcome(result: TestResult): asserts result is TestRenderResult {
  if (result.type === 'render') {
    return
  }

  throw new ForgeTestOutcomeAssertionError(`Expected a render outcome but ${describeOutcome(result)}`)
}

export function expectRedirectOutcome(result: TestResult): asserts result is TestRedirectResult {
  if (result.type === 'redirect') {
    return
  }

  throw new ForgeTestOutcomeAssertionError(`Expected a redirect outcome but ${describeOutcome(result)}`)
}

export function expectErrorOutcome(result: TestResult): asserts result is TestErrorResult {
  if (result.type === 'error') {
    return
  }

  throw new ForgeTestOutcomeAssertionError(`Expected an error outcome but ${describeOutcome(result)}`)
}

function describeOutcome(result: TestResult): string {
  switch (result.type) {
    case 'redirect':
      return `received a redirect to '${result.url}'`
    case 'error': {
      const status = result.error.status ?? result.error.statusCode

      return status === undefined
        ? `received an error: '${result.error.message}'`
        : `received a ${status} error: '${result.error.message}'`
    }
    default:
      return `received a render of step '${result.context.step.title ?? '<untitled>'}'`
  }
}
