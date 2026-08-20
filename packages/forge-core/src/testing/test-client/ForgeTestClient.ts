import type { HttpMethod } from '../../framework/types/request.type'
import type { ResponseBindings } from '../../framework/types/responseBindings.type'
import type { CookieMutation } from '../../framework/types/response.type'
import type { ForgeOutcome } from '../../framework/types/outcome.type'
import type { ForgeRenderer } from '../../framework/types/rendering.type'
import type { ForgeTopology } from '../../framework/types/topology.type'
import type { ForgeExecutionRequest } from '../../engine/Forge'
import TestRouteResolver from './TestRouteResolver'
import TestSnapshotFactory from './TestSnapshotFactory'
import type { TestRequestOptions, TestResult } from './testResult.type'

interface TestClientForge {
  getTopology(): ForgeTopology
  execute(request: ForgeExecutionRequest): Promise<ForgeOutcome<unknown>>
}

export class ForgeTestClient {
  private capturedHeaders = new Map<string, string>()

  private capturedCookies = new Map<string, CookieMutation>()

  constructor(
    private readonly forge: TestClientForge,
    private readonly renderer?: ForgeRenderer<unknown>,
  ) {}

  async get(path: string, options?: TestRequestOptions): Promise<TestResult> {
    return this.dispatch('GET', path, options)
  }

  async post(path: string, options?: TestRequestOptions): Promise<TestResult> {
    return this.dispatch('POST', path, options)
  }

  private async dispatch(method: HttpMethod, path: string, options?: TestRequestOptions): Promise<TestResult> {
    const resolved = TestRouteResolver.resolve(path, method, this.forge.getTopology())
    const responseBindings = this.createResponseBindings()
    const snapshot = TestSnapshotFactory.create(method, path, resolved, options)
    const outcome = await this.forge.execute({ snapshot, responseBindings, renderer: this.renderer })

    return this.buildResult(outcome)
  }

  private createResponseBindings(): ResponseBindings {
    this.capturedHeaders = new Map()
    this.capturedCookies = new Map()

    return {
      setHeader: (name, value) => {
        this.capturedHeaders.set(name, value)
      },
      setCookie: (name, value, cookieOptions) => {
        this.capturedCookies.set(name, { value, options: cookieOptions })
      },
    }
  }

  private buildResult(outcome: ForgeOutcome<unknown>): TestResult {
    const headers = new Map(this.capturedHeaders)
    const cookies = new Map(this.capturedCookies)

    if (outcome.kind === 'navigate') {
      return { type: 'redirect', url: outcome.url, headers, cookies }
    }

    if (outcome.kind === 'error') {
      return { type: 'error', error: outcome.error, headers, cookies }
    }

    const { context } = outcome

    return {
      type: 'render',
      context,
      output: outcome.output,
      headers,
      cookies,
      getBlocksByVariant: (variant: string) => context.blocks.filter(b => b.variant === variant),
      getValidationErrorsByFieldCode: (fieldCode: string) =>
        context.fieldValidationErrors.filter(e => e.blockCode === fieldCode),
    }
  }
}
