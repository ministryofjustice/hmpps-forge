import type { JourneyContractCase } from '../../contractRunner'
import {
  unreachableStepCleardownJourney,
  linearChainCleardownJourney,
  cleardownOnGetJourney,
  disabledReachabilityCleardownJourney,
  dynamicCodeCleardownJourney,
  iteratorCleardownJourney,
  iteratorInventoryCleardownJourney,
  nestedIteratorInventoryCleardownJourney,
  conditionalEntryCleardownJourney,
  parameterizedCleardownJourney,
} from './answerCleardown.fixtures'

export const cases: JourneyContractCase[] = [
  {
    description: 'unreachable step cleardown',
    journey: unreachableStepCleardownJourney,
    tests: [
      {
        name: 'should clear answers for steps that become unreachable',
        path: '/cleardown/choose',
        post: { route: 'skip' },
        session: { answers: { cleardown: { route: 'detail', detail: 'some info' } } },
        saved: { route: 'skip' },
      },
      {
        name: 'should retain answers for steps that remain reachable',
        path: '/cleardown/choose',
        post: { route: 'detail' },
        session: { answers: { cleardown: { route: 'detail', detail: 'some info' } } },
        saved: { route: 'detail', detail: 'some info' },
      },
    ],
  },
  {
    description: 'linear chain cleardown',
    journey: linearChainCleardownJourney,
    tests: [
      {
        name: 'should retain all answers of a valid linear chain when accessing its entry step',
        path: '/chain/a',
        session: { answers: { chain: { fieldA: 'answer-a', fieldB: 'valid-b', fieldC: 'answer-c' } } },
        current: { fieldA: 'answer-a', fieldB: 'valid-b', fieldC: 'answer-c' },
      },
      {
        name: 'should clear answers past an invalid step while retaining the invalid step when accessing the entry step',
        path: '/chain/a',
        session: { answers: { chain: { fieldA: 'answer-a', fieldB: 'wrong-b', fieldC: 'answer-c' } } },
        current: { fieldB: 'wrong-b', fieldC: undefined },
      },
    ],
  },
  {
    description: 'cleardown on GET',
    journey: cleardownOnGetJourney,
    tests: [
      {
        name: 'should clear stale answers on GET when step becomes unreachable',
        path: '/cleardown-get/choose',
        session: { answers: { 'cleardown-get': { route: 'skip', detail: 'stale info' } } },
        current: { detail: undefined },
      },
    ],
  },
  {
    description: 'iterator cleardown',
    journey: iteratorCleardownJourney,
    tests: [
      {
        name: 'should clear iterator-derived answers via regex when iterator step becomes unreachable',
        path: '/iter-cleardown/choose',
        post: { route: 'skip' },
        session: { answers: { 'iter-cleardown': { route: 'members', memberName_0: 'Alice', memberName_1: 'Bob' } } },
        saved: { route: 'skip' },
      },
      {
        name: 'should retain iterator-derived answers when iterator step remains reachable',
        path: '/iter-cleardown/choose',
        post: { route: 'members' },
        session: { answers: { 'iter-cleardown': { route: 'members', memberName_0: 'Alice', memberName_1: 'Bob' } } },
        saved: { route: 'members', memberName_0: 'Alice', memberName_1: 'Bob' },
      },
    ],
  },
  {
    description: 'dynamic field code cleardown',
    journey: dynamicCodeCleardownJourney,
    tests: [
      {
        name: 'should clear a dynamically-coded answer when its step becomes unreachable without cleardownFieldCodes',
        path: '/dynamic-cleardown/choose',
        post: { route: 'skip' },
        session: {
          data: { variant: 'a' },
          answers: { 'dynamic-cleardown': { route: 'detail', detail_a: 'stale info' } },
        },
        saved: { route: 'skip' },
      },
      {
        name: 'should retain a dynamically-coded answer when its step remains reachable',
        path: '/dynamic-cleardown/choose',
        post: { route: 'detail' },
        session: {
          data: { variant: 'a' },
          answers: { 'dynamic-cleardown': { route: 'detail', detail_a: 'keep this' } },
        },
        saved: { route: 'detail', detail_a: 'keep this' },
      },
    ],
  },
  {
    description: 'iterator field inventory cleardown',
    journey: iteratorInventoryCleardownJourney,
    tests: [
      {
        name: 'should clear per-item iterator answers via the field inventory when the iterator step becomes unreachable',
        path: '/iter-inventory/choose',
        post: { route: 'skip' },
        session: {
          data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
          answers: { 'iter-inventory': { route: 'members', memberName_0: 'Ada', memberName_1: 'Grace' } },
        },
        saved: { route: 'skip' },
      },
      {
        name: 'should retain per-item iterator answers when the iterator step remains reachable',
        path: '/iter-inventory/choose',
        post: { route: 'members' },
        session: {
          data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
          answers: { 'iter-inventory': { route: 'members', memberName_0: 'Ada', memberName_1: 'Grace' } },
        },
        saved: { route: 'members', memberName_0: 'Ada', memberName_1: 'Grace' },
      },
    ],
  },
  {
    description: 'nested iterator field inventory cleardown',
    journey: nestedIteratorInventoryCleardownJourney,
    tests: [
      {
        name: 'should clear nested iterator per-item answers through both loop scopes when the step becomes unreachable',
        path: '/nested-inventory/choose',
        post: { route: 'skip' },
        session: {
          data: {
            teams: [
              { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
              { name: 'Beta', members: [{ name: 'Linus' }] },
            ],
          },
          answers: {
            'nested-inventory': {
              route: 'members',
              team_0_member_0: 'Ada',
              team_0_member_1: 'Grace',
              team_1_member_0: 'Linus',
            },
          },
        },
        saved: { route: 'skip' },
      },
      {
        name: 'should retain nested iterator per-item answers when the step remains reachable',
        path: '/nested-inventory/choose',
        post: { route: 'members' },
        session: {
          data: {
            teams: [
              { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
              { name: 'Beta', members: [{ name: 'Linus' }] },
            ],
          },
          answers: {
            'nested-inventory': {
              route: 'members',
              team_0_member_0: 'Ada',
              team_0_member_1: 'Grace',
              team_1_member_0: 'Linus',
            },
          },
        },
        saved: { route: 'members', team_0_member_0: 'Ada', team_0_member_1: 'Grace', team_1_member_0: 'Linus' },
      },
    ],
  },
  {
    description: 'disabled reachability cleardown',
    journey: disabledReachabilityCleardownJourney,
    tests: [
      {
        name: 'should retain stale answers when the journey disables reachability checks',
        path: '/disabled-cleardown/choose',
        post: { route: 'skip' },
        session: { answers: { 'disabled-cleardown': { route: 'detail', detail: 'stale info' } } },
        saved: { route: 'skip', detail: 'stale info' },
      },
    ],
  },
  {
    description: 'conditional entry cleardown',
    journey: conditionalEntryCleardownJourney,
    tests: [
      {
        name: 'should not clear answers for conditional entry forward steps when condition is true',
        path: '/cond-entry-clear/main',
        session: { data: { bonusEnabled: true }, answers: { 'cond-entry-clear': { bonusDetail: 'existing bonus' } } },
        current: { bonusDetail: 'existing bonus' },
      },
      {
        name: 'should clear answers for conditional entry forward steps when condition is false',
        path: '/cond-entry-clear/main',
        session: { data: { bonusEnabled: false }, answers: { 'cond-entry-clear': { bonusDetail: 'stale bonus' } } },
        current: { bonusDetail: undefined },
      },
    ],
  },
  {
    description: 'parameterized route cleardown',
    journey: parameterizedCleardownJourney,
    tests: [
      {
        name: 'should clear stale answers when step becomes unreachable on a parameterized route',
        path: '/param-cleardown/42/choose',
        post: { route: 'skip' },
        session: { answers: { 'param-cleardown': { route: 'detail', detail: 'stale info' } } },
        saved: { route: 'skip' },
      },
      {
        name: 'should retain answers when step remains reachable on a parameterized route',
        path: '/param-cleardown/42/choose',
        post: { route: 'detail' },
        session: { answers: { 'param-cleardown': { route: 'detail', detail: 'keep this' } } },
        saved: { route: 'detail', detail: 'keep this' },
      },
    ],
  },
]
