import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { getStartedOverviewStep } from './overview/step'
import { whyUseForgeStep } from './why-use-forge/step'
import { installingForgeStep } from './installing-forge/step'
import { installFrontendLibrariesStep } from './install-frontend-libraries/step'
import { usingForgeInYourAppStep } from './using-forge-in-your-app/step'
import { usingForgeWithExpressAndNunjucksStep } from './using-forge-with-express-and-nunjucks/step'
import { creatingYourFirstJourneyStep } from './creating-your-first-journey/step'
import { faqStep } from './faq/step'
import { getInTouchStep } from './get-in-touch/step'

export const getStartedJourney = journey({
  code: 'get-started',
  title: 'Get started',
  path: '/get-started',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    getStartedOverviewStep,
    whyUseForgeStep,
    installingForgeStep,
    installFrontendLibrariesStep,
    usingForgeInYourAppStep,
    usingForgeWithExpressAndNunjucksStep,
    creatingYourFirstJourneyStep,
    faqStep,
    getInTouchStep,
  ],
})
