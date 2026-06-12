import type { CookieMutation } from '../framework/types/response.type'
import type { RenderBlock, RenderContext } from '../framework/rendering/types'
import type { ValidationResult } from '../engine/contracts/runtime/validationResult.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { ForgeOutcome } from '../framework/types/outcome.type'
import type { ForgeTopology } from '../framework/types/topology.type'
import type { EvaluateOptions } from '../engine/ForgeOrchestrator'

/**
 * The subset of the Forge engine that {@link ForgeTestClient} drives. The
 * outcome is `ForgeOutcome<unknown>` so any renderer binding works — the test
 * client asserts on the raw render context, never the rendered output.
 */
export interface ForgeEvaluationEngine {
  getTopology(): ForgeTopology
  evaluate(snapshot: RequestSnapshot, options?: EvaluateOptions): Promise<ForgeOutcome<unknown>>
}

/** Options for configuring a test request sent via {@link ForgeTestClient}. */
export interface TestRequestOptions {
  headers?: Record<string, string | string[]>
  cookies?: Record<string, string>
  params?: Record<string, string>
  query?: Record<string, string | string[]>
  body?: Record<string, string | string[]>
  session?: unknown
  state?: Record<string, unknown>
}

/** Result returned when the engine renders a step. */
export interface TestRenderResult {
  type: 'render'
  context: RenderContext
  headers: Map<string, string>
  cookies: Map<string, CookieMutation>
  getBlocksByVariant(variant: string): RenderBlock[]
  getValidationErrorsByFieldCode(fieldCode: string): ValidationResult[]
}

/** Result returned when the engine redirects (navigation, access denial, etc.). */
export type TestRedirectResult = {
  type: 'redirect'
  url: string
  headers: Map<string, string>
  cookies: Map<string, CookieMutation>
}

/**
 * Result returned when the engine yields an error outcome (unknown node,
 * unsupported method, or a lifecycle hook halting with an error). `status` is
 * the HTTP status a host adapter would respond with.
 */
export type TestErrorResult = {
  type: 'error'
  status: number
  message: string
  headers: Map<string, string>
  cookies: Map<string, CookieMutation>
}

/** Discriminated union returned by {@link ForgeTestClient.get} and {@link ForgeTestClient.post}. */
export type TestResult = TestRenderResult | TestRedirectResult | TestErrorResult
