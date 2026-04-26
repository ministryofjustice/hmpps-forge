import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKDetails } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKDetails({
  summaryText: 'Help with nationality',
  text: 'If you are not sure about your nationality, try to find out from an official document such as a passport or national ID card.',
})

const htmlExample = GovUKDetails({
  summaryText: 'Where to find your reference number',
  html: 'Your reference number is on the letter we sent you. It starts with <strong>HDJ</strong> followed by 4 numbers and a letter, for example <strong>HDJ2123F</strong>.',
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'html-example': [liveDisplay([htmlExample])],
  },
})
