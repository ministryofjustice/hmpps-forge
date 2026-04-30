import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'
import { MOJBanner } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'
import { SourceInterfaceSnippet } from '../../shared/sourceInterfaceSnippet'

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

const blocksExample = MOJBanner({
  bannerType: 'information',
  blocks: [
    GovUKBody({
      text: 'Review the case history before continuing.',
      classes: 'govuk-!-margin-bottom-0',
    }),
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/banner/mojBanner.ts',
  names: ['MOJBannerType', 'MOJBannerProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'types-example': [liveDisplay([typesExample])],
    'blocks-example': [liveDisplay([blocksExample])],
  },
})
