import { describe, expect, it } from 'vitest'
import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'
import { captureContextSnapshot } from './contextSnapshot'

describe('captureContextSnapshot()', () => {
  it('should deep-clone the context state so later mutations do not affect the snapshot', () => {
    // Arrange
    const context: RuntimeContext = {
      domain: {
        answers: {
          name: {
            current: 'Ada',
            parsed: { normalised: 'ada' },
            mutations: [{ value: 'Ada', source: 'post' }],
          },
        },
        data: { loaded: true },
      },
      evaluation: {
        reachabilityValidities: new Map([
          [
            'compiled:name',
            {
              fieldFailures: [
                {
                  blockId: 'compiled:name-field',
                  passed: false,
                  message: 'Enter your name',
                  submissionOnly: false,
                  groups: ['default'],
                  details: { minLength: 1 },
                  blockCode: 'name',
                },
              ],
              domainFailures: [],
            },
          ],
        ]),
        reachability: {
          reachableSteps: [{ path: '/start', fieldCodes: ['name'] }],
          unreachableSteps: [{ path: '/end', cleardownFieldCodes: ['unused'] }],
        },
      },
      request: {} as any,
    }

    // Act
    const result = captureContextSnapshot(context)
    context.domain.answers.name.current = 'Grace'
    context.domain.answers.name.parsed = { normalised: 'grace' }
    context.domain.data.loaded = false
    context.evaluation.reachabilityValidities!.get('compiled:name')!.fieldFailures[0].details!.minLength = 2
    context.evaluation.reachability!.reachableSteps[0].fieldCodes!.push('other')

    // Assert
    expect(result).toEqual({
      answers: {
        name: {
          current: 'Ada',
          parsed: { normalised: 'ada' },
          mutations: [{ value: 'Ada', source: 'post' }],
        },
      },
      data: { loaded: true },
      reachabilityValidities: {
        'compiled:name': {
          fieldFailures: [
            {
              blockId: 'compiled:name-field',
              passed: false,
              message: 'Enter your name',
              submissionOnly: false,
              groups: ['default'],
              details: { minLength: 1 },
              blockCode: 'name',
            },
          ],
          domainFailures: [],
        },
      },
      reachability: {
        reachableSteps: [{ path: '/start', fieldCodes: ['name'] }],
        unreachableSteps: [{ path: '/end', cleardownFieldCodes: ['unused'] }],
      },
    })
  })
})
