import { vi } from 'vitest'
import type { AnswerHistory, AnswerSource } from '../../../contracts/runtime/answerHistory.type'
import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'
import type { ResponseBindings } from '../../../../../framework/types/responseBindings.type'

/** Extract a pathname from either an absolute URL or a relative request URL. */
function extractPathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    const [withoutHash] = url.split('#', 1)
    const [path] = withoutHash.split('?', 1)

    return path
  }
}

type MockAnswerInput = unknown | AnswerHistory

interface MockRequestData {
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

export interface MockContext {
  context: RuntimeContext
  response: ResponseBindings
}

export function createMockContext(options: MockContextOptions = {}): MockContext {
  const headers = options.mockRequest?.headers ?? {}
  const cookies = options.mockRequest?.cookies ?? {}
  const params = options.mockRequest?.params ?? {}
  const query = options.mockRequest?.query ?? {}
  const post = options.mockRequest?.post ?? {}
  const session = (options.mockRequest?.session ?? {}) as Record<string, unknown>
  const state = options.mockRequest?.state ?? {}
  const url = options.mockRequest?.url ?? 'http://localhost/mock-path'
  const method = options.mockRequest?.method ?? 'GET'

  const response: ResponseBindings = {
    setHeader: vi.fn(),
    setCookie: vi.fn(),
  }

  const context: RuntimeContext = {
    domain: {
      data: options.mockData ?? {},
      answers: toAnswerHistories(options.mockAnswers ?? {}),
    },
    evaluation: {},
    request: {
      url,
      path: extractPathname(url),
      method,
      location: {
        origin: new URL(url).origin,
        href: url,
        pathname: extractPathname(url),
        basePath: extractPathname(url),
      },
      headers,
      cookies,
      state,
      params,
      query,
      post,
      session,
    },
  }

  return { context, response }
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
