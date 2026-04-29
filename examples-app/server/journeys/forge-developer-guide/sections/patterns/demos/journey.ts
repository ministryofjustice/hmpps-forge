import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { singleQuestionPerPageDemoJourney } from '../single-question-per-page/demo/journey'
import { branchingDemoJourney } from '../branching/demo/journey'
import { revealFieldsDemoJourney } from '../reveal-fields/demo/journey'
import { compositeFieldsDemoJourney } from '../composite-fields/demo/journey'
import { resumingDemoJourney } from '../resuming/demo/journey'
import { addAnotherDemoJourney } from '../add-another/demo/journey'
import { taskListDemoJourney } from '../task-list/demo/journey'
import { loadReferenceDataDemoJourney } from '../load-reference-data/demo/journey'
import { preFillDemoJourney } from '../pre-fill/demo/journey'
import { repeatingFieldsetsDemoJourney } from '../repeating-fieldsets/demo/journey'
import { editAndReturnDemoJourney } from '../edit-and-return/demo/journey'
import { authRoleDemoJourney } from '../auth-role/demo/journey'
import { readOnlyModeDemoJourney } from '../read-only-mode/demo/journey'
import { searchAndSelectDemoJourney } from '../search-and-select/demo/journey'
import { paginationDemoJourney } from '../pagination/demo/journey'
import { inlineFunctionsDemoJourney } from '../inline-functions/demo/journey'
import { cmsContentDemoJourney } from '../cms-content/demo/journey'

export const patternDemosJourney = journey({
  code: 'pattern-demos',
  title: 'Pattern demos',
  path: '/demos',
  metadata: { hiddenFromNav: true },
  reachability: { disableReachabilityChecks: false },
  steps: [],
  children: [
    singleQuestionPerPageDemoJourney,
    branchingDemoJourney,
    revealFieldsDemoJourney,
    compositeFieldsDemoJourney,
    resumingDemoJourney,
    addAnotherDemoJourney,
    taskListDemoJourney,
    loadReferenceDataDemoJourney,
    preFillDemoJourney,
    repeatingFieldsetsDemoJourney,
    editAndReturnDemoJourney,
    authRoleDemoJourney,
    readOnlyModeDemoJourney,
    searchAndSelectDemoJourney,
    paginationDemoJourney,
    inlineFunctionsDemoJourney,
    cmsContentDemoJourney,
  ],
})
