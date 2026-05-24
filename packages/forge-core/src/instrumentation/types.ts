import type { Logger } from '../framework/types/adapter.type'

export interface ForgeInstrumentationSinkDependencies {
  logger: Logger | Console
}

export interface ForgeInstrumentationSink {
  initialize?(dependencies: ForgeInstrumentationSinkDependencies): void
  record(trace: unknown): void | Promise<void>
}

export interface ForgeHtmlRenderDebugBridge {
  getScriptUrl(): string | undefined
}

export interface ForgeHtmlRenderDebugSink extends ForgeInstrumentationSink {
  getHtmlRenderDebugBridge(): ForgeHtmlRenderDebugBridge | undefined
}
