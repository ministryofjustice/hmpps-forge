import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const forgeBrowserPatternBranchingStep = step({
  path: '/pattern-branching',
  title: 'Pattern in the browser: Branching',
  onAccess: [loadContent('forge-browser-pattern-branching')],
  blocks: [content],
})
