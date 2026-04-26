import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const breadcrumbsStep = step({
  path: '/breadcrumbs',
  title: 'Breadcrumbs',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-breadcrumbs')],
    }),
  ],
  blocks: [content],
})
