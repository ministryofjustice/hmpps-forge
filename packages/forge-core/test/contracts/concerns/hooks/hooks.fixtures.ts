import {
  journey,
  step,
  access,
  submit,
  redirect,
  throwError,
  validation,
  effect,
  condition,
  type EffectFunctionExpr,
  Answer,
  Data,
  Post,
  Format,
  Self,
  Condition,
  createForgePackage,
  EffectRegistry,
  type EffectFunctionContext,
} from '../../../../src/authoring'
import { ForgeTestHarness } from '../../../../src/testing'
import { Effects, type ContractSession } from '../../contractHelpers'
import { TextField, StaticText } from '../../testComponents'

export interface HooksSession extends ContractSession {
  effectLog?: string[]
  captured?: Record<string, unknown>
}

export const httpEffectError = Object.assign(new Error('Booking not found'), {
  status: 404,
  statusCode: 404,
  dependency: 'bookingStore',
})
export const accidentalEffectError = new SyntaxError('Unexpected token in booking data')
export const nonErrorEffectFailure = { reason: 'booking data was malformed' }

const HooksEffects = {
  AppendLog: effect('AppendLog', {
    factory: () => (context, marker: string) => {
      const log = context.getData<string[]>('effectLog') ?? []
      const updatedLog = [...log, marker]

      context.setData('effectLog', updatedLog)

      const session = context.getSession() as HooksSession | undefined

      if (session) {
        session.effectLog = updatedLog
      }
    },
  }),

  SetHeader: effect('SetHeader', {
    factory: () => (context, name: string, value: string) => {
      context.setResponseHeader(name, value)
    },
  }),

  SetCookie: effect('SetCookie', {
    factory: () => (context, name: string, value: string) => {
      context.setResponseCookie(name, value)
    },
  }),

  CaptureRequest: effect('CaptureRequest', {
    factory: () => context => {
      const session = context.getSession() as HooksSession | undefined

      context.setData('capturedPost', context.getAllPostData())
      context.setData('capturedQuery', context.getAllQueryParams())
      context.setData('sessionAnswerKeys', session?.answers ? Object.keys(session.answers) : [])

      if (session) {
        session.captured = { post: context.getAllPostData() }
      }
    },
  }),

  DirectSetAnswer: effect('DirectSetAnswer', {
    factory: () => (context, code: string, value: string) => {
      context.setAnswer(code, value)
    },
  }),

  DirectSetData: effect('DirectSetData', {
    factory: () => (context, key: string, value: string) => {
      context.setData(key, value)
    },
  }),

  DirectClearAnswer: effect('DirectClearAnswer', {
    factory: () => (context, code: string) => {
      context.clearAnswer(code)
    },
  }),

  StoreHasAnswer: effect('StoreHasAnswer', {
    factory: () => (context, code: string, dataKey: string) => {
      context.setData(dataKey, context.hasAnswer(code))
    },
  }),

  SetCookieWithOptions: effect('SetCookieWithOptions', {
    factory: () => (context, name: string, value: string) => {
      context.setResponseCookie(name, value, {
        httpOnly: true,
        secure: true,
        maxAge: 86400,
        sameSite: 'strict',
      })
    },
  }),

  CaptureAnswerIntrospection: effect('CaptureAnswerIntrospection', {
    factory: () => (context, code: string) => {
      context.setData('singleAnswer', context.getAnswer(code))
      context.setData('allAnswers', context.getAllAnswers())

      const history = context.getAnswerHistory(code)

      if (history) {
        context.setData('answerHistory', { current: history.current, mutations: history.mutations })
      }

      context.setData('hasAnswerHistory', history !== undefined)
      context.setData('allHistoryKeys', Object.keys(context.getAllAnswerHistories()))
    },
  }),

  CaptureRequestFull: effect('CaptureRequestFull', {
    factory: () => context => {
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
  }),

  CaptureAllData: effect('CaptureAllData', {
    factory: () => context => {
      const session = context.getSession() as HooksSession | undefined

      if (session) {
        session.captured = { ...session.captured, allData: context.getAllData() }
      }
    },
  }),

  CaptureFieldsToClear: effect('CaptureFieldsToClear', {
    factory: () => context => {
      const fieldsToClear = context.getFieldsToClear()

      context.setData('fieldsToClear', fieldsToClear)

      const session = context.getSession() as HooksSession | undefined

      if (session) {
        session.captured = { ...session.captured, fieldsToClear }
      }
    },
  }),

  ThrowUnhandled: effect('ThrowUnhandled', {
    factory: () => () => {
      throw accidentalEffectError
    },
  }),

  ThrowHttpError: effect('ThrowHttpError', {
    factory: () => () => {
      throw httpEffectError
    },
  }),

  ThrowNonError: effect('ThrowNonError', {
    factory: () => () => {
      throw nonErrorEffectFailure
    },
  }),
}

const unusualNameEffects = new EffectRegistry()
const ReservedWordEffect = unusualNameEffects.register('class', () => (context: EffectFunctionContext) => {
  const log = context.getData<string[]>('unusualEffectLog') ?? []

  context.setData('unusualEffectLog', [...log, 'class'])
})
const PunctuatedEffect = unusualNameEffects.register('audit.log', () => (context: EffectFunctionContext) => {
  const log = context.getData<string[]>('unusualEffectLog') ?? []

  context.setData('unusualEffectLog', [...log, 'audit.log'])
})
const NumericEffect = unusualNameEffects.register('123 effect', () => (context: EffectFunctionContext) => {
  const log = context.getData<string[]>('unusualEffectLog') ?? []

  context.setData('unusualEffectLog', [...log, '123 effect'])
})

export function createUnusualNameEffectsClient() {
  return new ForgeTestHarness()
    .registerPackage(
      createForgePackage({
        journey: unusualNameEffectsJourney,
        functions: unusualNameEffects,
      }),
    )
    .createClient()
}

export const unusualNameEffectsJourney = journey({
  code: 'unusual-effect-names',
  path: '/unusual-effect-names',
  title: 'Unusual effect names',
  onAccess: [access({ effects: [ReservedWordEffect(), PunctuatedEffect(), NumericEffect()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Content' })],
    }),
  ],
})

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
      blocks: [StaticText({ text: 'Content' })],
    }),
  ],
})

export const stepAccessOrderJourney = journey({
  code: 'step-access-order',
  path: '/step-access-order',
  title: 'Step Access Order',
  onAccess: [access({ effects: [HooksEffects.AppendLog('journey')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      onAccess: [access({ effects: [HooksEffects.AppendLog('step')] })],
      blocks: [StaticText({ text: 'Content' })],
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
      blocks: [TextField({ code: 'name' })],
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
      blocks: [StaticText({ text: 'Should not render' })],
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
          blocks: [StaticText({ text: 'Content' })],
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
      blocks: [StaticText({ text: 'Content' })],
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
      blocks: [StaticText({ text: 'Content' })],
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
        TextField({
          code: 'name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
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
      blocks: [StaticText({ text: 'Content' })],
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
      blocks: [StaticText({ text: 'Content' })],
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
      blocks: [TextField({ code: 'name' })],
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
      blocks: [TextField({ code: 'name' })],
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
      blocks: [TextField({ code: 'toRemove' }), TextField({ code: 'toKeep' })],
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
      blocks: [TextField({ code: 'existing' })],
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
      blocks: [TextField({ code: 'name' })],
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
      blocks: [TextField({ code: 'existing' })],
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
      blocks: [TextField({ code: 'name' })],
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
      blocks: [StaticText({ text: 'Content' })],
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
      blocks: [StaticText({ text: 'Content' })],
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
      blocks: [TextField({ code: 'choice' })],
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
      blocks: [TextField({ code: 'detail' })],
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
      blocks: [StaticText({ text: 'Content' })],
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
      blocks: [StaticText({ text: 'Content' })],
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
      blocks: [StaticText({ text: 'Should not render' })],
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
      blocks: [StaticText({ text: 'Content' })],
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
      blocks: [TextField({ code: 'name' })],
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
        TextField({
          code: 'name',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your name',
            }),
          ],
        }),
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
      blocks: [TextField({ code: 'name' })],
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
      blocks: [StaticText({ text: 'Content' })],
    }),
    step({ code: 'intercepted', path: '/intercepted', title: 'Intercepted', blocks: [] }),
  ],
})

const errorOutcomeJourney = (code: string, effectExpr: EffectFunctionExpr) =>
  journey({
    code,
    path: `/${code}`,
    title: 'Error Outcome',
    onAccess: [access({ effects: [effectExpr] })],
    steps: [
      step({
        path: '/form',
        title: 'Form',
        reachability: { entryWhen: true },
        blocks: [StaticText({ text: 'Content' })],
      }),
    ],
  })

export const crashingEffectJourney = errorOutcomeJourney('crash-effect', HooksEffects.ThrowUnhandled())

export const httpErrorEffectJourney = errorOutcomeJourney('http-error-effect', HooksEffects.ThrowHttpError())

export const nonErrorEffectJourney = errorOutcomeJourney('non-error-effect', HooksEffects.ThrowNonError())

const HooksConditions = {
  // No inputSchema, and the body reads `value.length` with no guard, so it throws
  // on undefined — the engine must short-circuit to false before it is called.
  HasContent: condition('HasContent', {
    factory: () => (value: string) => value.length > 0,
  }),
}

export const basicRedirectJourney = journey({
  code: 'basic-redirect',
  path: '/basic-redirect',
  title: 'Basic Redirect',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'name' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const validationBranchJourney = journey({
  code: 'val-branch',
  path: '/val-branch',
  title: 'Validation Branch',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: 'success' })],
          },
          onInvalid: {
            next: [redirect({ goto: 'error' })],
          },
        }),
      ],
    }),
    step({ code: 'success', path: '/success', title: 'Success', blocks: [] }),
    step({ code: 'error', path: '/error', title: 'Error', blocks: [] }),
  ],
})

export const onAlwaysHaltsJourney = journey({
  code: 'always-halts',
  path: '/always-halts',
  title: 'Always Halts',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onAlways: {
            next: [redirect({ when: Data('skipValidation').match(Condition.Equals(true)), goto: 'exit' })],
          },
          onValid: {
            next: [redirect({ goto: 'next' })],
          },
        }),
      ],
    }),
    step({ code: 'exit', path: '/exit', title: 'Exit', blocks: [] }),
    step({ code: 'next', path: '/next', title: 'Next', blocks: [] }),
  ],
})

export const conditionalCascadeJourney = journey({
  code: 'cascade',
  path: '/cascade',
  title: 'Cascade',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'choice' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [
              redirect({ when: Answer('choice').match(Condition.Equals('a')), goto: 'path-a' }),
              redirect({ when: Answer('choice').match(Condition.Equals('b')), goto: 'path-b' }),
              redirect({ goto: 'default' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'path-a', path: '/path-a', title: 'Path A', blocks: [] }),
    step({ code: 'path-b', path: '/path-b', title: 'Path B', blocks: [] }),
    step({ code: 'default', path: '/default', title: 'Default', blocks: [] }),
  ],
})

export const throwErrorCascadeJourney = journey({
  code: 'throw-error',
  path: '/throw-error',
  title: 'Throw Error',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'confirm' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [
              throwError({
                when: Answer('confirm').not.match(Condition.Equals('yes')),
                status: 400,
                message: 'Must confirm before continuing',
              }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dynamicGotoFallbackJourney = journey({
  code: 'dynamic-fallback',
  path: '/dynamic-fallback',
  title: 'Dynamic Fallback',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'name' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [redirect({ goto: Data('destination') }), redirect({ goto: 'fallback' })],
          },
        }),
      ],
    }),
    step({ code: 'step-a', path: '/step-a', title: 'Step A', blocks: [] }),
    step({ code: 'fallback', path: '/fallback', title: 'Fallback', blocks: [] }),
  ],
})

export const schemalessConditionUndefinedJourney = journey({
  code: 'schemaless-cond',
  path: '/schemaless-cond',
  title: 'Schemaless Condition Undefined',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'name' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [
              redirect({ when: Answer('unanswered').match(HooksConditions.HasContent()), goto: 'blocked' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'blocked', path: '/blocked', title: 'Blocked', blocks: [] }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const accessRedirectJourney = journey({
  code: 'access-redirect',
  path: '/access-redirect',
  title: 'Access Redirect',
  onAccess: [
    access({
      effects: [Effects.LoadData()],
      next: [redirect({ when: Data('blocked').match(Condition.Equals(true)), goto: 'denied' })],
    }),
  ],
  steps: [
    step({
      path: '/protected',
      title: 'Protected',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'secret' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'denied', path: '/denied', title: 'Denied', blocks: [] }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const accessErrorJourney = journey({
  code: 'access-error',
  path: '/access-error',
  title: 'Access Error',
  onAccess: [
    access({
      effects: [Effects.LoadData()],
      next: [
        throwError({
          when: Data('notFound').match(Condition.Equals(true)),
          status: 404,
          message: 'Resource not found',
        }),
      ],
    }),
  ],
  steps: [
    step({
      path: '/resource',
      title: 'Resource',
      reachability: { entryWhen: true },
      blocks: [],
    }),
  ],
})

export const multiSubmitHooksJourney = journey({
  code: 'multi-hooks',
  path: '/multi-hooks',
  title: 'Multi Hooks',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'query' })],
      onSubmission: [
        submit({
          when: Post('action').match(Condition.Equals('search')),
          validate: false,
          onAlways: { next: [redirect({ goto: 'results' })] },
        }),
        submit({
          when: Post('action').match(Condition.Equals('reset')),
          validate: false,
          onAlways: { next: [redirect({ goto: 'cleared' })] },
        }),
      ],
    }),
    step({ code: 'results', path: '/results', title: 'Results', blocks: [] }),
    step({ code: 'cleared', path: '/cleared', title: 'Cleared', blocks: [] }),
  ],
})

export const guardsJourney = journey({
  code: 'guards',
  path: '/guards',
  title: 'Guards',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'name' })],
      onSubmission: [
        submit({
          guards: Data('sessionValid').match(Condition.Equals(true)),
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const onValidEffectsJourney = journey({
  code: 'valid-effects',
  path: '/valid-effects',
  title: 'Valid Effects',
  onAccess: [access({ effects: [Effects.LoadAnswers('valid-effects')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [Effects.SaveAnswers('valid-effects')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dynamicErrorMessageJourney = journey({
  code: 'dynamic-error-msg',
  path: '/dynamic-error-msg',
  title: 'Dynamic Error Message',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'name' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [
              throwError({
                when: Data('errorDetail').match(Condition.IsRequired()),
                status: 500,
                message: Format('Save failed: %1', Data('errorDetail')),
              }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const headerSurvivesRedirectJourney = journey({
  code: 'header-redirect',
  path: '/header-redirect',
  title: 'Header Redirect',
  onAccess: [
    access({
      effects: [Effects.LoadData(), HooksEffects.SetHeader('X-Custom-Nav', 'from-access')],
      next: [redirect({ when: Data('shouldRedirect').match(Condition.Equals(true)), goto: 'target' })],
    }),
  ],
  steps: [
    step({
      path: '/start',
      title: 'Start',
      reachability: { entryWhen: true },
      blocks: [],
    }),
    step({ code: 'target', path: '/target', title: 'Target', blocks: [] }),
  ],
})
