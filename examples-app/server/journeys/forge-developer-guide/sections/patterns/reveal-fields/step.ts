import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const revealFieldsPatternStep = step({
  path: '/reveal-fields',
  title: 'Reveal fields',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Input and forms' },
  onAccess: [loadContent('patterns-reveal-fields')],
  blocks: [content],
})
