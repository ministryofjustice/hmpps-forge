import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { forgeBrowserOverviewStep } from './overview/step'
import { forgeBrowserDemoStep } from './demo/step'
import { forgeBrowserPatternBranchingStep } from './pattern-branching/step'
import { forgeBrowserPatternAddAnotherStep } from './pattern-add-another/step'

export const forgeBrowserJourney = journey({
  code: 'forge-browser',
  title: 'Browser Adapter',
  path: '/forge-browser',
  metadata: { navGroup: 'Frameworks' },
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    forgeBrowserOverviewStep,
    forgeBrowserDemoStep,
    forgeBrowserPatternBranchingStep,
    forgeBrowserPatternAddAnotherStep,
  ],
})
