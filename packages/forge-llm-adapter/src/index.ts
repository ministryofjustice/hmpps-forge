/**
 * Framework-neutral conversational adapter for Forge journeys.
 *
 * Hosts provide a configured Forge instance, an LLM supplier and a session
 * store. HTTP routes, cookies, Redis clients and presentation remain host
 * concerns.
 */

export { LlmAdapter } from './adapter/LlmAdapter'
export type {
  LlmAdapterOptions,
  LlmAdapterResult,
  LlmAwaitingInputResult,
  LlmCompleteResult,
  LlmEndRequest,
  LlmNavigateResult,
  LlmRespondRequest,
  LlmStartRequest,
} from './adapter/LlmAdapter'
export { LlmConversationAlreadyExistsError } from './adapter/LlmConversationAlreadyExistsError'
export { LlmConversationNotFoundError } from './adapter/LlmConversationNotFoundError'
export { LlmRenderer } from './adapter/LlmRenderer'
export type { LlmRegisteredQuestion, LlmSession, LlmSessionStore } from './adapter/LlmSessionStore'

export { LlmConversation } from './conversation/LlmConversation'
export type {
  LlmAnswerAmendment,
  LlmAnswerValue,
  LlmClarifyTurnRequest,
  LlmInteraction,
  LlmMessage,
  LlmPriorAnswer,
  LlmProposedAnswers,
  LlmResolveTurnRequest,
  LlmSupplier,
  LlmTurnResolution,
} from './conversation/LlmConversation'

export { LlmContent } from './functions/components/content/llmContent'
export type {
  LlmContent as LlmContentProps,
  LlmContentItem,
  LlmContentOutput,
} from './functions/components/content/llmContent'
export { LlmDate } from './functions/components/date/llmDate'
export type { LlmDate as LlmDateProps, LlmDateOutput } from './functions/components/date/llmDate'
export { LlmFreeText } from './functions/components/free-text/llmFreeText'
export type { LlmFreeText as LlmFreeTextProps, LlmFreeTextOutput } from './functions/components/free-text/llmFreeText'
export { LlmMultiSelect } from './functions/components/multi-select/llmMultiSelect'
export type {
  LlmMultiSelect as LlmMultiSelectProps,
  LlmMultiSelectOption,
  LlmMultiSelectOutput,
} from './functions/components/multi-select/llmMultiSelect'
export { LlmSingleSelect } from './functions/components/single-select/llmSingleSelect'
export type {
  LlmSingleSelect as LlmSingleSelectProps,
  LlmSingleSelectOption,
  LlmSingleSelectOutput,
} from './functions/components/single-select/llmSingleSelect'
export { LlmTurn } from './functions/renderers/turn/llmTurn'
export type {
  LlmComponentOutput,
  LlmQuestionOutput,
  LlmTurnBlocks,
  LlmTurnOutput,
} from './functions/renderers/turn/llmTurn'

export { OpenAISupplier } from './suppliers/openai/OpenAISupplier'
export type {
  OpenAIReasoningEffort,
  OpenAIResponsesClient,
  OpenAISupplierOptions,
} from './suppliers/openai/OpenAISupplier'
export { OpenAIWebSocketResponsesClient } from './suppliers/openai/OpenAIWebSocketResponsesClient'
export type {
  OpenAIResponsesWebSocket,
  OpenAIWebSocketResponsesClientOptions,
} from './suppliers/openai/OpenAIWebSocketResponsesClient'
