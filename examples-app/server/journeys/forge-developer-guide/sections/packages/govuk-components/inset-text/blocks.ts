import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKInsetText } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKInsetText({
  text: 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
})

const htmlExample = GovUKInsetText({
  html: 'You can <a class="govuk-link" href="#">appeal the decision</a> if you think it is wrong.',
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'html-example': [liveDisplay([htmlExample])],
  },
})
