import { access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, pageInfo, stationList, pagination } from './blocks'

export const listStep = patternStep({
  code: 'list',
  path: '/list',
  title: 'Stations',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [PatternEffects.LoadStationPage()],
    }),
  ],
  blocks: [heading, pageInfo, stationList, pagination],
  sourceBase: 'pagination/demo/list',
  codeFiles: ['step.ts', 'blocks.ts'],
})
