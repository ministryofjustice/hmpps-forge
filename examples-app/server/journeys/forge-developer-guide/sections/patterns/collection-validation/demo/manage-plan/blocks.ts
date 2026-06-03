import { Data, Format, Item, Iterator, Loop } from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKHeading,
  GovUKBody,
  GovUKTextInput,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Add actions to goals',
  size: 'l',
  caption: 'Collection validation demo',
})

export const intro = GovUKBody({
  text: 'Each active goal needs at least one action before the plan can be agreed. Add an action to each goal below.',
})

export const goalActions = CollectionBlock({
  collection: Data('activeGoals').each(
    Iterator.Map([
      GovUKHeading({ text: Item().path('title'), size: 's' }),
      GovUKTextInput({
        code: Format('action_%1', Loop.Index0()),
        label: { text: 'Action' },
        hint: { text: 'Describe what needs to happen to achieve this goal' },
      }),
    ]),
  ),
  fallback: [GovUKBody({ text: 'No active goals to manage.' })],
})

export const continueButton = GovUKButton({ text: 'Save and continue' })
