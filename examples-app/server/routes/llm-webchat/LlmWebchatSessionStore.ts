import type {
  LlmAdapterResult,
  LlmSession,
  LlmSessionStore,
} from '@ministryofjustice/hmpps-forge/llm-adapter'

export interface LlmWebchatMessage {
  readonly id: string
  readonly text: string
  readonly html?: string
  readonly type: 'sent' | 'received'
  readonly sender: string
  readonly timestamp: string
}

export interface LlmWebchatSession {
  readonly conversationId: string
  adapterSession?: LlmSession
  readonly messages: LlmWebchatMessage[]
  status?: LlmAdapterResult['status']
  navigationUrl?: string
}

export interface LlmWebchatHostSession {
  llmWebchat?: LlmWebchatSession
}

/** Stores one adapter conversation inside the host application's web session. */
export class LlmWebchatSessionStore implements LlmSessionStore {
  constructor(private readonly hostSession: LlmWebchatHostSession) {}

  async get(conversationId: string): Promise<LlmSession | undefined> {
    const webchatSession = this.getMatchingSession(conversationId)

    return webchatSession?.adapterSession === undefined
      ? undefined
      : structuredClone(webchatSession.adapterSession)
  }

  async set(conversationId: string, session: LlmSession): Promise<void> {
    const webchatSession = this.getMatchingSession(conversationId)

    if (webchatSession === undefined) {
      throw new Error(`Cannot store unknown LLM webchat conversation: ${conversationId}`)
    }

    webchatSession.adapterSession = structuredClone(session)
  }

  async delete(conversationId: string): Promise<void> {
    const webchatSession = this.getMatchingSession(conversationId)

    if (webchatSession !== undefined) {
      delete webchatSession.adapterSession
    }
  }

  private getMatchingSession(conversationId: string): LlmWebchatSession | undefined {
    const webchatSession = this.hostSession.llmWebchat

    return webchatSession?.conversationId === conversationId ? webchatSession : undefined
  }
}
