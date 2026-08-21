import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { developerGuideJourney } from './journey'
import { GuideDeps } from './effects'

export default createForgePackage<GuideDeps>({
  journey: developerGuideJourney,
})
