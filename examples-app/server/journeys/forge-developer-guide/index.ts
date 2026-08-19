import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { developerGuideJourney } from './journey'
import { GuideDeps } from './effects'
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
})
