import { BlockDefinition, ResolvableString, ResolvableObject } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseMojTextHtmlContent } from '../../utils/mojParamNormalisers'

/** Primary or secondary action on the interruption card. */
export interface MOJInterruptionCardAction {
  text: ResolvableString
  href?: ResolvableString
  style?: 'button' | 'link'
  attributes?: Record<string, ResolvableString>
}

/**
 * Pauses a journey with important information and actions.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/interruption-card/
 */
export interface MOJInterruptionCard extends BlockDefinition {
  heading: ResolvableString
  text?: ResolvableString
  html?: ResolvableString

  /** Child content takes precedence over text and html. */
  blocks?: BlockDefinition[]

  primaryAction: ResolvableObject<MOJInterruptionCardAction>
  secondaryAction?: ResolvableObject<MOJInterruptionCardAction>
}

/**
 * Pauses a journey with important information and actions.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/interruption-card/
 */
export const MOJInterruptionCard = nunjucksComponent<MOJInterruptionCard>('mojInterruptionCard', {
  render: (props, nunjucksEnv) => {
    const content = normaliseMojTextHtmlContent({ text: props.text, html: props.html, blocks: props.blocks })
    const params = {
      heading: props.heading,
      text: content.text,
      html: content.html,
      primaryAction: props.primaryAction,
      secondaryAction: props.secondaryAction,
    }

    return nunjucksEnv.render('components/interruption-card/template.njk', { params })
  },
})
