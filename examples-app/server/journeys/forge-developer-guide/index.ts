import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { developerGuideJourney } from './journey'
import { GuideDeps, GuideEffectsImplementations } from './effects'
import { PatternEffectsImplementations } from './sections/patterns/effects'
import { PatternFunctions } from './sections/patterns/functions'
import { govukMarkdown } from './components/govukMarkdown'
import { tableOfContentsComponent } from './components/tableOfContents'
import { lotteryBallComponent } from './components/lotteryBall'
import { richTextEditorComponent } from './components/richTextEditor'

export default createForgePackage<GuideDeps>({
  journey: developerGuideJourney,
  components: [
    govukMarkdown,
    tableOfContentsComponent,
    lotteryBallComponent,
    richTextEditorComponent,
  ],
  functions: {
    ...GuideEffectsImplementations,
    ...PatternEffectsImplementations,
    ...PatternFunctions.implementations,
  },
})
