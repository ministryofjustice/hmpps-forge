export class LlmConversationNotFoundError extends Error {
  constructor(conversationId: string) {
    super(`LLM conversation was not found: ${conversationId}`)
    this.name = 'LlmConversationNotFoundError'
  }
}
