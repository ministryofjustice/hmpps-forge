import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { developerGuideJourney } from './journey'
import { GuideDeps, guideEffectRegistry } from './effects'
import { patternEffectRegistry } from './sections/patterns/effects'
import { patternTransformerRegistry } from './sections/patterns/functions'
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
  functions: [guideEffectRegistry, patternEffectRegistry, patternTransformerRegistry],
})
