import { EffectEvaluationContext } from '../../nodes/expressions/effect/EffectFunctionContext'
import { AnswerHistory, AnswerSource } from '../../runtime/types/AnswerHistory.type'
import { extractPathname } from '../../../framework/path/routePath'
import type { StepRequest } from '../../../framework/types/request.type'
import type { CookieMutation, CookieOptions, StepResponse } from '../../../framework/types/response.type'

export type MockAnswerInput = unknown | AnswerHistory

export interface MockRequestData {
  method?: 'GET' | 'POST'
  url?: string
  session?: unknown
  state?: Record<string, unknown>
  headers?: Record<string, string | string[] | undefined>
  cookies?: Record<string, string | undefined>
  params?: Record<string, string>
  query?: Record<string, string | string[]>
  post?: Record<string, string | string[]>
}

export interface MockContextOptions {
  mockRequest?: MockRequestData
  mockData?: Record<string, unknown>
  mockAnswers?: Record<string, MockAnswerInput>
}

export function createMockContext(options: MockContextOptions = {}): EffectEvaluationContext {
  const headers = options.mockRequest?.headers ?? {}
  const cookies = options.mockRequest?.cookies ?? {}
  const params = options.mockRequest?.params ?? {}
  const query = options.mockRequest?.query ?? {}
  const post = options.mockRequest?.post ?? {}
  const session = options.mockRequest?.session
  const state = options.mockRequest?.state ?? {}
  const url = options.mockRequest?.url ?? 'http://localhost/mock-path'
  const responseHeaders = new Map<string, string>()
  const responseCookies = new Map<string, CookieMutation>()

  const request: StepRequest = {
    method: options.mockRequest?.method ?? 'GET',
    url,
    baseUrl: '/mock-base',
    location: {
      origin: 'http://localhost',
      href: url,
      pathname: extractPathname(url),
      basePath: '/mock-base',
    },
    getHeader: (name: string) => headers[name.toLowerCase()],
    getAllHeaders: () => headers,
    getCookie: (name: string) => cookies[name],
    getAllCookies: () => cookies,
    getParam: (name: string) => params[name],
    getParams: () => params,
    getQuery: (name: string) => query[name],
    getAllQuery: () => query,
    getPost: (name: string) => post[name],
    getAllPost: () => post,
    getSession: () => session,
    getState: (key: string) => state[key],
    getAllState: () => state,
  }

  const response: StepResponse = {
    setHeader: (name: string, value: string) => {
      responseHeaders.set(name, value)
    },
    getHeader: (name: string) => responseHeaders.get(name),
    getAllHeaders: () => responseHeaders,
    setCookie: (name: string, value: string, cookieOptions?: CookieOptions) => {
      responseCookies.set(name, { value, options: cookieOptions })
    },
    getCookie: (name: string) => responseCookies.get(name),
    getAllCookies: () => responseCookies,
  }

  return {
    request,
    response,
    global: {
      data: options.mockData ?? {},
      answers: toAnswerHistories(options.mockAnswers ?? {}),
    },
  }
}

function toAnswerHistories(answers: Record<string, MockAnswerInput>): Record<string, AnswerHistory> {
  return Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, toAnswerHistory(value)]))
}

function toAnswerHistory(input: MockAnswerInput, defaultSource: AnswerSource = 'access'): AnswerHistory {
  if (isAnswerHistory(input)) {
    return input
  }

  return { current: input, mutations: [{ value: input, source: defaultSource }] }
}

function isAnswerHistory(input: unknown): input is AnswerHistory {
  return typeof input === 'object' &&
    input !== undefined &&
    input !== null &&
    'current' in input &&
    'mutations' in input &&
    Array.isArray(input.mutations)
}
