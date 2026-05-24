export interface ForgeInstrumentationSink {
  initialize?(): void
  record(trace: unknown): void | Promise<void>
}

export interface ForgeHtmlRenderDebugBridge {
  getScriptUrl(): string | undefined
}

export interface ForgeHtmlRenderDebugSink extends ForgeInstrumentationSink {
  getHtmlRenderDebugBridge(): ForgeHtmlRenderDebugBridge | undefined
}

export interface ForgeJourneyRegisteredEvent {
  type: 'journey-registered'
  journeyCode: string
  journeyTitle: string
  routeCount: number
}

export interface ForgeRegistrationErrorEvent {
  type: 'registration-error'
  error: unknown
}

export type ForgeLifecycleEvent = ForgeJourneyRegisteredEvent | ForgeRegistrationErrorEvent
