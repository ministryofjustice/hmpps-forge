import type { JourneyContractCase } from '../../contractRunner'
import {
  forwardChainJourney,
  resumeChainJourney,
  dynamicResumeJourney,
  anchoredResumeJourney,
  frontierRedirectJourney,
  requestTimeGuardJourney,
  stableWhenGuardJourney,
  onAlwaysForwardJourney,
  onValidNoValidateJourney,
  cascadeForwardJourney,
  dynamicGotoForwardJourney,
  nestedDisabledChecksJourney,
  nestedOverrideChecksJourney,
  disabledChecksJourney,
  tieBreakerEntryJourney,
  conditionalTieBreakerJourney,
  orderedTieBreakerJourney,
  unreachableRedirectsToEntryJourney,
  entryNotFirstStepJourney,
  resumeWithInfoEntryJourney,
  conditionalEntryStepJourney,
} from './reachability.fixtures'

export const cases: JourneyContractCase[] = [
  {
    description: 'forward reachability',
    journey: forwardChainJourney,
    tests: [
      {
        name: 'should render an entry step with no progress',
        path: '/forward/a',
        rendered: true,
      },
      {
        name: 'should redirect to entry when the next step has no progress',
        path: '/forward/b',
        redirectTo: '/forward/a',
      },
      {
        name: 'should reach the next step when the previous step is validly answered',
        path: '/forward/b',
        session: { answers: { forward: { fieldA: 'done' } } },
        rendered: true,
      },
      {
        name: 'should not reach past a step whose answer fails validation',
        path: '/forward/c',
        session: { answers: { forward: { fieldA: 'done', fieldB: 'wrong' } } },
        redirectTo: '/forward/a',
      },
      {
        name: 'should reach the third step when the whole chain is validly answered',
        path: '/forward/c',
        session: { answers: { forward: { fieldA: 'done', fieldB: 'valid-b' } } },
        rendered: true,
      },
      {
        name: 'should redirect a journey request to the entry step',
        path: '/forward',
        redirectTo: '/forward/a',
      },
    ],
  },
  {
    description: 'resume behaviour',
    journey: resumeChainJourney,
    tests: [
      {
        name: 'should render the entry step when there is no progress',
        path: '/resume/a',
        rendered: true,
      },
      {
        name: 'should redirect an earlier step to the frontier when resume is active',
        path: '/resume/a',
        session: { answers: { resume: { fieldA: 'done' } } },
        redirectTo: '/resume/b',
      },
      {
        name: 'should render the frontier step',
        path: '/resume/b',
        session: { answers: { resume: { fieldA: 'done' } } },
        rendered: true,
      },
      {
        name: 'should redirect a journey request to the frontier',
        path: '/resume',
        session: { answers: { resume: { fieldA: 'done' } } },
        redirectTo: '/resume/b',
      },
      // Resume redirects intercept GETs only: the same request as the
      // earlier-step redirect row, but as a POST, reaches submission —
      // proven by the validation failure re-rendering the step.
      {
        name: 'should process a POST to an earlier reachable step instead of resume-redirecting',
        path: '/resume/a',
        post: { fieldA: '' },
        session: { answers: { resume: { fieldA: 'done' } } },
        errors: { fieldA: ['Required'] },
      },
    ],
  },
  {
    description: 'dynamic resume condition',
    journey: dynamicResumeJourney,
    tests: [
      {
        name: 'should redirect to the frontier when the resume expression is true',
        path: '/dyn-resume/a',
        session: { answers: { 'dyn-resume': { fieldA: 'done' } }, data: { resumeEnabled: true } },
        redirectTo: '/dyn-resume/b',
      },
      {
        name: 'should allow free access to reachable steps when the resume expression is false',
        path: '/dyn-resume/a',
        session: { answers: { 'dyn-resume': { fieldA: 'done' } }, data: { resumeEnabled: false } },
        rendered: true,
      },
    ],
  },
  {
    description: 'conditional-entry frontier anchoring',
    journey: anchoredResumeJourney,
    tests: [
      {
        name: 'should anchor the frontier past an earlier blocker when the conditional entry is active',
        path: '/anchor-resume/a',
        session: {
          answers: { 'anchor-resume': { fieldA: 'done', fieldB: 'wrong', fieldC: 'done', fieldD: 'done' } },
          data: { reviewMode: true },
        },
        redirectTo: '/anchor-resume/e',
      },
      {
        name: 'should stop the frontier at the blocker when the conditional entry is inactive',
        path: '/anchor-resume/a',
        session: {
          answers: { 'anchor-resume': { fieldA: 'done', fieldB: 'wrong', fieldC: 'done', fieldD: 'done' } },
          data: { reviewMode: false },
        },
        redirectTo: '/anchor-resume/b',
      },
      {
        name: 'should redirect a journey request to the anchored frontier',
        path: '/anchor-resume',
        session: {
          answers: { 'anchor-resume': { fieldA: 'done', fieldB: 'wrong', fieldC: 'done', fieldD: 'done' } },
          data: { reviewMode: true },
        },
        redirectTo: '/anchor-resume/e',
      },
    ],
  },
  {
    description: 'request-time forward guards',
    journey: requestTimeGuardJourney,
    tests: [
      {
        name: 'should keep a Post-guarded forward target reachable on GET when the source step is valid',
        path: '/req-time-guard/b',
        session: { answers: { 'req-time-guard': { fieldA: 'done' } } },
        rendered: true,
      },
      {
        name: 'should still gate a Post-guarded forward target on the source step validity',
        path: '/req-time-guard/b',
        redirectTo: '/req-time-guard/a',
      },
    ],
  },
  {
    description: 'stable submit-hook guards',
    journey: stableWhenGuardJourney,
    tests: [
      {
        name: 'should make hook redirect targets unreachable when a stable submit-hook when is false',
        path: '/stable-guard/b',
        session: { data: { allowB: false }, answers: { 'stable-guard': { fieldA: 'done' } } },
        redirectTo: '/stable-guard/a',
      },
      {
        name: 'should keep hook redirect targets reachable when a stable submit-hook when is true',
        path: '/stable-guard/b',
        session: { data: { allowB: true }, answers: { 'stable-guard': { fieldA: 'done' } } },
        rendered: true,
      },
    ],
  },
  {
    description: 'onAlways forward propagation',
    journey: onAlwaysForwardJourney,
    tests: [
      {
        name: 'should keep an onAlways redirect target reachable when the hook has no validate flag',
        path: '/on-always/b',
        session: { answers: { 'on-always': { fieldA: 'done' } } },
        rendered: true,
      },
    ],
  },
  {
    description: 'onValid without validate',
    journey: onValidNoValidateJourney,
    tests: [
      {
        name: 'should treat an onValid redirect target as unreachable when the hook does not validate',
        path: '/on-valid-off/b',
        session: { answers: { 'on-valid-off': { fieldA: 'done' } } },
        redirectTo: '/on-valid-off/a',
      },
    ],
  },
  {
    description: 'forward outcome cascades',
    journey: cascadeForwardJourney,
    tests: [
      {
        name: 'should make the first matching redirect target reachable when its guard is true',
        path: '/cascade/first',
        session: { data: { routeFirst: true }, answers: { cascade: { fieldA: 'done' } } },
        rendered: true,
      },
      {
        name: 'should make only the first matching redirect target reachable when outcomes cascade',
        path: '/cascade/second',
        session: { data: { routeFirst: true }, answers: { cascade: { fieldA: 'done' } } },
        redirectTo: '/cascade/a',
      },
      {
        name: 'should fall through a false-guarded redirect to a later outcome target',
        path: '/cascade/second',
        session: { data: { routeFirst: false }, answers: { cascade: { fieldA: 'done' } } },
        rendered: true,
      },
      {
        name: 'should not reach a false-guarded redirect target',
        path: '/cascade/first',
        session: { data: { routeFirst: false }, answers: { cascade: { fieldA: 'done' } } },
        redirectTo: '/cascade/a',
      },
    ],
  },
  {
    description: 'dynamic goto reachability',
    journey: dynamicGotoForwardJourney,
    tests: [
      {
        name: 'should make a step reachable when a dynamic goto expression resolves to its code',
        path: '/dyn-goto/chosen',
        session: { data: { target: 'chosen' }, answers: { 'dyn-goto': { fieldA: 'done' } } },
        rendered: true,
      },
      {
        name: 'should end the cascade when a dynamic goto resolves to a step code',
        path: '/dyn-goto/fallback',
        session: { data: { target: 'chosen' }, answers: { 'dyn-goto': { fieldA: 'done' } } },
        redirectTo: '/dyn-goto/a',
      },
      {
        name: 'should fall through to the next outcome when a dynamic goto resolves to undefined',
        path: '/dyn-goto/fallback',
        session: { answers: { 'dyn-goto': { fieldA: 'done' } } },
        rendered: true,
      },
      {
        name: 'should not reach an unresolved dynamic goto target',
        path: '/dyn-goto/chosen',
        session: { answers: { 'dyn-goto': { fieldA: 'done' } } },
        redirectTo: '/dyn-goto/a',
      },
    ],
  },
  {
    description: 'nested journey inheritance',
    journey: nestedDisabledChecksJourney,
    tests: [
      {
        name: 'should inherit disabled reachability checks from the nearest ancestor journey',
        path: '/nested-off/child/b',
        rendered: true,
      },
    ],
  },
  {
    description: 'nested journey override',
    journey: nestedOverrideChecksJourney,
    tests: [
      {
        name: 'should re-enable reachability checks when a child journey overrides its ancestor',
        path: '/nested-on/child/b',
        redirectTo: '/nested-on/child/a',
      },
    ],
  },
  {
    description: 'unreachable redirect target',
    journey: frontierRedirectJourney,
    tests: [
      {
        name: 'should redirect an unreachable step to the frontier when configured',
        path: '/frontier/c',
        session: { answers: { frontier: { fieldA: 'done' } } },
        redirectTo: '/frontier/b',
      },
      {
        name: 'should fall back to the entry step when no frontier exists',
        path: '/frontier/c',
        redirectTo: '/frontier/a',
      },
    ],
  },
  {
    description: 'disabled reachability checks',
    journey: disabledChecksJourney,
    tests: [
      {
        name: 'should treat every step as reachable when checks are disabled',
        path: '/no-checks/c',
        rendered: true,
      },
    ],
  },
  {
    description: 'entry tie-breakers',
    journey: tieBreakerEntryJourney,
    tests: [
      {
        name: 'should redirect a journey request to the higher-priority entry step',
        path: '/tie-entry',
        redirectTo: '/tie-entry/second',
      },
    ],
  },
  {
    description: 'conditional tie-breakers',
    journey: conditionalTieBreakerJourney,
    tests: [
      {
        name: 'should apply a tie-breaker priority when its condition is true',
        path: '/tie-cond',
        session: { data: { preferSecond: true } },
        redirectTo: '/tie-cond/second',
      },
      {
        name: 'should fall back to declaration order when the tie-breaker condition is false',
        path: '/tie-cond',
        session: { data: { preferSecond: false } },
        redirectTo: '/tie-cond/first',
      },
    ],
  },
  {
    description: 'ordered tie-breaker rules',
    journey: orderedTieBreakerJourney,
    tests: [
      {
        name: 'should take the priority from the first matching rule',
        path: '/tie-order',
        session: { data: { lowPriority: true } },
        redirectTo: '/tie-order/one',
      },
      {
        name: 'should skip a non-matching rule and use the next one',
        path: '/tie-order',
        session: { data: { lowPriority: false } },
        redirectTo: '/tie-order/two',
      },
    ],
  },
  {
    description: 'unreachable step access',
    journey: unreachableRedirectsToEntryJourney,
    tests: [
      {
        name: 'should redirect to entry step when accessing unreachable step',
        path: '/unreach-entry/step-two',
        redirectTo: '/unreach-entry/step-one',
      },
      {
        name: 'should redirect to entry step when POSTing to unreachable step',
        path: '/unreach-entry/step-two',
        post: {},
        redirectTo: '/unreach-entry/step-one',
      },
    ],
  },
  {
    description: 'entry step position',
    journey: entryNotFirstStepJourney,
    tests: [
      {
        name: 'should redirect an unreachable step to the entry step not the first declared step',
        path: '/entry-not-first/preamble',
        redirectTo: '/entry-not-first/form',
      },
    ],
  },
  {
    description: 'resume progress scoring',
    journey: resumeWithInfoEntryJourney,
    tests: [
      // The info-only overview entry must not count as progress, so resume
      // advances from the completed name step to the role frontier.
      {
        name: 'should advance past a validation-free info entry step to the frontier',
        path: '/resume-info/name',
        session: { answers: { 'resume-info': { firstName: 'Ada' } } },
        redirectTo: '/resume-info/role',
      },
    ],
  },
  {
    description: 'conditional entry reachability',
    journey: conditionalEntryStepJourney,
    tests: [
      {
        name: 'should render conditional entry step when condition is true',
        path: '/cond-entry/premium',
        session: { data: { isPremium: true } },
        rendered: true,
      },
      {
        name: 'should redirect away from conditional entry step when condition is false',
        path: '/cond-entry/premium',
        session: { data: { isPremium: false } },
        redirectTo: '/cond-entry/standard',
      },
    ],
  },
]
