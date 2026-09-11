import { submit, Post, Condition, tieBreaker, step, Answer, Literal, not } from '@ministryofjustice/hmpps-forge/core/authoring'
import { seedDraftAnswers, clearAnswers, clearDraftAnswers } from './effects'
import {
  GovUKHeading,
  GovUKBody,
  GovUKButton,
  GovUKList,
  GovUKInsetText,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

// The journey's loadDraftAnswers effect seeds any stored answers before the
// overview renders, so a single known answer tells us the user has saved
// progress to resume into.
const hasSavedProgress = Answer('fullName').match(Condition.IsRequired())

const heading = GovUKHeading({
  text: 'Resuming a partially-completed journey',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A service that lets users leave and come back later.
  When the user visits the journey root, Forge picks the step
  they still need to complete and redirects them there.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'A `resumeWhen` condition that triggers resume when the user returns with `?resume=true`',
    'Question steps that define where the user goes next after answering',
  ]),
  style: 'bullet',
})

const resumePanel = GovUKInsetText({
  text: `You have saved answers from a previous visit. Clicking
  continue takes you back to the journey with resume enabled,
  which redirects you to where you left off.`,
  visibleWhen: hasSavedProgress,
})

// Here we create a button that redirects to the journey, but with
// `?resume=true` added. This triggers our `resumeWhen` condition on the journey
// which is what enabled the resume redirect to trigger.
const continueButton = GovUKLinkButton({
  text: 'Continue where you left off',
  href: '/resuming?resume=true',
  visibleWhen: hasSavedProgress,
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/resuming/your-name',
  isStartButton: true,
  visibleWhen: not(hasSavedProgress),
})

const scenariosHeading = GovUKHeading({ text: 'Try different resume states', size: 's' })

const seedPartialButton = GovUKButton({
  text: 'Seed partial progress',
  name: 'action',
  value: 'seed-partial',
  classes: 'govuk-button--secondary',
})

const seedCompleteButton = GovUKButton({
  text: 'Seed complete progress',
  name: 'action',
  value: 'seed-complete',
  classes: 'govuk-button--secondary',
})

const clearButton = GovUKButton({
  text: 'Clear saved answers',
  name: 'action',
  value: 'clear',
  classes: 'govuk-button--warning',
})

export const overviewStep = step({
  path: '/overview',
  title: 'Resuming a partially-completed journey',
  reachability: {
    entryWhen: true,
    // Priority 100 ensures this page wins as the default landing page over
    // your-name (which is also an entry point for resume to evaluate from).
    tieBreakers: [tieBreaker({ priority: 100 })],
  },
  metadata: { hiddenFromNav: true },
  blocks: [
    heading,
    intro,
    shows,
    showsList,
    resumePanel,
    continueButton,
    startButton,
    scenariosHeading,
    seedPartialButton,
    seedCompleteButton,
    clearButton,
  ],
  // Demo aid: seed or clear saved answers so you can try different resume
  // states without filling in every form. Each button posts an action value
  // that triggers the matching handler below.
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('seed-partial')),
      validate: false,
      onAlways: {
        effects: [seedDraftAnswers({ fullName: 'Ada Lovelace' })],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('seed-complete')),
      validate: false,
      onAlways: {
        effects: [
          seedDraftAnswers({
            fullName: 'Ada Lovelace',
            role: 'Developer',
          }),
        ],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('clear')),
      validate: false,
      onAlways: {
        effects: [
          clearAnswers(),
          clearDraftAnswers(),
        ],
      },
    }),
  ],
})
