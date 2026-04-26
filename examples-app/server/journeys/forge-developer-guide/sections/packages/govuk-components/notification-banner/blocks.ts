import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKNotificationBanner } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = GovUKNotificationBanner({
  text: 'There may be a delay in processing your application. We apologise for any inconvenience.',
})

const successExample = GovUKNotificationBanner({
  bannerType: 'success',
  html: 'You have <a class="govuk-notification-banner__link" href="#">accepted the offer</a>.',
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'success-example': [liveDisplay([successExample])],
  },
})
