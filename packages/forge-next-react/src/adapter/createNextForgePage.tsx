import type { ComponentType, ReactNode } from 'react'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import {
  ForgeActionForm,
  type ForgeActionFormProps,
  type NextForgeFormAction,
  type NextForgeFormState,
} from '@ministryofjustice/hmpps-forge/next-react/client'

import {
  ReactRenderer,
  type ReactPageRenderContext,
  type ReactPageRenderer,
  type ReactRendererOptions,
} from '../renderer/ReactRenderer'
import type { MaybePromise, NextForgeSessionStore, RouteParamValue } from './types'
import NextRequestFactory from './NextRequestFactory'
import NextForgePageFactory from './NextForgePageFactory'
import NextForgeActionFactory from './NextForgeActionFactory'
import { createFormState } from './nextReactFormState'

export interface NextForgePageProps {
  params?: MaybePromise<Record<string, RouteParamValue>>
  searchParams?: MaybePromise<Record<string, string | string[] | undefined>>
}

export type NextForgePageSubmitAction = NextForgeFormAction

export type NextForgeActionForm = ComponentType<ForgeActionFormProps>

/**
 * Options for {@link createNextForgePage}.
 *
 * `mountPath` must equal the page's public Next route path: without JavaScript,
 * the progressive-enhancement form POSTs there, and a server component cannot
 * read its own request URL. When `submit` is set the page renders the
 * action-state form and `content` is ignored.
 */
export interface NextForgePageOptions extends Omit<ReactRendererOptions, 'page'> {
  mountPath: string
  pathParam?: string
  origin?: string
  sessionStore?: NextForgeSessionStore
  content?: ReactPageRenderer
  submit?: NextForgePageSubmitAction
  actionForm?: NextForgeActionForm
}

export interface NextForgeActionOptions extends Omit<ReactRendererOptions, 'page'> {
  origin?: string
  sessionStore?: NextForgeSessionStore
}

/**
 * Build an async server component that renders a configured {@link Forge} step.
 *
 * Without `submit` the page renders `content` (defaulting to a plain form). With
 * `submit` it renders the action-state form wired to the server action, and
 * `content` is ignored.
 *
 * A server component cannot write response headers or cookies, so hook response
 * mutations and session-store cookie writes are dropped during a page render.
 */
export function createNextForgePage(forge: Forge, options: NextForgePageOptions) {
  const page = options.submit
    ? buildSubmitPage(options.submit, options.actionForm)
    : (options.content ?? renderDefaultContent)
  const renderer = new ReactRenderer({ rendererContext: options.rendererContext, page })
  const topology = forge.getTopology()
  const logger = forge.getLogger()

  return async function ForgePage(props: NextForgePageProps): Promise<ReactNode> {
    const request = await NextRequestFactory.buildPageRequest(props, options)

    return NextForgePageFactory.render(forge, topology, logger, renderer, options.sessionStore, request)
  }
}

/**
 * Build a server action that re-runs a {@link Forge} step submission and returns
 * the next form state (or redirects on navigation). Pair it with a page's
 * `submit` option so no-JavaScript submissions POST to the same `mountPath`.
 *
 * Cookies set by hooks or the session store persist through `next/headers`;
 * response headers cannot be set from an action and are dropped.
 */
export function createNextForgeAction(forge: Forge, options: NextForgeActionOptions = {}): NextForgePageSubmitAction {
  const renderer = new ReactRenderer({ rendererContext: options.rendererContext, page: ({ blocks }) => blocks })
  const topology = forge.getTopology()
  const logger = forge.getLogger()

  return async function submitForgePage(state: NextForgeFormState, formData: FormData): Promise<NextForgeFormState> {
    'use server'

    const request = await NextRequestFactory.buildActionRequest(state.path, formData, options)

    return NextForgeActionFactory.run(forge, topology, logger, renderer, options.sessionStore, request)
  }
}

function buildSubmitPage(submit: NextForgePageSubmitAction, actionForm?: NextForgeActionForm): ReactPageRenderer {
  return ({ context, blocks, action }: ReactPageRenderContext): ReactNode => {
    const ActionForm = actionForm ?? ForgeActionForm
    const path = typeof action === 'string' ? action : context.step.path

    return <ActionForm initialState={createFormState(path, context, blocks)} action={submit} />
  }
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
