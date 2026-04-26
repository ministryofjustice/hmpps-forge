import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKPanel } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKPanel({
  titleText: 'Application complete',
  text: 'Your reference number is HDJ2123F',
})

const referenceExample = GovUKPanel({
  titleText: 'Application complete',
  html: 'Your reference number<br><strong>HDJ2123F</strong>',
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'reference-example': [liveDisplay([referenceExample])],
  },
})
