import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { govukComponentsOverviewStep } from './overview/step'
import { textInputStep } from './text-input/step'
import { textareaInputStep } from './textarea-input/step'
import { passwordInputStep } from './password-input/step'
import { radioInputStep } from './radio-input/step'
import { checkboxInputStep } from './checkbox-input/step'
import { selectInputStep } from './select-input/step'
import { dateInputStep } from './date-input/step'
import { buttonStep } from './button/step'
import { accordionStep } from './accordion/step'
import { backLinkStep } from './back-link/step'
import { breadcrumbsStep } from './breadcrumbs/step'
import { detailsStep } from './details/step'
import { exitThisPageStep } from './exit-this-page/step'
import { insetTextStep } from './inset-text/step'
import { notificationBannerStep } from './notification-banner/step'
import { paginationStep } from './pagination/step'
import { panelStep } from './panel/step'
import { summaryListStep } from './summary-list/step'
import { tableStep } from './table/step'
import { tabsStep } from './tabs/step'
import { tagStep } from './tag/step'
import { taskListStep } from './task-list/step'
import { warningTextStep } from './warning-text/step'
import { bodyStep } from './body/step'
import { headingStep } from './heading/step'
import { listStep } from './list/step'
import { sectionBreakStep } from './section-break/step'
import { gridRowStep } from './grid-row/step'
import { buttonGroupStep } from './button-group/step'
import { utilityClassesStep } from './utility-classes/step'
import { validationsStep } from './validations/step'

export const govukComponentsJourney = journey({
  code: 'govuk-components',
  title: 'GOV.UK Components',
  path: '/govuk-components',
  metadata: { navGroup: 'Component Libraries' },
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    govukComponentsOverviewStep,
    textInputStep,
    textareaInputStep,
    passwordInputStep,
    radioInputStep,
    checkboxInputStep,
    selectInputStep,
    dateInputStep,
    buttonStep,
    accordionStep,
    backLinkStep,
    breadcrumbsStep,
    detailsStep,
    exitThisPageStep,
    insetTextStep,
    notificationBannerStep,
    paginationStep,
    panelStep,
    summaryListStep,
    tableStep,
    tabsStep,
    tagStep,
    taskListStep,
    warningTextStep,
    bodyStep,
    headingStep,
    listStep,
    sectionBreakStep,
    gridRowStep,
    buttonGroupStep,
    utilityClassesStep,
    validationsStep,
  ],
})
