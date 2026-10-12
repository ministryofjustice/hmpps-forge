import { journey, step, access, submit, redirect, Answer, Condition } from '../../../../src/authoring'
import { Effects } from '../../contractHelpers'
import { TextField, RadioField } from '../../testComponents'

/**
 * Two steps where the second step's field depends on the first step's answer.
 * Changing `contactMethod` on the `choose` step has to reach `emailAddress`,
 * which only the `contact` step renders.
 */
export const crossStepDependentWhenJourney = journey({
  code: 'reconcile',
  path: '/reconcile',
  title: 'Cross-step dependentWhen',
  onAccess: [access({ effects: [Effects.LoadAnswers('reconcile')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      blocks: [
        RadioField({
          code: 'contactMethod',
          items: [
            { value: 'email', text: 'Email' },
            { value: 'post', text: 'Post' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('reconcile')],
            next: [redirect({ goto: 'contact' })],
          },
        }),
      ],
    }),
    step({
      code: 'contact',
      path: '/contact',
      title: 'Contact',
      blocks: [
        TextField({
          code: 'emailAddress',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('reconcile')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})
