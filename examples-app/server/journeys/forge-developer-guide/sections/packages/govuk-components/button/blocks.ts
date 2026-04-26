import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKButton, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKButton({
  text: 'Continue',
  buttonType: 'button',
})

const linkExample = GovUKLinkButton({
  text: 'Start now',
  href: '#',
})

const secondaryExample = TemplateWrapper({
  template: '{{slot:content}}',
  slots: {
    content: [
      GovUKButton({
        text: 'Save as draft',
        buttonType: 'button',
        classes: 'govuk-button--secondary',
      }),
      GovUKLinkButton({ text: 'Cancel', href: '#', classes: 'govuk-button--secondary' }),
    ],
  },
})

const warningExample = GovUKButton({
  text: 'Delete account',
  buttonType: 'button',
  classes: 'govuk-button--warning',
})

const startExample = GovUKLinkButton({
  text: 'Start now',
  href: '#',
  isStartButton: true,
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'link-example': [liveDisplay([linkExample])],
    'secondary-example': [liveDisplay([secondaryExample])],
    'warning-example': [liveDisplay([warningExample])],
    'start-example': [liveDisplay([startExample])],
  },
})
