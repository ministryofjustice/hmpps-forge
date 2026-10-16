import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJIdentityBar } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJIdentityBar({
  title: 'Alex Smith',
  menus: [{ items: [{ text: 'Edit details', href: '#edit-details' }] }],
})

const optionsExample = MOJIdentityBar({
  title: { html: '<strong>Alex Smith</strong> — Case ABC123' },
  menus: [
    {
      button: { text: 'Case actions' },
      items: [
        { text: 'View history', href: '#history' },
        { text: 'Restricted action', href: '#restricted', visibleWhen: false },
      ],
    },
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
