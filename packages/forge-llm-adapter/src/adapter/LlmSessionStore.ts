import type { LlmAnswerValue, LlmMessage } from '../conversation/LlmConversation'
import type { LlmQuestionOutput, LlmTurnOutput } from '../functions/renderers/turn/llmTurn'

export interface LlmRegisteredQuestion {
  readonly path: string
  readonly question: LlmQuestionOutput
}

/** Serialisable state retained between conversational turns. */
export interface LlmSession {
  readonly requestSession: Record<string, unknown>
  readonly messages: readonly LlmMessage[]
  readonly currentPath: string
  readonly currentTurn: LlmTurnOutput
  readonly presentedPaths: readonly string[]
  readonly registeredQuestions: readonly LlmRegisteredQuestion[]
  readonly recordedAnswers: Readonly<Record<string, LlmAnswerValue>>
  readonly answerRevisions: Readonly<Record<string, number>>
  readonly userMessageRevision: number
}

/** Persistence boundary implemented by the host application. */
export interface LlmSessionStore {
  get(conversationId: string): Promise<LlmSession | undefined>
  set(conversationId: string, session: LlmSession): Promise<void>
  delete(conversationId: string): Promise<void>
}
