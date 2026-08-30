import { access, journey, redirect, step, submit, throwError } from '../../../../src/authoring'
import { ContractEffects } from '../../contractHelpers'
import { StaticText, TextField } from '../../testComponents'

/** A two-step journey: GET renders the form, a valid POST redirects to `done`. */
export const formJourney = journey({
  code: 'trace-form',
  path: '/trace-form',
  title: 'Trace Form',
  steps: [
    step({
      code: 'form',
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'name' })],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'done' })] } })],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

/** The access hook halts every request with a 403 error outcome. */
export const accessErrorJourney = journey({
  code: 'access-error-trace',
  path: '/access-error-trace',
  title: 'Access Error Trace',
  onAccess: [access({ next: [throwError({ status: 403, message: 'No access' })] })],
  steps: [step({ code: 'form', path: '/form', title: 'Form', reachability: { entryWhen: true }, blocks: [] })],
})

const ExplodingEffect = ContractEffects.register('TraceExplode', {
  factory: () => () => {
    throw new Error('Access hook exploded')
  },
})

const ExplodingStatusEffect = ContractEffects.register('TraceExplodeStatus', {
  factory: () => () => {
    throw Object.assign(new Error('Access hook rejected'), { status: 418 })
  },
})

/** The access hook THROWS (rather than raising an error outcome), driving the emitFailed trace path. */
export const thrownErrorJourney = journey({
  code: 'thrown-error-trace',
  path: '/thrown-error-trace',
  title: 'Thrown Error Trace',
  onAccess: [access({ effects: [ExplodingEffect()] })],
  steps: [step({ code: 'form', path: '/form', title: 'Form', reachability: { entryWhen: true }, blocks: [] })],
})

/** Like `thrownErrorJourney`, but the thrown error carries a `status` property. */
export const thrownStatusJourney = journey({
  code: 'thrown-status-trace',
  path: '/thrown-status-trace',
  title: 'Thrown Status Trace',
  onAccess: [access({ effects: [ExplodingStatusEffect()] })],
  steps: [step({ code: 'form', path: '/form', title: 'Form', reachability: { entryWhen: true }, blocks: [] })],
})

/** One visible block and one statically hidden block, for the omit-from-trace contract. */
export const hiddenBlockJourney = journey({
  code: 'hidden-block-trace',
  path: '/hidden-block-trace',
  title: 'Hidden Block Trace',
  steps: [
    step({
      code: 'form',
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Visible' }), StaticText({ text: 'Hidden', visibleWhen: false })],
    }),
  ],
})

/** A submit hook authoring both onValid and onInvalid, so one branch is always unselected. */
export const branchedSubmitJourney = journey({
  code: 'branched-submit-trace',
  path: '/branched-submit-trace',
  title: 'Branched Submit Trace',
  steps: [
    step({
      code: 'form',
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'name' })],
      onSubmission: [
        submit({
          validate: true,
          onValid: { next: [redirect({ goto: 'done' })] },
          onInvalid: { next: [] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})
