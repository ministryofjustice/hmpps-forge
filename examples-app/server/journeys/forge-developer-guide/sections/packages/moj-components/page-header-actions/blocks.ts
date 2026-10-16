import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJPageHeaderActions } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJPageHeaderActions({
  heading: { text: 'Cases', level: 2 },
  items: [{ text: 'Add case', href: '#add-case' }],
})

const optionsExample = MOJPageHeaderActions({
  heading: { text: 'Case documents', level: 2, classes: 'govuk-heading-l' },
  items: [
    { text: 'Upload document', href: '#upload', classes: 'govuk-button--secondary' },
    { text: 'Restricted action', href: '#restricted', visibleWhen: false },
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'options-example': [liveDisplay([optionsExample])],
  },
})
