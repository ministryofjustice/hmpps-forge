import { access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, details, description, backButton } from './blocks'

export const logStep = patternStep({
  code: 'station',
  path: '/station/:index',
  title: 'Station details',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [PatternEffects.LoadStation()],
    }),
  ],
  blocks: [heading, details, description, backButton],
  sourceBase: 'search-and-select/demo/log',
  codeFiles: ['step.ts', 'blocks.ts'],
})
