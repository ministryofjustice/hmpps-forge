import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const cmsContentPatternStep = step({
  path: '/cms-content',
  title: 'CMS content',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Data and integrations' },
  onAccess: [loadContent('patterns-cms-content')],
  blocks: [content],
})
