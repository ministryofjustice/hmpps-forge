import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const forgeBrowserDemoStep = step({
  path: '/demo',
  title: 'Live demo',
  onAccess: [loadContent('forge-browser-demo')],
  blocks: [content],
})
