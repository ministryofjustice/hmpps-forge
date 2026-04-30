import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKButtonGroup,
  GovUKButton,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKButtonGroup({
  buttons: [
    GovUKButton({ text: 'Save and continue', buttonType: 'button' }),
    GovUKLinkButton({ text: 'Cancel', href: '#', classes: 'govuk-button--secondary' }),
  ],
})

const primarySecondaryExample = GovUKButtonGroup({
  buttons: [
    GovUKButton({ text: 'Submit', buttonType: 'button' }),
    GovUKButton({
      text: 'Save as draft',
      buttonType: 'button',
      classes: 'govuk-button--secondary',
    }),
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/wrappers/govukButtonGroup.ts',
  names: ['GovUKButtonGroupProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'primary-secondary-example': [liveDisplay([primarySecondaryExample])],
  },
})
