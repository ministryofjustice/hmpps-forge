import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJInterruptionCard } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJInterruptionCard({
  heading: 'Before you continue',
  text: 'Check that the case details are correct before sending your request.',
  primaryAction: { text: 'Continue', href: '#continue' },
  secondaryAction: { text: 'Go back', href: '#back' },
})

const optionsExample = MOJInterruptionCard({
  heading: 'Check the reference number',
  html: '<p class="govuk-body">Your case reference is <strong>ABC123</strong>.</p>',
  primaryAction: { text: 'Continue', href: '#continue', style: 'link' },
  secondaryAction: { text: 'Go back', href: '#back', style: 'button' },
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'options-example': [liveDisplay([optionsExample])],
  },
})
