import { Answer, Condition, Literal, not } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKButton,
  GovUKList,
  GovUKInsetText,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

// The journey's LoadAnswers effect seeds any stored answers before the
// overview renders, so a single known answer tells us the user has saved
// progress to resume into.
const hasSavedProgress = Answer('fullName').match(Condition.IsRequired())

export const heading = GovUKHeading({
  text: 'Resuming a partially-completed journey',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A service that lets users leave and come back later.
  When the user visits the journey root, Forge picks the step
  they still need to complete and redirects them there.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A `resumeWhen` condition that triggers resume when the user returns with `?resume=true`',
    'Question steps that define where the user goes next after answering',
  ]),
  style: 'bullet',
})

export const resumePanel = GovUKInsetText({
  text: `You have saved answers from a previous visit. Clicking
  continue takes you back to the journey with resume enabled,
  which redirects you to where you left off.`,
  visibleWhen: hasSavedProgress,
})

// Here we create a button that redirects to the journey, but with
// `?resume=true` added. This triggers our `resumeWhen` condition on the journey
// which is what enabled the resume redirect to trigger.
export const continueButton = GovUKLinkButton({
  text: 'Continue where you left off',
  href: '/forge-developer-guide/patterns/demos/resuming?resume=true',
  visibleWhen: hasSavedProgress,
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/resuming/your-name',
  isStartButton: true,
  visibleWhen: not(hasSavedProgress),
})

export const scenariosHeading = GovUKHeading({ text: 'Try different resume states', size: 's' })

export const seedPartialButton = GovUKButton({
  text: 'Seed partial progress',
  name: 'action',
  value: 'seed-partial',
  classes: 'govuk-button--secondary',
})

export const seedCompleteButton = GovUKButton({
  text: 'Seed complete progress',
  name: 'action',
  value: 'seed-complete',
  classes: 'govuk-button--secondary',
})

export const clearButton = GovUKButton({
  text: 'Clear saved answers',
  name: 'action',
  value: 'clear',
  classes: 'govuk-button--warning',
})
