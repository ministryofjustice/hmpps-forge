import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJButtonMenu } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJButtonMenu({
  button: { text: 'Actions', classes: 'govuk-button--secondary' },
  items: [
    { text: 'Archive', href: '#archive' },
    { text: 'Reassign', href: '#reassign' },
    { text: 'Delete', href: '#delete', classes: 'govuk-button--warning' },
  ],
})

const alignedExample = MOJButtonMenu({
  button: { text: 'More actions', classes: 'govuk-button--secondary' },
  alignMenu: 'right',
  items: [
    { text: 'Print', href: '#print' },
    { text: 'Export', href: '#export' },
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'aligned-example': [liveDisplay([alignedExample])],
  },
})
