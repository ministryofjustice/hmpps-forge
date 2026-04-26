import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const govukComponentsOverviewStep = step({
  path: '/overview',
  title: 'GOV.UK Components',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('govuk-components-package')],
  blocks: [content],
})
