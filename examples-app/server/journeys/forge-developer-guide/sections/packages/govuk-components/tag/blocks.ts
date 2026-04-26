import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTag, GovUKTable } from '@ministryofjustice/hmpps-forge/govuk-components'
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

function tagHtml(text: string, cssClass: string) {
  return `<strong class="govuk-tag ${cssClass}">${text}</strong>`
}

const basicExample = GovUKTag({ text: 'Completed' })

const coloursExample = GovUKTable({
  head: [{ text: 'Tag' }, { text: 'Class' }],
  rows: [
    [
      { html: tagHtml('Completed', 'govuk-tag--green') },
      { html: '<code>GovUKUtilityClasses.Tag.Green</code>' },
    ],
    [
      { html: tagHtml('In progress', 'govuk-tag--blue') },
      { html: '<code>GovUKUtilityClasses.Tag.Blue</code>' },
    ],
    [
      { html: tagHtml('Not started', 'govuk-tag--grey') },
      { html: '<code>GovUKUtilityClasses.Tag.Grey</code>' },
    ],
    [
      { html: tagHtml('Overdue', 'govuk-tag--red') },
      { html: '<code>GovUKUtilityClasses.Tag.Red</code>' },
    ],
    [
      { html: tagHtml('Pending', 'govuk-tag--orange') },
      { html: '<code>GovUKUtilityClasses.Tag.Orange</code>' },
    ],
    [
      { html: tagHtml('New', 'govuk-tag--yellow') },
      { html: '<code>GovUKUtilityClasses.Tag.Yellow</code>' },
    ],
    [
      { html: tagHtml('Draft', 'govuk-tag--purple') },
      { html: '<code>GovUKUtilityClasses.Tag.Purple</code>' },
    ],
    [
      { html: tagHtml('Active', 'govuk-tag--teal') },
      { html: '<code>GovUKUtilityClasses.Tag.Teal</code>' },
    ],
    [
      { html: tagHtml('Urgent', 'govuk-tag--magenta') },
      { html: '<code>GovUKUtilityClasses.Tag.Magenta</code>' },
    ],
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'colours-example': [liveDisplay([coloursExample])],
  },
})
