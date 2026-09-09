import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { forgeGuideV2Journey } from './journey'
import { GuideV2Deps, guideV2EffectRegistry } from './effects'
import { TableOfContents } from '../forge-developer-guide/components/tableOfContents'

export default createForgePackage<GuideV2Deps>({
  journey: forgeGuideV2Journey,
  components: [TableOfContents],
  functions: [guideV2EffectRegistry],
})
