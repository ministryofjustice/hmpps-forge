import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const cmsContentPatternStep = step({
  path: '/cms-content',
  title: 'CMS content',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Data and integrations' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-cms-content')],
    }),
  ],
  blocks: [content],
})
