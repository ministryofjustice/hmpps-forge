import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const utilityClassesStep = step({
  path: '/utility-classes',
  title: 'Classes',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Utilities' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-utility-classes')],
    }),
  ],
  blocks: [content],
})
