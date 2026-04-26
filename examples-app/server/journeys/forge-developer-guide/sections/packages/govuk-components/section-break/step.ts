import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const sectionBreakStep = step({
  path: '/section-break',
  title: 'Section Break',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Wrappers' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-section-break')],
    }),
  ],
  blocks: [content],
})
