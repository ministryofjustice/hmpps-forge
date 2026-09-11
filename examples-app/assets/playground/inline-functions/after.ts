import {
  step,
  access,
  Data,
  Format,
  Literal,
  type Resolvable,
  transformer,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKSummaryList,
  GovUKBody,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { loadCaseOverview } from './effects'

interface CaseGoal {
  title: string
  status: string
}

interface CaseCompliance {
  attended: number
  missed: number
}

const heading = GovUKHeading({
  text: Format('%1 %2', Data('case.name.firstName'), Data('case.name.lastName')),
  size: 'l',
  caption: Format('CRN: %1', Data('case.crn')),
})

const riskHeading = GovUKHeading({ text: 'Risk scores', size: 'm' })

const riskRow = (area: string, riskLevel: Resolvable<string>) => ({
  key: { text: area },
  value: {
    html: Literal(riskLevel).pipe(
      transformer({ factory: () => (level: string) => {
        const tags: Partial<Record<string, { text: string; colour: string }>> = {
          VERY_HIGH: { text: 'Very high', colour: 'red' },
          HIGH: { text: 'High', colour: 'red' },
          MEDIUM: { text: 'Medium', colour: 'yellow' },
          LOW: { text: 'Low', colour: 'green' },
        }
        const { text, colour } = tags[level] ?? { text: 'Unknown', colour: 'grey' }

        return `<strong class="govuk-tag govuk-tag--${colour}">${text}</strong>`
      }})(),
    ),
  },
})

const riskScores = GovUKSummaryList({
  rows: [
    riskRow('Overall', Data('case.riskScores.overall')),
    riskRow('Self-harm', Data('case.riskScores.selfHarm')),
    riskRow('Public protection', Data('case.riskScores.publicProtection')),
    riskRow('Known adult', Data('case.riskScores.knownAdult')),
    riskRow('Children', Data('case.riskScores.children')),
    riskRow('Staff', Data('case.riskScores.staff')),
  ],
})

const sentenceHeading = GovUKHeading({ text: 'Sentence', size: 'm' })

const sentenceDetails = GovUKSummaryList({
  rows: [
    { key: { text: 'Type' }, value: { text: Data('case.sentence.type') } },
    { key: { text: 'Start date' }, value: { text: Data('case.sentence.startDate') } },
    { key: { text: 'End date' }, value: { text: Data('case.sentence.endDate') } },
  ],
})

const goalsHeading = GovUKHeading({ text: 'Goals', size: 'm' })

const goalsSummary = GovUKBody({
  text: Data('case.goals').pipe(
    transformer({ factory: () => (goals: CaseGoal[]) => {
      const achieved = goals.filter(goal => goal.status === 'ACHIEVED').length

      return `${achieved} of ${goals.length} goals achieved`
    }})(),
  ),
  classes: 'govuk-!-font-weight-bold',
})

const complianceHeading = GovUKHeading({ text: 'Compliance', size: 'm' })

const complianceSummary = GovUKBody({
  text: Data('case.compliance').pipe(
    transformer({ factory: () => ({ attended, missed }: CaseCompliance) => {
      const total = attended + missed
      const rate = total > 0 ? Math.round((attended / total) * 100) : 0

      return `${rate}% attendance rate`
    }})(),
  ),
  classes: 'govuk-!-font-weight-bold',
})

const backButton = GovUKLinkButton({
  text: 'Back to the verbose version',
  href: '/inline-functions/before',
  classes: 'govuk-button--secondary',
})

export const afterStep = step({
  path: '/after',
  title: 'After: inline transformers',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [loadCaseOverview()],
    }),
  ],
  blocks: [
    heading,
    riskHeading,
    riskScores,
    sentenceHeading,
    sentenceDetails,
    goalsHeading,
    goalsSummary,
    complianceHeading,
    complianceSummary,
    backButton,
  ],
})
