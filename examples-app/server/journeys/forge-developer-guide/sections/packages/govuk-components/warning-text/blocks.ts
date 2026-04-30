import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKWarningText } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  HtmlBlock,
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

const basicExample = GovUKWarningText({
  text: 'You can be fined up to £5,000 if you do not register.',
})

const htmlExample = GovUKWarningText({
  html: 'You must <a class="govuk-link" href="#">complete your return</a> by 31 January.',
})

const blocksExample = GovUKWarningText({
  blocks: [HtmlBlock({ tag: 'span', content: 'You must confirm this action before continuing.' })],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/components/warning-text/govukWarningText.ts',
  names: ['GovUKWarningTextProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'html-example': [liveDisplay([htmlExample])],
    'blocks-example': [liveDisplay([blocksExample])],
  },
})
