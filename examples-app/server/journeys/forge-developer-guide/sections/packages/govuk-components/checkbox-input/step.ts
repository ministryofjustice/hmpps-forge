import {
  step,
  access,
  submit,
  Post,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content, EXAMPLE_GROUPS } from './blocks'

function exampleSubmit(group: string) {
  return submit({
    when: Post('action').match(Condition.Equals(group)),
    validate: { groups: [group] },
  })
}

export const checkboxInputStep = step({
  path: '/checkbox-input',
  title: 'Checkboxes',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-checkbox-input')],
    }),
  ],
  blocks: [content],
  onSubmission: [
    exampleSubmit(EXAMPLE_GROUPS.basic),
    exampleSubmit(EXAMPLE_GROUPS.exclusive),
    exampleSubmit(EXAMPLE_GROUPS.reveal),
    exampleSubmit(EXAMPLE_GROUPS.singleQuestion),
  ],
})
