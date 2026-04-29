import { access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import {
  heading,
  riskHeading,
  riskScores,
  sentenceHeading,
  sentenceDetails,
  goalsHeading,
  goalsSummary,
  complianceHeading,
  complianceSummary,
  backButton,
} from './blocks'

export const afterStep = patternStep({
  path: '/after',
  title: 'After: inline transformers',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [PatternEffects.LoadCaseOverview()],
    }),
  ],
  blocks: [
    heading,
    riskHeading,
    riskScores,
    sentenceHeading,
    sentenceDetails,
    goalsHeading,
    goalsSummary,
    complianceHeading,
    complianceSummary,
    backButton,
  ],
  sourceBase: 'inline-functions/demo',
  codeFiles: ['after/blocks.ts'],
})
