import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { developerGuideJourney } from './journey'
import { GuideDeps, GuideEffectsImplementations } from './effects'
import { PatternEffectsImplementations } from './sections/patterns/effects'
import { govukMarkdown } from './components/govukMarkdown'
import { tableOfContentsComponent } from './components/tableOfContents'
import { lotteryBallComponent } from './components/lotteryBall'

export default createForgePackage<GuideDeps>({
  journey: developerGuideJourney,
  components: [govukMarkdown, tableOfContentsComponent, lotteryBallComponent],
  functions: {
    ...GuideEffectsImplementations,
    ...PatternEffectsImplementations,
  },
})
