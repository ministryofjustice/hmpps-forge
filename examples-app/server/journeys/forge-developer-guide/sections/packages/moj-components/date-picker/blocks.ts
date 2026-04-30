import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJDatePicker } from '@ministryofjustice/hmpps-forge/moj-components'
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

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/date-picker/mojDatePicker.ts',
  names: [
    'MOJDatePickerLabel',
    'MOJDatePickerHint',
    'MOJDatePickerFormGroup',
    'MOJDatePickerProps',
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'limits-example': [liveDisplay([limitsExample])],
  },
})
