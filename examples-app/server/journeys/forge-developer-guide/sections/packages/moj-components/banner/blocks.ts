import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJBanner } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJBanner({
  bannerType: 'success',
  text: 'Your application has been submitted.',
})

const typesExample = TemplateWrapper({
  template: '{{slot:success}}{{slot:warning}}{{slot:information}}',
  slots: {
    success: [MOJBanner({ bannerType: 'success', text: 'Visit request approved.' })],
    warning: [MOJBanner({ bannerType: 'warning', text: 'This person has alerts on NOMIS.' })],
    information: [MOJBanner({ bannerType: 'information', text: 'A case note was added today.' })],
  },
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'types-example': [liveDisplay([typesExample])],
  },
})
