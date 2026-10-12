import { describe, expect, it } from 'vitest'

import type { RequestTraceEvent } from '../../../../src/testing'
import { answerOf, answersFromTrace, createTracedClient, type ContractSession } from '../../contractHelpers'
import { crossStepDependentWhenJourney } from './answerReconciliation.fixtures'

describe('answer reconciliation contracts', () => {
  it('should clear another step\u2019s answer when this step\u2019s POST turns its dependentWhen off', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const client = createTracedClient(crossStepDependentWhenJourney, traces)
    const session: ContractSession = {
      answers: { reconcile: { contactMethod: 'email', emailAddress: 'ada@example.com' } },
    }

    // Act
    await client.post('/reconcile/choose', { body: { contactMethod: 'post' }, session })

    // Assert
    const emailHistory = answerOf(answersFromTrace(traces[0]), 'emailAddress')

    expect(emailHistory.current).toBeUndefined()
    expect(emailHistory.mutations).toContainEqual({ value: undefined, source: 'dependentWhen' })
  })

  it('should keep another step\u2019s answer when the POST body carries no value for it', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const client = createTracedClient(crossStepDependentWhenJourney, traces)
    const session: ContractSession = {
      answers: { reconcile: { contactMethod: 'email', emailAddress: 'ada@example.com' } },
    }

    // Act
    await client.post('/reconcile/choose', { body: { contactMethod: 'email' }, session })

    // Assert
    const emailHistory = answerOf(answersFromTrace(traces[0]), 'emailAddress')

    expect(emailHistory.current).toBe('ada@example.com')
    expect(emailHistory.mutations.every(mutation => mutation.source !== 'post')).toBe(true)
    expect(session.answers?.reconcile?.emailAddress).toBe('ada@example.com')
  })

  it('should record no mutation for a dependent field that was never answered', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const client = createTracedClient(crossStepDependentWhenJourney, traces)
    const session: ContractSession = { answers: { reconcile: {} } }

    // Act
    await client.post('/reconcile/choose', { body: { contactMethod: 'post' }, session })

    // Assert
    const answers = answersFromTrace(traces[0])

    expect(answers.emailAddress).toBeUndefined()
  })
})
