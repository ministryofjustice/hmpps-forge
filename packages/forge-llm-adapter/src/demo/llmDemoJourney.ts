import { access, createForgePackage, journey } from '@ministryofjustice/hmpps-forge/core/authoring'

import { LlmTurn } from '../functions/renderers/turn/llmTurn'
import { LoadLlmDemoAnswers } from './llmDemoJourneyEffects'
import { completeStep } from './steps/completeStep'
import { homeImprovementsStep } from './steps/homeImprovementsStep'
import { homeSearchStep } from './steps/homeSearchStep'
import { housingPrioritiesStep } from './steps/housingPrioritiesStep'
import { housingSituationStep } from './steps/housingSituationStep'
import { otherHousingStep } from './steps/otherHousingStep'
import { ownerDetailsStep } from './steps/ownerDetailsStep'
import { ownerPlansStep } from './steps/ownerPlansStep'
import { renterDetailsStep } from './steps/renterDetailsStep'
import { renterPlansStep } from './steps/renterPlansStep'
import { sharedHomeStep } from './steps/sharedHomeStep'
import { summaryStep } from './steps/summaryStep'

const journeyCode = 'llm-demo'

export const llmDemoJourney = journey({
  code: journeyCode,
  path: `/${journeyCode}`,
  title: 'Forge LLM adapter demo',
  renderer: LlmTurn(),
  onAccess: [access({ effects: [LoadLlmDemoAnswers()] })],
  steps: [
    housingSituationStep,
    ownerDetailsStep,
    ownerPlansStep,
    homeImprovementsStep,
    renterDetailsStep,
    renterPlansStep,
    homeSearchStep,
    sharedHomeStep,
    otherHousingStep,
    housingPrioritiesStep,
    summaryStep,
    completeStep,
  ],
})

export const llmDemoPackage = createForgePackage({ journey: llmDemoJourney })
