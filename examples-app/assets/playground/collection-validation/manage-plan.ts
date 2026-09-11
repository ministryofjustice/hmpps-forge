import {
  Data,
  Format,
  Iterator,
  Loop,
  submit,
  access,
  redirect,
  step,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKHeading, GovUKBody, GovUKTextInput, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { initializePlanActions, savePlanActions, saveDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Add actions to goals',
  size: 'l',
  caption: 'Collection validation demo',
})

const intro = GovUKBody({
  text: 'Each active goal needs at least one action before the plan can be agreed. Add an action to each goal below.',
})

const goalActions = CollectionBlock({
  collection: Data('activeGoals').each(
    Iterator.Map([
      GovUKHeading({ text: Loop.Item().path('title'), size: 's' }),
      GovUKTextInput({
        code: Format('action_%1', Loop.Index0()),
        label: { text: 'Action' },
        hint: { text: 'Describe what needs to happen to achieve this goal' },
      }),
    ]),
  ),
  fallback: [GovUKBody({ text: 'No active goals to manage.' })],
})

const continueButton = GovUKButton({ text: 'Save and continue' })

export const managePlanStep = step({
  code: 'manage-plan',
  path: '/manage-plan',
  title: 'Add actions to goals',
  reachability: { entryWhen: true },
  blocks: [heading, intro, goalActions, continueButton],
  onAccess: [
    access({
      effects: [initializePlanActions()],
    }),
  ],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          savePlanActions(),
          saveDraftAnswers(),
        ],
        next: [redirect({ goto: 'agree-plan' })],
      },
    }),
  ],
})
