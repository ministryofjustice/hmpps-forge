import { joinPaths } from '../../../../framework/path/routePath'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'
import type { StepRequest } from '../../../../framework/types/request.type'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type { PipelineState } from '../types'

interface PipelineStateOptions {
  readonly params?: Record<string, string>
  readonly method?: string
  readonly baseUrl?: string
  readonly pathname?: string
}

export function createPipelineState(options: PipelineStateOptions = {}): PipelineState {
  const params = options.params ?? {}
  const baseUrl = options.baseUrl ?? '/forms/journey'
  const pathname = options.pathname ?? joinPaths(baseUrl, 'step')
  const method = options.method ?? 'GET'
  const request = {
    method,
    url: `http://localhost${pathname}`,
    baseUrl,
    location: {
      origin: 'http://localhost',
      href: `http://localhost${pathname}`,
      pathname,
      basePath: baseUrl,
    },
    getHeader: () => undefined,
    getAllHeaders: () => ({}),
    getCookie: () => undefined,
    getAllCookies: () => ({}),
    getParam: (name: string) => params[name],
    getParams: () => params,
    getQuery: () => undefined,
    getAllQuery: () => ({}),
    getPost: () => undefined,
    getAllPost: () => ({}),
    getSession: () => undefined,
    getState: () => undefined,
    getAllState: () => ({}),
  } as unknown as StepRequest
  const context = new RuntimeEvaluationContext(request)

  return { context, request, responseBindings: NO_OP_RESPONSE_BINDINGS }
}
