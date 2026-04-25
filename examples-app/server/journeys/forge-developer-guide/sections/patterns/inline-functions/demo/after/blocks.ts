import { Data, Format } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKSummaryList,
  GovUKBody,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { PatternFunctions } from '../../../functions'

interface CaseGoal {
  title: string
  status: string
}

interface CaseCompliance {
  attended: number
  missed: number
}

const riskRow = (area: string, ref: ReturnType<typeof Data>) => ({
  key: { text: area },
  value: {
    html: ref.pipe(
      PatternFunctions.transformer('RiskLevelTag', () => (value: unknown) => {
        const config: Record<string, { text: string; colour: string }> = {
          VERY_HIGH: { text: 'Very high', colour: 'red' },
          HIGH: { text: 'High', colour: 'red' },
          MEDIUM: { text: 'Medium', colour: 'yellow' },
          LOW: { text: 'Low', colour: 'green' },
        }
        const { text, colour } = config[value as string] ?? { text: String(value), colour: 'grey' }

        return `<strong class="govuk-tag govuk-tag--${colour}">${text}</strong>`
      }),
    ),
  },
})

export const heading = GovUKHeading({
  text: Format('%1 %2', Data('case.name.firstName'), Data('case.name.lastName')),
  size: 'l',
  caption: Format('CRN: %1', Data('case.crn')),
})

export const riskHeading = GovUKHeading({ text: 'Risk scores', size: 'm' })

export const riskScores = GovUKSummaryList({
  rows: [
    riskRow('Overall', Data('case.riskScores.overall')),
    riskRow('Self-harm', Data('case.riskScores.selfHarm')),
    riskRow('Public protection', Data('case.riskScores.publicProtection')),
    riskRow('Known adult', Data('case.riskScores.knownAdult')),
    riskRow('Children', Data('case.riskScores.children')),
    riskRow('Staff', Data('case.riskScores.staff')),
  ],
})

export const sentenceHeading = GovUKHeading({ text: 'Sentence', size: 'm' })

export const sentenceDetails = GovUKSummaryList({
  rows: [
    { key: { text: 'Type' }, value: { text: Data('case.sentence.type') } },
    { key: { text: 'Start date' }, value: { text: Data('case.sentence.startDate') } },
    { key: { text: 'End date' }, value: { text: Data('case.sentence.endDate') } },
  ],
})

export const goalsHeading = GovUKHeading({ text: 'Goals', size: 'm' })

export const goalsSummary = GovUKBody({
  text: Data('case.goals').pipe(
    PatternFunctions.transformer('GoalsSummary', () => (value: unknown) => {
      const goals = value as CaseGoal[]
      const achieved = goals.filter(g => g.status === 'ACHIEVED').length

      return `${achieved} of ${goals.length} goals achieved`
    }),
  ),
  classes: 'govuk-!-font-weight-bold',
})

export const complianceHeading = GovUKHeading({ text: 'Compliance', size: 'm' })

export const complianceSummary = GovUKBody({
  text: Data('case.compliance').pipe(
    PatternFunctions.transformer('ComplianceSummary', () => (value: unknown) => {
      const { attended, missed } = value as CaseCompliance
      const total = attended + missed
      const rate = total > 0 ? Math.round((attended / total) * 100) : 0

      return `${rate}% attendance rate`
    }),
  ),
  classes: 'govuk-!-font-weight-bold',
})

export const backButton = GovUKLinkButton({
  text: 'Back to the verbose version',
  href: '/forge-developer-guide/patterns/demos/inline-functions/before',
  classes: 'govuk-button--secondary',
})
