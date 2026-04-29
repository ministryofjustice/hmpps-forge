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
  nextButton,
} from './blocks'

export const beforeStep = patternStep({
  path: '/before',
  title: 'Before: inline expressions',
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
    nextButton,
  ],
  sourceBase: 'inline-functions/demo',
  codeFiles: ['before/blocks.ts'],
})
