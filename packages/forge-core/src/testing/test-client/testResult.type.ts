import type { CookieMutation } from '../../framework/types/response.type'
import type { RenderBlock, RenderContext } from '../../framework/types/rendering.type'
import type { ValidationResult } from '../../engine/concerns/validation/contracts/validationResult.type'
import type { ForgeError } from '../../framework/types/outcome.type'

/** Options for configuring a test request sent via {@link ForgeTestClient}. */
export interface TestRequestOptions {
  headers?: Record<string, string | string[]>
  cookies?: Record<string, string>
  params?: Record<string, string>
  query?: Record<string, string | string[]>
  body?: Record<string, unknown>
  session?: unknown
  state?: Record<string, unknown>
}

/** Result returned when the engine renders a step. */
export interface TestRenderResult {
  type: 'render'
  context: RenderContext
  /** Assembled renderer output. Present only when the client was created with a renderer. */
  output?: unknown
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

/** Result returned when the engine yields an error outcome. */
export type TestErrorResult = {
  type: 'error'
  error: ForgeError
  headers: Map<string, string>
  cookies: Map<string, CookieMutation>
}

/** Discriminated union returned by {@link ForgeTestClient.get} and {@link ForgeTestClient.post}. */
export type TestResult = TestRenderResult | TestRedirectResult | TestErrorResult
