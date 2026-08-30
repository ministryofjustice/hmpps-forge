import type { JourneyContractCase } from '../../contractRunner'
import {
  accessEffectOrderJourney,
  effectsBeforeOutcomesJourney,
  ancestorAccessOrderJourney,
  stepAccessOrderJourney,
  accessWhenFalseJourney,
  accessContinueJourney,
  firstMatchWinsJourney,
  submitBranchEffectsJourney,
  submitGuardsBlocksEffectsJourney,
  throwErrorBeforeValidationJourney,
  directSetAnswerJourney,
  clearAnswerJourney,
  hasAnswerJourney,
  clearThenHasAnswerJourney,
  responseHeaderJourney,
  requestCaptureJourney,
  requestMetadataJourney,
  answerIntrospectionJourney,
  accessFieldsToClearJourney,
  accessFieldsToClearReachableJourney,
  basicRedirectJourney,
  validationBranchJourney,
  conditionalCascadeJourney,
  schemalessConditionUndefinedJourney,
  throwErrorCascadeJourney,
  dynamicGotoFallbackJourney,
  accessRedirectJourney,
  accessErrorJourney,
  multiSubmitHooksJourney,
  guardsJourney,
  onValidEffectsJourney,
  dynamicErrorMessageJourney,
  headerSurvivesRedirectJourney,
} from './hooks.fixtures'

export const cases: JourneyContractCase[] = [
  {
    description: 'access effect order',
    journey: accessEffectOrderJourney,
    tests: [
      {
        name: 'should execute access effects in declaration order',
        path: '/access-order/form',
        data: { effectLog: ['first', 'second', 'third'] },
      },
    ],
  },
  {
    description: 'effects before outcomes',
    journey: effectsBeforeOutcomesJourney,
    tests: [
      {
        name: 'should complete access effects before evaluating outcomes',
        path: '/effects-first/form',
        redirectTo: '/effects-first/redirected',
      },
    ],
  },
  {
    description: 'ancestor hook order',
    journey: ancestorAccessOrderJourney,
    tests: [
      {
        name: 'should run ancestor journey hooks before child journey hooks',
        path: '/parent-hooks/child/form',
        data: { effectLog: ['parent', 'child'] },
      },
    ],
  },
  {
    description: 'step access hooks',
    journey: stepAccessOrderJourney,
    tests: [
      {
        name: 'should run a step-declared onAccess hook after ancestor journey hooks',
        path: '/step-access-order/form',
        data: { effectLog: ['journey', 'step'] },
      },
    ],
  },
  {
    description: 'access when-predicate',
    journey: accessWhenFalseJourney,
    tests: [
      {
        name: 'should skip effects when access hook when-predicate evaluates false',
        path: '/access-when-false/form',
        data: { effectLog: undefined },
      },
    ],
  },
  {
    description: 'access continue',
    journey: accessContinueJourney,
    tests: [
      {
        name: 'should run all hook effects when no outcome halts',
        path: '/access-continue/form',
        data: { effectLog: ['hook-one', 'hook-two'] },
      },
    ],
  },
  {
    description: 'first matching outcome',
    journey: firstMatchWinsJourney,
    tests: [
      {
        name: 'should use first matching outcome when multiple outcomes match in one next array',
        path: '/first-match-wins/form',
        redirectTo: '/first-match-wins/first-dest',
      },
    ],
  },
  {
    description: 'submit branch effects',
    journey: submitBranchEffectsJourney,
    tests: [
      {
        name: 'should run onAlways effects before onInvalid effects when validation fails',
        path: '/submit-branch/form',
        post: { name: '' },
        data: { effectLog: ['always', 'invalid'] },
      },
    ],
  },
  {
    description: 'submit hook guards',
    journey: submitGuardsBlocksEffectsJourney,
    tests: [
      {
        name: 'should skip effects when submit hook guards predicate evaluates false',
        path: '/submit-guards-effects/form',
        post: { name: 'Ada' },
        showFailures: false,
        data: { effectLog: undefined },
      },
    ],
  },
  {
    description: 'throwError before validation',
    journey: throwErrorBeforeValidationJourney,
    tests: [
      {
        name: 'should return error when onAlways throwError fires before validation runs',
        path: '/throw-before-valid/form',
        post: { name: '' },
        error: { status: 503, message: 'Service unavailable' },
      },
    ],
  },
  {
    description: 'setAnswer',
    journey: directSetAnswerJourney,
    tests: [
      {
        name: 'should make setAnswer values available in render context',
        path: '/direct-answer/form',
        current: { name: 'from-effect' },
      },
    ],
  },
  {
    description: 'clearAnswer',
    journey: clearAnswerJourney,
    tests: [
      {
        name: 'should clear answers via clearAnswer',
        path: '/clear-answer/form',
        session: { answers: { 'clear-answer': { toRemove: 'old value', toKeep: 'keep this' } } },
        current: { toKeep: 'keep this', toRemove: undefined },
      },
    ],
  },
  {
    description: 'hasAnswer',
    journey: hasAnswerJourney,
    tests: [
      {
        name: 'should report hasAnswer correctly for existing and missing answers',
        path: '/has-answer/form',
        session: { answers: { 'has-answer': { existing: 'some value' } } },
        data: { hasExisting: true, hasMissing: false },
      },
    ],
  },
  {
    description: 'clearAnswer then hasAnswer',
    journey: clearThenHasAnswerJourney,
    tests: [
      {
        name: 'should make hasAnswer return false after clearAnswer deletes the entry',
        path: '/clear-has/form',
        data: { hasBeforeClearing: true, hasAfterClearing: false },
      },
    ],
  },
  {
    description: 'response headers',
    journey: responseHeaderJourney,
    tests: [
      {
        name: 'should include setResponseHeader values in result headers',
        path: '/res-header/form',
        headers: { 'X-Custom': 'test-value', 'X-Request-Id': 'abc-123' },
      },
    ],
  },
  {
    description: 'session introspection',
    journey: requestCaptureJourney,
    tests: [
      {
        name: 'should expose session via getSession',
        path: '/req-capture/form',
        session: { answers: { 'req-capture': { name: 'Ada' } } },
        data: { sessionAnswerKeys: ['req-capture'] },
      },
    ],
  },
  {
    description: 'route parameters',
    journey: requestMetadataJourney,
    tests: [
      {
        name: 'should expose single route parameter via getRequestParam',
        path: '/req-meta/456/form',
        data: { singleParam: '456' },
      },
      {
        name: 'should expose all route parameters via getAllRequestParams',
        path: '/req-meta/789/form',
        data: { allParams: { id: '789' } },
      },
    ],
  },
  {
    description: 'answer introspection',
    journey: answerIntrospectionJourney,
    tests: [
      {
        name: 'should return stored value via getAnswer',
        path: '/answer-introspect/form',
        session: { answers: { 'answer-introspect': { existing: 'test-value', another: 'other' } } },
        data: { singleAnswer: 'test-value' },
      },
      {
        name: 'should return all current values via getAllAnswers',
        path: '/answer-introspect/form',
        session: { answers: { 'answer-introspect': { existing: 'one', another: 'two' } } },
        data: { allAnswers: { existing: 'one', another: 'two' } },
      },
    ],
  },
  {
    description: 'fields to clear in access hooks',
    journey: accessFieldsToClearJourney,
    tests: [
      {
        name: 'should report empty fields to clear in access hooks',
        path: '/access-ftc/form',
        data: { fieldsToClear: [] },
      },
    ],
  },
  {
    description: 'fields to clear with reachable answers',
    journey: accessFieldsToClearReachableJourney,
    tests: [
      {
        name: 'should report empty fields to clear when answers exist but all fields are reachable',
        path: '/access-ftc-reachable/form',
        session: { answers: { 'access-ftc-reachable': { name: 'Ada' } } },
        data: { fieldsToClear: [] },
      },
    ],
  },
  {
    description: 'submission redirect',
    journey: basicRedirectJourney,
    tests: [
      {
        name: 'should redirect to goto target on POST',
        path: '/basic-redirect/form',
        post: { name: 'Ada' },
        redirectTo: '/basic-redirect/done',
      },
    ],
  },
  {
    description: 'validation branching',
    journey: validationBranchJourney,
    tests: [
      {
        name: 'should redirect to onValid target when validation passes',
        path: '/val-branch/form',
        post: { name: 'Ada' },
        redirectTo: '/val-branch/success',
      },
      {
        name: 'should redirect to onInvalid target when validation fails',
        path: '/val-branch/form',
        post: { name: '' },
        redirectTo: '/val-branch/error',
      },
    ],
  },
  {
    description: 'conditional redirect cascade',
    journey: conditionalCascadeJourney,
    tests: [
      {
        name: 'should redirect to first matching conditional target',
        path: '/cascade/form',
        post: { choice: 'a' },
        redirectTo: '/cascade/path-a',
      },
      {
        name: 'should skip non-matching conditions and use fallback',
        path: '/cascade/form',
        post: { choice: 'c' },
        redirectTo: '/cascade/default',
      },
    ],
  },
  {
    description: 'schemaless conditions',
    journey: schemalessConditionUndefinedJourney,
    tests: [
      {
        name: 'should treat a schemaless custom condition as false when the matched answer is unanswered',
        path: '/schemaless-cond/form',
        post: { name: 'Ada' },
        redirectTo: '/schemaless-cond/done',
      },
    ],
  },
  {
    description: 'throwError cascade',
    journey: throwErrorCascadeJourney,
    tests: [
      {
        name: 'should return error when throwError condition is met',
        path: '/throw-error/form',
        post: { confirm: 'no' },
        error: { status: 400, message: 'Must confirm before continuing' },
      },
      {
        name: 'should fall through to redirect when throwError condition is not met',
        path: '/throw-error/form',
        post: { confirm: 'yes' },
        redirectTo: '/throw-error/done',
      },
    ],
  },
  {
    description: 'dynamic destination fallback',
    journey: dynamicGotoFallbackJourney,
    tests: [
      {
        name: 'should fall through to next redirect when dynamic goto resolves to undefined',
        path: '/dynamic-fallback/form',
        post: { name: 'Ada' },
        session: { data: {} },
        redirectTo: '/dynamic-fallback/fallback',
      },
    ],
  },
  {
    description: 'access hook outcomes',
    journey: accessRedirectJourney,
    tests: [
      {
        name: 'should redirect when access hook condition is met',
        path: '/access-redirect/protected',
        session: { data: { blocked: true } },
        redirectTo: '/access-redirect/denied',
      },
      {
        name: 'should render step when access hook condition is not met',
        path: '/access-redirect/protected',
        session: { data: { blocked: false } },
        rendered: true,
      },
    ],
  },
  {
    description: 'access hook errors',
    journey: accessErrorJourney,
    tests: [
      {
        name: 'should return error when access hook throws',
        path: '/access-error/resource',
        session: { data: { notFound: true } },
        error: { status: 404, message: 'Resource not found' },
      },
    ],
  },
  {
    description: 'submit hook selection',
    journey: multiSubmitHooksJourney,
    tests: [
      {
        name: 'should route to the submit hook whose when guard matches',
        path: '/multi-hooks/form',
        post: { action: 'search', query: 'test' },
        redirectTo: '/multi-hooks/results',
      },
      {
        name: 'should skip non-matching hooks and fire the matching one',
        path: '/multi-hooks/form',
        post: { action: 'reset' },
        redirectTo: '/multi-hooks/cleared',
      },
    ],
  },
  {
    description: 'submit hook guard outcomes',
    journey: guardsJourney,
    tests: [
      {
        name: 'should skip submit hook when guards condition fails',
        path: '/guards/form',
        post: { name: 'Ada' },
        session: { data: { sessionValid: false } },
        rendered: true,
        current: { name: 'Ada' },
      },
      {
        name: 'should execute submit hook when guards condition passes',
        path: '/guards/form',
        post: { name: 'Ada' },
        session: { data: { sessionValid: true } },
        redirectTo: '/guards/done',
      },
    ],
  },
  {
    description: 'submission effects',
    journey: onValidEffectsJourney,
    tests: [
      {
        name: 'should execute onValid effects before redirect',
        path: '/valid-effects/form',
        post: { name: 'Ada' },
        valid: true,
        saved: { name: 'Ada' },
      },
      {
        name: 'should not execute onValid effects when validation fails',
        path: '/valid-effects/form',
        post: { name: '' },
        rendered: true,
        saved: {},
      },
    ],
  },
  {
    description: 'dynamic error messages',
    journey: dynamicErrorMessageJourney,
    tests: [
      {
        name: 'should resolve dynamic error message from data',
        path: '/dynamic-error-msg/form',
        post: { name: 'Ada' },
        session: { data: { errorDetail: 'connection timeout' } },
        error: { status: 500, message: 'Save failed: connection timeout' },
      },
    ],
  },
  {
    description: 'headers across redirects',
    journey: headerSurvivesRedirectJourney,
    tests: [
      {
        name: 'should preserve response header set in access hook across redirect',
        path: '/header-redirect/start',
        session: { data: { shouldRedirect: true } },
        redirectTo: '/header-redirect/target',
        headers: { 'X-Custom-Nav': 'from-access' },
      },
    ],
  },
]
