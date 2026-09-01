import type { LlmWebchatSession } from '../../routes/llm-webchat/LlmWebchatSessionStore'

declare module 'express-session' {
  // Declare that the session will potentially contain these additional fields
  interface SessionData {
    returnTo: string
    llmWebchat?: LlmWebchatSession
  }
}

declare global {
  namespace Express {
    interface Request {
      id: string
    }
  }
}

export {}
