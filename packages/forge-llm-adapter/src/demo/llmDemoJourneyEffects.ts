import { effect } from '@ministryofjustice/hmpps-forge/core/authoring'

export const LoadLlmDemoAnswers = effect('LoadLlmDemoAnswers', {
  factory: () => context => {
    const session = context.getSession()

    if (!isRecord(session) || !isRecord(session.answers)) {
      return
    }

    Object.entries(session.answers).forEach(([code, value]) => {
      if (!context.hasAnswer(code)) {
        context.setAnswer(code, value)
      }
    })
  },
})

export const SaveLlmDemoAnswers = effect('SaveLlmDemoAnswers', {
  factory: () => context => {
    const session = context.getSession()

    if (!isRecord(session)) {
      return
    }

    const answers = {
      ...(isRecord(session.answers) ? session.answers : {}),
      ...context.getAllAnswers(),
    }

    context.getFieldsToClear().forEach(field => {
      delete answers[field]
    })

    session.answers = answers
  },
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
