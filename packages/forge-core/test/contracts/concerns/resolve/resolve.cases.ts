import type { JourneyContractCase } from '../../contractRunner'
import {
  answerDisplayJourney,
  dataDisplayJourney,
  validationDisplayJourney,
  domainValidationRenderJourney,
} from './resolve.fixtures'

export const cases: JourneyContractCase[] = [
  {
    description: 'answer display',
    journey: answerDisplayJourney,
    tests: [
      {
        name: 'should include stored answers in render context on GET',
        path: '/answer-display/name',
        session: { answers: { 'answer-display': { fullName: 'Ada Lovelace' } } },
        current: { fullName: 'Ada Lovelace' },
      },
    ],
  },
  {
    description: 'data display',
    journey: dataDisplayJourney,
    tests: [
      {
        name: 'should include loaded data in render context on GET',
        path: '/data-display/info',
        session: { data: { userName: 'Ada Lovelace' } },
        data: { userName: 'Ada Lovelace' },
      },
    ],
  },
  {
    description: 'validation display',
    journey: validationDisplayJourney,
    tests: [
      {
        name: 'should attach validation errors to blocks on failed POST',
        path: '/validation-display/form',
        post: { fullName: '', email: '' },
        showFailures: true,
        errors: { fullName: ['Enter your full name'], email: ['Enter your email'] },
      },
      {
        name: 'should not show validation errors on initial GET',
        path: '/validation-display/form',
        showFailures: false,
        errors: {},
      },
    ],
  },
  {
    description: 'domain validation display',
    journey: domainValidationRenderJourney,
    tests: [
      {
        name: 'should include domain validation errors in render context',
        path: '/domain-render/range',
        post: { minValue: '10', maxValue: '10' },
        showFailures: true,
        domainErrors: ['Minimum and maximum must be different'],
        errors: {},
      },
    ],
  },
]
