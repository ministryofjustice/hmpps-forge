import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
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

const basicExample = GovUKBody({
  text: 'This is a paragraph of body text. Use it to add blocks of content to your pages.',
})

const sizesExample = TemplateWrapper({
  template: '{{slot:content}}',
  slots: {
    content: [
      GovUKBody({ text: 'Lead paragraph text at 24px.', size: 'l' }),
      GovUKBody({ text: 'Default body text at 19px.' }),
      GovUKBody({ text: 'Small body text at 16px.', size: 's' }),
    ],
  },
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/wrappers/govukBody.ts',
  names: ['BodySize', 'GovUKBodyProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'sizes-example': [liveDisplay([sizesExample])],
  },
})
