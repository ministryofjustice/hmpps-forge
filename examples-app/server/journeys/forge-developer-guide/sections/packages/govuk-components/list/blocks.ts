import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKBody, GovUKList } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  HtmlBlock,
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

const basicExample = GovUKList({
  items: ['Design', 'Build', 'Test', 'Deploy'],
  style: 'bullet',
})

const bulletExample = GovUKList({
  items: ['Design', 'Build', 'Test'],
  style: 'bullet',
})

const numberedExample = GovUKList({
  items: ['Check eligibility', 'Gather documents', 'Submit application'],
  style: 'number',
})

const blockItemsExample = GovUKList({
  items: [
    'A plain string item',
    GovUKBody({ text: 'A paragraph item' }),
    HtmlBlock({ tag: 'a', attributes: { href: '/help' }, content: 'A link item' }),
  ],
  style: 'bullet',
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'bullet-example': [liveDisplay([bulletExample])],
    'numbered-example': [liveDisplay([numberedExample])],
    'block-items-example': [liveDisplay([blockItemsExample])],
  },
})
