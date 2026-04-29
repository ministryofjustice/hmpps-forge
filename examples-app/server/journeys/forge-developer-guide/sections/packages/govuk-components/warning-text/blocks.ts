import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKWarningText } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKWarningText({
  text: 'You can be fined up to £5,000 if you do not register.',
})

const htmlExample = GovUKWarningText({
  html: 'You must <a class="govuk-link" href="#">complete your return</a> by 31 January.',
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'html-example': [liveDisplay([htmlExample])],
  },
})
