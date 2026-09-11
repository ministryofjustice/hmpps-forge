import { effect, type EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'

const caseOverviewData = {
  name: { firstName: 'Sam', lastName: 'Jones' },
  crn: 'X123456',
  tier: 'A1',
  status: 'ACTIVE',
  riskScores: {
    overall: 'HIGH',
    selfHarm: 'LOW',
    publicProtection: 'VERY_HIGH',
    knownAdult: 'MEDIUM',
    children: 'LOW',
    staff: 'LOW',
  },
  sentence: {
    type: 'Community Order',
    startDate: '15 January 2025',
    endDate: '14 January 2027',
    requirements: ['40 hours unpaid work', 'Rehabilitation Activity Requirement'],
  },
  goals: [
    { title: 'Find stable accommodation', status: 'ACHIEVED' },
    { title: 'Enrol in education programme', status: 'IN_PROGRESS' },
    { title: 'Attend substance misuse sessions', status: 'IN_PROGRESS' },
    { title: 'Complete unpaid work hours', status: 'NOT_STARTED' },
    { title: 'Secure part-time employment', status: 'NOT_STARTED' },
  ],
  compliance: {
    attended: 8,
    missed: 1,
    acceptableAbsences: 1,
    warningLetters: 0,
  },
}

export const loadCaseOverview = effect('LoadCaseOverview', {
  factory: () => (context: EffectFunctionContext) => {
    context.setData('case', caseOverviewData)

    const { goals } = caseOverviewData
    const achieved = goals.filter(g => g.status === 'ACHIEVED').length

    context.setData('goalsAchieved', achieved)
    context.setData('goalsTotal', goals.length)

    const { attended, missed } = caseOverviewData.compliance
    const total = attended + missed
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0

    context.setData('complianceRate', rate)
  },
})
