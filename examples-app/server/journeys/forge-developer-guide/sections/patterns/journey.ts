import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternsOverviewStep } from './overview/step'
import { singleQuestionPerPagePatternStep } from './single-question-per-page/step'
import { branchingPatternStep } from './branching/step'
import { revealFieldsPatternStep } from './reveal-fields/step'
import { compositeFieldsPatternStep } from './composite-fields/step'
import { resumingPatternStep } from './resuming/step'
import { addAnotherPatternStep } from './add-another/step'
import { taskListPatternStep } from './task-list/step'
import { loadReferenceDataPatternStep } from './load-reference-data/step'
import { preFillPatternStep } from './pre-fill/step'
import { repeatingFieldsetsPatternStep } from './repeating-fieldsets/step'
import { editAndReturnPatternStep } from './edit-and-return/step'
import { authRolePatternStep } from './auth-role/step'
import { readOnlyModePatternStep } from './read-only-mode/step'
import { searchAndSelectPatternStep } from './search-and-select/step'
import { paginationPatternStep } from './pagination/step'
import { inlineFunctionsPatternStep } from './inline-functions/step'
import { cmsContentPatternStep } from './cms-content/step'
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
    loadReferenceDataPatternStep,
    preFillPatternStep,
    repeatingFieldsetsPatternStep,
    editAndReturnPatternStep,
    authRolePatternStep,
    readOnlyModePatternStep,
    searchAndSelectPatternStep,
    paginationPatternStep,
    inlineFunctionsPatternStep,
    cmsContentPatternStep,
  ],
  children: [patternDemosJourney],
})
