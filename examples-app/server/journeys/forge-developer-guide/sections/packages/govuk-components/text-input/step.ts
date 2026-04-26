import { step, submit, Post, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content, EXAMPLE_GROUPS } from './blocks'

function exampleSubmit(group: string) {
  return submit({
    when: Post('action').match(Condition.Equals(group)),
    validate: { groups: [group] },
  })
}

export const textInputStep = step({
  path: '/text-input',
  title: 'Text Input',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [loadContent('govuk-text-input')],
  blocks: [content],
  onSubmission: [
    exampleSubmit(EXAMPLE_GROUPS.basic),
    exampleSubmit(EXAMPLE_GROUPS.singleQuestion),
    exampleSubmit(EXAMPLE_GROUPS.postcode),
    exampleSubmit(EXAMPLE_GROUPS.currency),
    exampleSubmit(EXAMPLE_GROUPS.reference),
  ],
})
