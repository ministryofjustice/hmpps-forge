import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternsOverviewStep } from './overview/step'
import { singleQuestionPerPagePatternStep } from './single-question-per-page/step'
import { branchingPatternStep } from './branching/step'
import { revealFieldsPatternStep } from './reveal-fields/step'
import { compositeFieldsPatternStep } from './composite-fields/step'
import { resumingPatternStep } from './resuming/step'
import { addAnotherPatternStep } from './add-another/step'
import { taskListPatternStep } from './task-list/step'
import { patternDemosJourney } from './demos/journey'

export const patternsGuideJourney = journey({
  code: 'patterns',
  title: 'Patterns',
  path: '/patterns',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    patternsOverviewStep,
    singleQuestionPerPagePatternStep,
    branchingPatternStep,
    revealFieldsPatternStep,
    compositeFieldsPatternStep,
    resumingPatternStep,
    addAnotherPatternStep,
    taskListPatternStep,
  ],
  children: [patternDemosJourney],
})
