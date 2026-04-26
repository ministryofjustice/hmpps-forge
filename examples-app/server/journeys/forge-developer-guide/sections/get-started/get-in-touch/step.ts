import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const getInTouchStep = step({
  path: '/get-in-touch',
  title: 'Get in touch',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Resources' },
  onAccess: [loadContent('get-in-touch')],
  blocks: [content],
})
