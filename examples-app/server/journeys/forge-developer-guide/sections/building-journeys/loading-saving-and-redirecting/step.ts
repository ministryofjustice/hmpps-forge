import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const loadingSavingAndRedirectingStep = step({
  path: '/loading-saving-and-redirecting',
  title: 'Loading, saving and redirecting',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Working with data' },
  onAccess: [loadContent('loading-saving-and-redirecting')],
  blocks: [content],
})
