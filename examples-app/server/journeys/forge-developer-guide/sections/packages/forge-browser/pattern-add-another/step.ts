import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const forgeBrowserPatternAddAnotherStep = step({
  path: '/pattern-add-another',
  title: 'Pattern in the browser: Add another',
  onAccess: [loadContent('forge-browser-pattern-add-another')],
  blocks: [content],
})
