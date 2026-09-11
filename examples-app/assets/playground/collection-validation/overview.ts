import { Literal, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKList, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Validating collections with iterators',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A plan has a list of goals loaded from an API. Each active goal
  must have at least one action before the plan can be agreed. The
  validWhen array uses Iterator.Filter and Iterator.Map to produce a
  separate error message per goal that is missing actions.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'Iterator.Some to check that at least one active goal exists',
    'An iterate that yields validation() expressions for per-item error messages',
    'Mixing standard field validation with data-driven collection validation on the same field',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/collection-validation/agree-plan',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Validating collections with iterators',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
