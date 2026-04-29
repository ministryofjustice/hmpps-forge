import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const requestStep = step({
  path: '/request',
  title: 'Request',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'References' },
  onAccess: [loadContent('request')],
  blocks: [content],
})
