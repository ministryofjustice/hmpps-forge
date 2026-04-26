import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const forgeClassStep = step({
  path: '/forge-class',
  title: 'Initialisation',
  reachability: { entryWhen: true },
  onAccess: [loadContent('forge-class')],
  blocks: [content],
})
