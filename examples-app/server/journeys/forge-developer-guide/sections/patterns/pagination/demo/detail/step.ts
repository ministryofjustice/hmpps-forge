import { access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, details, description, backButton } from './blocks'

export const detailStep = patternStep({
  code: 'detail',
  path: '/detail/:index',
  title: 'Station details',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [PatternEffects.LoadStation()],
    }),
  ],
  blocks: [heading, details, description, backButton],
  sourceBase: 'pagination/demo/detail',
  codeFiles: ['step.ts', 'blocks.ts'],
})
