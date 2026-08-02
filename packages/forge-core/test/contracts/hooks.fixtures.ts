import {
  GovUKTextInput,
  GovUKButton,
  GovUKInsetText,
  govukComponents,
} from '@ministryofjustice/hmpps-forge/govuk-components'

import {
  journey,
  step,
  access,
  submit,
  redirect,
  throwError,
  validation,
  defineEffectFunctions,
  type EffectFunctionExpr,
  Answer,
  Data,
  Self,
  Condition,
  createForgePackage,
} from '../../src/authoring'
import { ForgeTestHarness, type RequestTraceEvent } from '../../src/testing'
import { Effects, effectImplementations, type ContractSession } from './contractHelpers'

export interface HooksSession extends ContractSession {
  effectLog?: string[]
  captured?: Record<string, unknown>
}

interface HooksEffectShape {
  AppendLog: (marker: string) => EffectFunctionExpr
  SetHeader: (name: string, value: string) => EffectFunctionExpr
  SetCookie: (name: string, value: string) => EffectFunctionExpr
  SetCookieWithOptions: (name: string, value: string) => EffectFunctionExpr
  CaptureRequest: () => EffectFunctionExpr
  CaptureAnswerIntrospection: (code: string) => EffectFunctionExpr
  CaptureRequestFull: () => EffectFunctionExpr
  CaptureResponseReadback: () => EffectFunctionExpr
  CaptureAllData: () => EffectFunctionExpr
  CaptureFieldsToClear: () => EffectFunctionExpr
  DirectSetAnswer: (code: string, value: string) => EffectFunctionExpr
  DirectSetData: (key: string, value: string) => EffectFunctionExpr
  DirectClearAnswer: (code: string) => EffectFunctionExpr
  ThrowUnhandled: () => EffectFunctionExpr
  ThrowHttpError: () => EffectFunctionExpr
  ThrowNonError: () => EffectFunctionExpr
  StoreHasAnswer: (code: string, dataKey: string) => EffectFunctionExpr
}

export const httpEffectError = Object.assign(new Error('Booking not found'), {
  status: 404,
  statusCode: 404,
  dependency: 'bookingStore',
})
export const accidentalEffectError = new SyntaxError('Unexpected token in booking data')
export const nonErrorEffectFailure = { reason: 'booking data was malformed' }

const { effects: HooksEffects, implementations: hooksEffectImplementations } = defineEffectFunctions<HooksEffectShape>({
  AppendLog: () => (context, marker: string) => {
    const log = context.getData<string[]>('effectLog') ?? []
    const updatedLog = [...log, marker]

    context.setData('effectLog', updatedLog)

    const session = context.getSession() as HooksSession | undefined

    if (session) {
      session.effectLog = updatedLog
    }
  },

  SetHeader: () => (context, name: string, value: string) => {
    context.setResponseHeader(name, value)
  },

  SetCookie: () => (context, name: string, value: string) => {
    context.setResponseCookie(name, value)
  },

  CaptureRequest: () => context => {
    const session = context.getSession() as HooksSession | undefined

    context.setData('capturedPost', context.getAllPostData())
    context.setData('capturedQuery', context.getAllQueryParams())
    context.setData('sessionAnswerKeys', session?.answers ? Object.keys(session.answers) : [])

    if (session) {
      session.captured = { post: context.getAllPostData() }
    }
  },

  DirectSetAnswer: () => (context, code: string, value: string) => {
    context.setAnswer(code, value)
  },

  DirectSetData: () => (context, key: string, value: string) => {
    context.setData(key, value)
  },

  DirectClearAnswer: () => (context, code: string) => {
    context.clearAnswer(code)
  },

  StoreHasAnswer: () => (context, code: string, dataKey: string) => {
    context.setData(dataKey, context.hasAnswer(code))
  },

  SetCookieWithOptions: () => (context, name: string, value: string) => {
    context.setResponseCookie(name, value, {
      httpOnly: true,
      secure: true,
      maxAge: 86400,
      sameSite: 'strict',
    })
  },

  CaptureAnswerIntrospection: () => (context, code: string) => {
    context.setData('singleAnswer', context.getAnswer(code))
    context.setData('allAnswers', context.getAllAnswers())

    const history = context.getAnswerHistory(code)

    if (history) {
      context.setData('answerHistory', { current: history.current, mutations: history.mutations })
    }

    context.setData('hasAnswerHistory', history !== undefined)
    context.setData('allHistoryKeys', Object.keys(context.getAllAnswerHistories()))
  },

  CaptureRequestFull: () => context => {
    const session = context.getSession() as HooksSession | undefined

    context.setData('requestUrl', context.getRequestUrl())
    context.setData('allParams', context.getAllRequestParams())
    context.setData('allState', context.getAllState())

    const singleParam = context.getRequestParam('id')
    const singleQuery = context.getQueryParam('page')
    const singlePost = context.getPostData<string>('name')
    const singleState = context.getState<string>('user')
    const singleHeader = context.getRequestHeader('x-custom')
    const singleCookie = context.getRequestCookie('session')

    if (singleParam !== undefined) {
      context.setData('singleParam', singleParam)
    }
    if (singleQuery !== undefined) {
      context.setData('singleQuery', singleQuery)
    }
    if (singlePost !== undefined) {
      context.setData('singlePost', singlePost)
    }
    if (singleState !== undefined) {
      context.setData('singleState', singleState)
    }
    if (singleHeader !== undefined) {
      context.setData('singleHeader', singleHeader)
    }
    if (singleCookie !== undefined) {
      context.setData('singleCookie', singleCookie)
    }

    if (session) {
      session.captured = {
        ...session.captured,
        singlePost,
        singleHeader,
        singleCookie,
      }
    }
  },

  CaptureAllData: () => context => {
    const session = context.getSession() as HooksSession | undefined

    if (session) {
      session.captured = { ...session.captured, allData: context.getAllData() }
    }
  },

  CaptureFieldsToClear: () => context => {
    const fieldsToClear = context.getFieldsToClear()

    context.setData('fieldsToClear', fieldsToClear)

    const session = context.getSession() as HooksSession | undefined

    if (session) {
      session.captured = { ...session.captured, fieldsToClear }
    }
  },

  ThrowUnhandled: () => () => {
    throw accidentalEffectError
  },

  ThrowHttpError: () => () => {
    throw httpEffectError
  },

  ThrowNonError: () => () => {
    throw nonErrorEffectFailure
  },
})

export function createHooksClient(journeyDef: ReturnType<typeof journey>) {
  return new ForgeTestHarness()
    .registerGlobalComponents(govukComponents)
    .registerPackage(
      createForgePackage({
        journey: journeyDef,
        functions: { ...effectImplementations, ...hooksEffectImplementations },
      }),
    )
    .createClient()
}

export function createTracedHooksClient(journeyDef: ReturnType<typeof journey>, traces: RequestTraceEvent[]) {
  return new ForgeTestHarness({
      instrumentation: {
        sinks: [
          {
            onRequestTrace: event => traces.push(event),
          },
        ],
      },
    })
      .registerGlobalComponents(govukComponents)
      .registerPackage(
        createForgePackage({
          journey: journeyDef,
          functions: { ...effectImplementations, ...hooksEffectImplementations },
        }),
      )
      .createClient()
}

export const accessEffectOrderJourney = journey({
  code: 'access-order',
  path: '/access-order',
  title: 'Access Effect Order',
  onAccess: [
    access({
      effects: [HooksEffects.AppendLog('first'), HooksEffects.AppendLog('second'), HooksEffects.AppendLog('third')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

export const submitEffectOrderJourney = journey({
  code: 'submit-order',
  path: '/submit-order',
  title: 'Submit Effect Order',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [HooksEffects.AppendLog('alpha'), HooksEffects.AppendLog('beta')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const effectsBeforeOutcomesJourney = journey({
  code: 'effects-first',
  path: '/effects-first',
  title: 'Effects Before Outcomes',
  onAccess: [
    access({
      effects: [HooksEffects.DirectSetData('gate', 'open')],
      next: [
        redirect({
          when: Data('gate').match(Condition.Equals('open')),
          goto: 'redirected',
        }),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Should not render' })],
    }),
    step({ code: 'redirected', path: '/redirected', title: 'Redirected', blocks: [] }),
  ],
})

export const ancestorAccessOrderJourney = journey({
  code: 'parent-hooks',
  path: '/parent-hooks',
  title: 'Parent Hooks',
  onAccess: [access({ effects: [HooksEffects.AppendLog('parent')] })],
  children: [
    journey({
      code: 'child-hooks',
      path: '/child',
      title: 'Child Hooks',
      onAccess: [access({ effects: [HooksEffects.AppendLog('child')] })],
      steps: [
        step({
          path: '/form',
          title: 'Form',
          reachability: { entryWhen: true },
          blocks: [GovUKInsetText({ text: 'Content' })],
        }),
      ],
    }),
  ],
})

export const accessShortCircuitJourney = journey({
  code: 'access-circuit',
  path: '/access-circuit',
  title: 'Access Short Circuit',
  onAccess: [
    access({
      effects: [HooksEffects.AppendLog('first')],
      next: [redirect({ goto: 'blocked' })],
    }),
    access({
      effects: [HooksEffects.AppendLog('second')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
    step({ code: 'blocked', path: '/blocked', title: 'Blocked', blocks: [] }),
  ],
})

export const accessContinueJourney = journey({
  code: 'access-continue',
  path: '/access-continue',
  title: 'Access Continue',
  onAccess: [
    access({ effects: [HooksEffects.AppendLog('hook-one')] }),
    access({ effects: [HooksEffects.AppendLog('hook-two')] }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

export const submitBranchEffectsJourney = journey({
  code: 'submit-branch',
  path: '/submit-branch',
  title: 'Submit Branch',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'name',
          label: 'Name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onAlways: {
            effects: [HooksEffects.AppendLog('always')],
          },
          onValid: {
            effects: [HooksEffects.AppendLog('valid')],
            next: [redirect({ goto: 'done' })],
          },
          onInvalid: {
            effects: [HooksEffects.AppendLog('invalid')],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const responseHeaderJourney = journey({
  code: 'res-header',
  path: '/res-header',
  title: 'Response Header',
  onAccess: [
    access({
      effects: [HooksEffects.SetHeader('X-Custom', 'test-value'), HooksEffects.SetHeader('X-Request-Id', 'abc-123')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

export const responseCookieJourney = journey({
  code: 'res-cookie',
  path: '/res-cookie',
  title: 'Response Cookie',
  onAccess: [
    access({
      effects: [HooksEffects.SetCookie('preference', 'dark')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

export const requestCaptureJourney = journey({
  code: 'req-capture',
  path: '/req-capture',
  title: 'Request Capture',
  onAccess: [
    access({
      effects: [HooksEffects.CaptureRequest()],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const directSetAnswerJourney = journey({
  code: 'direct-answer',
  path: '/direct-answer',
  title: 'Direct Set Answer',
  onAccess: [
    access({
      effects: [HooksEffects.DirectSetAnswer('name', 'from-effect')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const clearAnswerJourney = journey({
  code: 'clear-answer',
  path: '/clear-answer',
  title: 'Clear Answer',
  onAccess: [
    access({
      effects: [Effects.LoadAnswers('clear-answer'), HooksEffects.DirectClearAnswer('toRemove')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'toRemove', label: 'Remove me' }),
        GovUKTextInput({ code: 'toKeep', label: 'Keep me' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const hasAnswerJourney = journey({
  code: 'has-answer',
  path: '/has-answer',
  title: 'Has Answer',
  onAccess: [
    access({
      effects: [
        Effects.LoadAnswers('has-answer'),
        HooksEffects.StoreHasAnswer('existing', 'hasExisting'),
        HooksEffects.StoreHasAnswer('missing', 'hasMissing'),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'existing', label: 'Existing' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const mutationSourceJourney = journey({
  code: 'mutation-source',
  path: '/mutation-source',
  title: 'Mutation Source',
  onAccess: [
    access({
      effects: [HooksEffects.DirectSetAnswer('accessField', 'loaded')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [HooksEffects.DirectSetAnswer('submitField', 'processed')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const answerIntrospectionJourney = journey({
  code: 'answer-introspect',
  path: '/answer-introspect',
  title: 'Answer Introspection',
  onAccess: [
    access({
      effects: [Effects.LoadAnswers('answer-introspect'), HooksEffects.CaptureAnswerIntrospection('existing')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'existing', label: 'Existing' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const requestMetadataJourney = journey({
  code: 'req-meta',
  path: '/req-meta/:id',
  title: 'Request Metadata',
  onAccess: [
    access({
      effects: [HooksEffects.CaptureRequestFull()],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const cookieOptionsJourney = journey({
  code: 'cookie-opts',
  path: '/cookie-opts',
  title: 'Cookie Options',
  onAccess: [
    access({
      effects: [HooksEffects.SetCookieWithOptions('secure-pref', 'dark')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

export const allDataJourney = journey({
  code: 'all-data',
  path: '/all-data',
  title: 'All Data',
  onAccess: [
    access({
      effects: [
        HooksEffects.DirectSetData('key1', 'value1'),
        HooksEffects.DirectSetData('key2', 'value2'),
        HooksEffects.CaptureAllData(),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

export const fieldsToClearJourney = journey({
  code: 'fields-clear',
  path: '/fields-clear',
  title: 'Fields To Clear',
  onAccess: [access({ effects: [Effects.LoadAnswers('fields-clear')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'choice', label: 'Choice' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [HooksEffects.CaptureFieldsToClear(), Effects.SaveAnswers('fields-clear')],
            next: [
              redirect({ when: Answer('choice').match(Condition.Equals('include')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [GovUKTextInput({ code: 'detail', label: 'Detail' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('fields-clear')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const accessFieldsToClearJourney = journey({
  code: 'access-ftc',
  path: '/access-ftc',
  title: 'Access Fields To Clear',
  onAccess: [
    access({
      effects: [HooksEffects.CaptureFieldsToClear()],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

export const accessWhenFalseJourney = journey({
  code: 'access-when-false',
  path: '/access-when-false',
  title: 'Access When False',
  onAccess: [
    access({
      when: Data('gate').match(Condition.Equals('open')),
      effects: [HooksEffects.AppendLog('should-not-run')],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

export const firstMatchWinsJourney = journey({
  code: 'first-match-wins',
  path: '/first-match-wins',
  title: 'First Match Wins',
  onAccess: [
    access({
      effects: [HooksEffects.DirectSetData('flag', 'yes')],
      next: [
        redirect({ when: Data('flag').match(Condition.Equals('yes')), goto: 'first-dest' }),
        redirect({ when: Data('flag').match(Condition.Equals('yes')), goto: 'second-dest' }),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Should not render' })],
    }),
    step({ code: 'first-dest', path: '/first-dest', title: 'First', blocks: [] }),
    step({ code: 'second-dest', path: '/second-dest', title: 'Second', blocks: [] }),
  ],
})

export const clearThenHasAnswerJourney = journey({
  code: 'clear-has',
  path: '/clear-has',
  title: 'Clear Then Has Answer',
  onAccess: [
    access({
      effects: [
        HooksEffects.DirectSetAnswer('target', 'some-value'),
        HooksEffects.StoreHasAnswer('target', 'hasBeforeClearing'),
        HooksEffects.DirectClearAnswer('target'),
        HooksEffects.StoreHasAnswer('target', 'hasAfterClearing'),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

export const accessFieldsToClearReachableJourney = journey({
  code: 'access-ftc-reachable',
  path: '/access-ftc-reachable',
  title: 'Access Fields To Clear Reachable',
  onAccess: [
    access({
      effects: [Effects.LoadAnswers('access-ftc-reachable'), HooksEffects.CaptureFieldsToClear()],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' })],
    }),
  ],
})

export const throwErrorBeforeValidationJourney = journey({
  code: 'throw-before-valid',
  path: '/throw-before-valid',
  title: 'Throw Error Before Validation',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'name',
          label: 'Name',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your name',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onAlways: {
            next: [
              throwError({
                status: 503,
                message: 'Service unavailable',
              }),
            ],
          },
          onValid: {
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const submitGuardsBlocksEffectsJourney = journey({
  code: 'submit-guards-effects',
  path: '/submit-guards-effects',
  title: 'Submit Guards Blocks Effects',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          guards: Data('guardOpen').match(Condition.Equals(true)),
          validate: false,
          onAlways: {
            effects: [HooksEffects.AppendLog('guarded-effect')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const journeyRootAccessRedirectJourney = journey({
  code: 'root-access-redirect',
  path: '/root-access-redirect',
  title: 'Root Access Redirect',
  onAccess: [
    access({
      effects: [HooksEffects.AppendLog('root-hook')],
      next: [redirect({ goto: 'intercepted' })],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
    step({ code: 'intercepted', path: '/intercepted', title: 'Intercepted', blocks: [] }),
  ],
})

const errorOutcomeJourney = (code: string, effect: EffectFunctionExpr) =>
  journey({
    code,
    path: `/${code}`,
    title: 'Error Outcome',
    onAccess: [access({ effects: [effect] })],
    steps: [
      step({
        path: '/form',
        title: 'Form',
        reachability: { entryWhen: true },
        blocks: [GovUKInsetText({ text: 'Content' })],
      }),
    ],
  })

export const crashingEffectJourney = errorOutcomeJourney('crash-effect', HooksEffects.ThrowUnhandled())

export const httpErrorEffectJourney = errorOutcomeJourney('http-error-effect', HooksEffects.ThrowHttpError())

export const nonErrorEffectJourney = errorOutcomeJourney('non-error-effect', HooksEffects.ThrowNonError())
