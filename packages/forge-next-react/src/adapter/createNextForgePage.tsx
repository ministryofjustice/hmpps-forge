import type { ComponentType, ReactNode } from 'react'
import { headers as nextHeaders } from 'next/headers'
import { ForgeRuntime } from '@ministryofjustice/hmpps-forge/core'
import type { Forge, TraceObserver } from '@ministryofjustice/hmpps-forge/core'
import { extractPathname, joinPaths } from '@ministryofjustice/hmpps-forge/core/framework'
import {
  type ForgeActionFormProps,
  type NextForgeFormAction,
  type NextForgeFormState,
} from '@ministryofjustice/hmpps-forge/next-react/client'

import { normalizeParams, type NextForgeSessionStore, type RouteParamValue } from './forgeRequest'
import {
  FORGE_REACT_ACTION,
  ReactRenderer,
  type ReactPageRenderContext,
  type ReactPageRenderer,
  type ReactRendererOptions,
} from '../renderer/ReactRenderer'
import NextPageReactAdapterConfig from './NextPageReactAdapterConfig'
import NextActionReactAdapterConfig from './NextActionReactAdapterConfig'
import type NextReactAdapterInput from './NextReactAdapterInput.type'

type SearchParamValue = string | string[] | undefined

export interface NextForgePageProps {
  params?: Promise<Record<string, RouteParamValue>> | Record<string, RouteParamValue>
  searchParams?: Promise<Record<string, SearchParamValue>> | Record<string, SearchParamValue>
}

export type NextForgePageSubmitAction = NextForgeFormAction

export type NextForgeActionForm = ComponentType<ForgeActionFormProps>

export interface NextForgePageOptions extends Omit<ReactRendererOptions, 'page'> {
  mountPath: string
  pathParam?: string
  origin?: string
  sessionStore?: NextForgeSessionStore
  content?: ReactPageRenderer
  submit?: NextForgePageSubmitAction
  actionForm?: NextForgeActionForm
  traceObserver?: TraceObserver
}

export interface NextForgeActionOptions extends Omit<ReactRendererOptions, 'page'> {
  origin?: string
  sessionStore?: NextForgeSessionStore
  traceObserver?: TraceObserver
}

export function createNextForgePage(forge: Forge, options: NextForgePageOptions) {
  const logger = forge.getLogger()
  const runtime = ForgeRuntime.create(forge)
  const renderer = new ReactRenderer({ ...options, page: options.content ?? renderDefaultContent })
  const adapterConfig = new NextPageReactAdapterConfig(
    renderer,
    { submit: options.submit, actionForm: options.actionForm },
    { sessionStore: options.sessionStore },
  )

  return async function ForgePage(props: NextForgePageProps): Promise<ReactNode> {
    const request = await createPageRequest(props, options)
    const requestPath = extractPathname(request.url)

    logger.debug(`GET request to Forge page at path ${requestPath}`)

    const input: NextReactAdapterInput = {
      method: 'GET',
      request,
      state: {
        [FORGE_REACT_ACTION]: requestPath,
      },
    }

    return runtime.execute(input, adapterConfig, { traceObserver: options.traceObserver })
  }
}

export function createNextForgeAction(forge: Forge, options: NextForgeActionOptions = {}): NextForgePageSubmitAction {
  const logger = forge.getLogger()
  const runtime = ForgeRuntime.create(forge)
  const adapterConfig = new NextActionReactAdapterConfig(new ReactRenderer(options), {
    sessionStore: options.sessionStore,
  })

  return async function submitForgePage(state: NextForgeFormState, formData: FormData): Promise<NextForgeFormState> {
    'use server'

    const request = await createActionRequest(state.path, formData, options)
    const requestPath = extractPathname(request.url)

    logger.debug(`POST request to Forge page action at path ${requestPath}`)

    const input: NextReactAdapterInput = {
      method: 'POST',
      request,
      state: {
        [FORGE_REACT_ACTION]: requestPath,
      },
    }

    return runtime.execute(input, adapterConfig, { traceObserver: options.traceObserver })
  }
}

async function createPageRequest(props: NextForgePageProps, options: NextForgePageOptions): Promise<Request> {
  const [params, searchParams, headers] = await Promise.all([
    resolveParams(props.params),
    resolveSearchParams(props.searchParams),
    getRequestHeaders(),
  ])
  const pathname = createPathname(options.mountPath, params, options.pathParam ?? 'forgePath')
  const url = new URL(pathname, options.origin ?? inferOrigin(headers))

  toUrlSearchParams(searchParams).forEach((value, key) => {
    url.searchParams.append(key, value)
  })

  return new Request(url, {
    method: 'GET',
    headers,
  })
}

async function createActionRequest(
  path: string,
  formData: FormData,
  options: NextForgeActionOptions,
): Promise<Request> {
  const headers = await getRequestHeaders()
  const url = new URL(path, options.origin ?? inferOrigin(headers))

  return new Request(url, {
    method: 'POST',
    headers,
    body: formData,
  })
}

function renderDefaultContent({ context, blocks, action }: ReactPageRenderContext): ReactNode {
  const title = context.step.title ?? 'Forge'

  return <main>
    <h1>{title}</h1>
    <form method="post" action={action}>
      {blocks}
    </form>
  </main>
}

async function resolveParams(params: NextForgePageProps['params']): Promise<Record<string, RouteParamValue>> {
  return params ?? {}
}

async function resolveSearchParams(
  searchParams: NextForgePageProps['searchParams'],
): Promise<Record<string, SearchParamValue>> {
  return searchParams ?? {}
}

async function getRequestHeaders(): Promise<Headers> {
  const readonlyHeaders = await nextHeaders()
  const headers = new Headers()

  readonlyHeaders.forEach((value, key) => {
    headers.set(key, value)
  })

  return headers
}

function createPathname(mountPath: string, params: Record<string, RouteParamValue>, pathParam: string): string {
  const normalizedParams = normalizeParams(params)
  const forgePath = normalizedParams[pathParam]

  return forgePath ? joinPaths(mountPath, forgePath) : joinPaths(mountPath)
}

function toUrlSearchParams(searchParams: Record<string, SearchParamValue>): URLSearchParams {
  const result = new URLSearchParams()

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => result.append(key, item))

      return
    }

    result.set(key, value)
  })

  return result
}

function inferOrigin(headers: { get(_name: string): string | null }): string {
  const host = firstHeaderValue(headers.get('x-forwarded-host')) ?? firstHeaderValue(headers.get('host')) ?? 'localhost'
  const protocol = firstHeaderValue(headers.get('x-forwarded-proto')) ?? 'http'

  return `${protocol}://${host}`
}

function firstHeaderValue(value: string | null): string | undefined {
  return value?.split(',')[0]?.trim() || undefined
}
