import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { developerGuideJourney } from './journey'
import { GuideDeps, GuideEffectsImplementations } from './effects'
import { govukMarkdown } from './components/govukMarkdown'
import { tableOfContentsComponent } from './components/tableOfContents'

export default createForgePackage<GuideDeps>({
  journey: developerGuideJourney,
  components: [govukMarkdown, tableOfContentsComponent],
  functions: {
    ...GuideEffectsImplementations,
  },
})
