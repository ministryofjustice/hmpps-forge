import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { singleQuestionPerPageDemoJourney } from '../single-question-per-page/demo/journey'
import { branchingDemoJourney } from '../branching/demo/journey'
import { revealFieldsDemoJourney } from '../reveal-fields/demo/journey'
import { compositeFieldsDemoJourney } from '../composite-fields/demo/journey'
import { resumingDemoJourney } from '../resuming/demo/journey'
import { addAnotherDemoJourney } from '../add-another/demo/journey'
import { taskListDemoJourney } from '../task-list/demo/journey'

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
  ],
})
