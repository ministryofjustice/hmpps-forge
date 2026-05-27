import type { CookieMutation } from '../framework/types/response.type'
import type { Evaluated, RenderContext } from '../framework/rendering/types'
import type { HttpMethod } from '../framework/types/request.type'
import type { StepHandler } from '../framework/types/adapter.type'
import type { BlockASTNode } from '../engine/types/structures.type'
import type { ValidationResult } from '../engine/runtime/types/ValidationResult.type'

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
  getBlocksByVariant(variant: string): Evaluated<BlockASTNode>[]
  getValidationErrorsByFieldCode(fieldCode: string): ValidationResult[]
}

/** Result returned when the engine redirects (navigation, access denial, etc.). */
export type TestRedirectResult = {
  type: 'redirect'
  url: string
  headers: Map<string, string>
  cookies: Map<string, CookieMutation>
}

/** Discriminated union returned by {@link ForgeTestClient.get} and {@link ForgeTestClient.post}. */
export type TestResult = TestRenderResult | TestRedirectResult

export interface TestRequest {
  method: HttpMethod
  url: string
  baseUrl: string
  headers: Record<string, string | string[]>
  cookies: Record<string, string>
  params: Record<string, string>
  query: Record<string, string | string[]>
  body: Record<string, string | string[]>
  session: unknown
  state: Record<string, unknown>
}

export interface TestResponse {
  headers: Map<string, string>
  cookies: Map<string, CookieMutation>
  redirectUrl?: string
  renderContext?: RenderContext
}

export interface TestRouteHandler {
  handler: StepHandler<TestRequest, TestResponse>
}

export interface TestRoute {
  get?: TestRouteHandler
  post?: TestRouteHandler
}

export interface TestRouter {
  routes: Map<string, TestRoute>
  children: Map<string, TestRouter>
}
