import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJDatePicker } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJDatePicker({
  code: 'appointmentDate',
  label: 'Appointment date',
  hint: 'For example, 17/5/2026',
})

const limitsExample = MOJDatePicker({
  code: 'visitDate',
  label: 'Visit date',
  hint: 'Choose a weekday in May 2026.',
  minDate: '01/05/2026',
  maxDate: '31/05/2026',
  excludedDays: ['saturday', 'sunday'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'limits-example': [liveDisplay([limitsExample])],
  },
})
