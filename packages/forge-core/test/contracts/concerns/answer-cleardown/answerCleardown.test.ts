import { describe, it, expect } from 'vitest'

import type { RequestTraceEvent } from '../../../../src/testing'
import { createTracedClient, answerOf, answersFromTrace, type ContractSession } from '../../contractHelpers'
import { runJourneyCases } from '../../contractRunner'
import { cases } from './answerCleardown.cases'
import { cleardownMutationTrailJourney } from './answerCleardown.fixtures'

describe('answer-cleardown contracts', () => {
  runJourneyCases(cases)

  it('should record cleardown mutation in answer history', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const client = createTracedClient(cleardownMutationTrailJourney, traces)
    const session: ContractSession = {
      answers: { 'cleardown-trail': { route: 'detail', detail: 'stale info' } },
    }

    // Act
    await client.post('/cleardown-trail/choose', {
      body: { route: 'skip' },
      session,
    })

    // Assert
    const detailHistory = answerOf(answersFromTrace(traces[0]), 'detail')

    expect(detailHistory.current).toBeUndefined()

    const cleardownMutation = detailHistory.mutations.find(m => m.source === 'cleardown')

    expect(cleardownMutation).toBeDefined()
    expect(cleardownMutation?.value).toBeUndefined()
  })
})
