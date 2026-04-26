import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { mojComponentsOverviewStep } from './overview/step'
import { alertStep } from './alert/step'
import { bannerStep } from './banner/step'
import { badgeStep } from './badge/step'
import { buttonMenuStep } from './button-menu/step'
import { cardStep } from './card/step'
import { cardGroupStep } from './card-group/step'
import { datePickerStep } from './date-picker/step'
import { filterStep } from './filter/step'
import { messagesStep } from './messages/step'
import { multiSelectStep } from './multi-select/step'
import { progressBarStep } from './progress-bar/step'
import { sideNavigationStep } from './side-navigation/step'
import { sortableTableStep } from './sortable-table/step'
import { subNavigationStep } from './sub-navigation/step'
import { ticketPanelStep } from './ticket-panel/step'
import { timelineStep } from './timeline/step'

export const mojComponentsJourney = journey({
  code: 'moj-components',
  title: 'MOJ Components',
  path: '/moj-components',
  metadata: { navGroup: 'Component Libraries' },
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    mojComponentsOverviewStep,
    alertStep,
    badgeStep,
    bannerStep,
    buttonMenuStep,
    cardStep,
    cardGroupStep,
    datePickerStep,
    filterStep,
    messagesStep,
    multiSelectStep,
    progressBarStep,
    sideNavigationStep,
    sortableTableStep,
    subNavigationStep,
    ticketPanelStep,
    timelineStep,
  ],
})
