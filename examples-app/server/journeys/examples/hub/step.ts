import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { heading, journeyCards } from './blocks'

export const hubStep = step({
  code: 'hub',
  path: '/',
  title: 'Example journeys',
  isEntryPoint: true,
  blocks: [heading, journeyCards],
})
