export class LlmConversationAlreadyExistsError extends Error {
  constructor(conversationId: string) {
    super(`LLM conversation already exists: ${conversationId}`)
    this.name = 'LlmConversationAlreadyExistsError'
  }
}
