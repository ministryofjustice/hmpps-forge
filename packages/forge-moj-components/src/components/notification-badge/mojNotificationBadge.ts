import { BlockDefinition, ResolvableString, ResolvableNumber } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Displays a count of new or unread items. Zero counts are hidden by MOJ Frontend.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/notification-badge/
 */
export interface MOJNotificationBadge extends BlockDefinition {
  /** Count to display. Values of 99 or more display as 99+. */
  text: ResolvableString | ResolvableNumber

  /** Description announced after the count, such as unread messages. */
  visuallyHiddenText?: ResolvableString

  /** Additional CSS classes. */
  classes?: ResolvableString

  /** Additional HTML attributes. */
  attributes?: Record<string, ResolvableString>
}

/**
 * Displays a count of new or unread items. Zero counts are hidden by MOJ Frontend.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/notification-badge/
 */
export const MOJNotificationBadge = nunjucksComponent<MOJNotificationBadge>('mojNotificationBadge', {
  render: (props, nunjucksEnv) => {
    const params = {
      text: props.text,
      visuallyHiddenText: props.visuallyHiddenText,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('moj/components/notification-badge/template.njk', { params })
  },
})
