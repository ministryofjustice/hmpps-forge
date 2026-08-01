import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Validating collections with iterators',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A plan has a list of goals loaded from an API. Each active goal
  must have at least one action before the plan can be agreed. The
  validWhen array uses Iterator.Filter and Iterator.Map to produce a
  separate error message per goal that is missing actions.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'An iterator chain as a validation condition: filter then count',
    'An iterate that yields validation() expressions for per-item error messages',
    'Mixing standard field validation with data-driven collection validation on the same field',
  ]),
  style: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/collection-validation/agree-plan',
  isStartButton: true,
})
