import { submit, Post, Condition, tieBreaker } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import {
  heading,
  intro,
  shows,
  showsList,
  resumePanel,
  continueButton,
  startButton,
  scenariosHeading,
  seedPartialButton,
  seedCompleteButton,
  clearButton,
} from './blocks'

export const overviewStep = patternStep({
  path: '/overview',
  title: 'Resuming a partially-completed journey',
  reachability: {
    entryWhen: true,
    // Priority 100 ensures this page wins as the default landing page over
    // your-name (which is also an entry point for resume to evaluate from).
    tieBreakers: [tieBreaker({ priority: 100 })],
  },
  metadata: { hiddenFromNav: true },
  blocks: [
    heading,
    intro,
    shows,
    showsList,
    resumePanel,
    continueButton,
    startButton,
    scenariosHeading,
    seedPartialButton,
    seedCompleteButton,
    clearButton,
  ],
  // Demo aid: seed or clear saved answers so you can try different resume
  // states without filling in every form. Each button posts an action value
  // that triggers the matching handler below.
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('seed-partial')),
      validate: false,
      onAlways: {
        effects: [PatternEffects.SeedDraftAnswers('resuming', { fullName: 'Ada Lovelace' })],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('seed-complete')),
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.SeedDraftAnswers('resuming', {
            fullName: 'Ada Lovelace',
            role: 'Developer',
          }),
        ],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('clear')),
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.ClearAnswers('resuming'),
          PatternEffects.ClearDraftAnswers('resuming'),
        ],
      },
    }),
  ],
  sourceBase: 'resuming/demo',
  codeFiles: ['journey.ts', 'overview/step.ts', 'overview/blocks.ts'],
})
