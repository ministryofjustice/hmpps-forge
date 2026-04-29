import { Answer, Condition, match, and, not } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKTaskList,
  GovUKBody,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

// Completion predicates for gating tasks and the submit button
const task1Done = Answer('yourDetailsStatus').match(Condition.Equals('completed'))
const task2Done = Answer('visitPreferencesStatus').match(Condition.Equals('completed'))
const task3Done = Answer('additionalNeedsStatus').match(Condition.Equals('completed'))
const prerequisitesMet = and(task1Done, task2Done)
const allComplete = and(prerequisitesMet, task3Done)

// Tag objects using GovUKUtilityClasses.Tag for colour constants
const lockedTag = { text: 'Cannot start yet', classes: GovUKUtilityClasses.Tag.Grey }
const notStartedTag = { text: 'Not yet started', classes: GovUKUtilityClasses.Tag.Grey }
const inProgressTag = { text: 'In progress', classes: GovUKUtilityClasses.Tag.Blue }
const completedTag = { text: 'Completed', classes: GovUKUtilityClasses.Tag.Green }

// Maps a status answer to a complete tag object (text + colour)
const statusTag = (code: string) =>
  match(Answer(code))
    .branch(Condition.Equals('completed'), completedTag)
    .branch(Condition.Equals('in-progress'), inProgressTag)
    .otherwise(notStartedTag)

export const heading = GovUKHeading({
  text: 'Book a prison visit',
  size: 'l',
})

export const intro = GovUKBody({
  text: 'Complete each section before submitting your application.',
})

export const taskList = GovUKTaskList({
  items: [
    // hrefs point into child journeys: journey-path/step-path
    {
      title: { text: 'Your details' },
      hint: { text: 'Your name and relationship to the prisoner' },
      href: 'your-details/your-name',
      status: { tag: statusTag('yourDetailsStatus') },
    },
    {
      title: { text: 'Visit preferences' },
      hint: { text: 'When you want to visit and the type of visit' },
      href: 'visit-preferences/preferred-day',
      status: { tag: statusTag('visitPreferencesStatus') },
    },
    // Dual items: unlocked (with href) and locked (no href) — only one visible at a time
    {
      title: { text: 'Additional needs' },
      hint: { text: 'Accessibility or other requirements' },
      href: 'additional-needs',
      visibleWhen: prerequisitesMet,
      status: { tag: statusTag('additionalNeedsStatus') },
    },
    {
      title: { text: 'Additional needs' },
      hint: { text: 'Accessibility or other requirements' },
      visibleWhen: not(prerequisitesMet),
      status: { tag: lockedTag },
    },
    {
      title: { text: 'Check and submit' },
      hint: { text: 'Review your answers and submit the application' },
      href: 'check-answers',
      visibleWhen: allComplete,
      status: { tag: notStartedTag },
    },
    {
      title: { text: 'Check and submit' },
      hint: { text: 'Review your answers and submit the application' },
      visibleWhen: not(allComplete),
      status: { tag: lockedTag },
    },
  ],
})
