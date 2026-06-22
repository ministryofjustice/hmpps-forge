import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { redirect } from 'next/navigation'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import {
  block,
  Condition,
  journey,
  redirect as forgeRedirect,
  Self,
  step,
  submit,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import type { BasicBlockProps, BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import type { NextForgeFormState } from '@ministryofjustice/hmpps-forge/next-react/client'

import { createNextForgeAction, createNextForgePage, type NextForgeActionForm } from './createNextForgePage'
import { buildReactComponent } from '../renderer/ReactRenderer'
import { SimpleSubmitButton, SimpleText, SimpleTextInput, simpleReactComponents } from '../components/simpleComponents'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`redirect:${url}`)
  }),
  notFound: vi.fn((): never => {
    throw new Error('not-found')
  }),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Console

function createForge(): Forge {
  const simpleJourney = journey({
    code: 'demo',
    path: '/demo',
    title: 'Demo journey',
    reachability: { disableReachabilityChecks: true },
    steps: [
      step({
        code: 'start',
        path: '/start',
        title: 'Start',
        blocks: [SimpleText({ text: 'Hello from a Next page' }), SimpleSubmitButton({ text: 'Continue' })],
        onSubmission: [
          submit({
            onAlways: {
              next: [forgeRedirect({ goto: 'done' })],
            },
          }),
        ],
      }),
      step({
        code: 'done',
        path: '/done',
        title: 'Done',
        blocks: [SimpleText({ text: 'Finished' })],
      }),
    ],
  })

  return new Forge({ logger: silentLogger, basePath: '/forms' })
    .registerGlobalComponents(simpleReactComponents)
    .registerPackage({ journey: simpleJourney })
}

function createValidatingForge(): Forge {
  const simpleJourney = journey({
    code: 'demo',
    path: '/demo',
    title: 'Demo journey',
    reachability: { disableReachabilityChecks: true },
    steps: [
      step({
        code: 'start',
        path: '/start',
        title: 'Start',
        blocks: [
          SimpleTextInput({
            code: 'name',
            label: 'Name',
            validWhen: [
              validation({
                condition: Self().match(Condition.IsRequired()),
                message: 'Enter your name',
              }),
            ],
          }),
          SimpleSubmitButton({ text: 'Continue' }),
        ],
        onSubmission: [
          submit({
            validate: true,
            onValid: {
              next: [forgeRedirect({ goto: 'done' })],
            },
          }),
        ],
      }),
      step({
        code: 'done',
        path: '/done',
        title: 'Done',
        blocks: [SimpleText({ text: 'Finished' })],
      }),
    ],
  })

  return new Forge({ logger: silentLogger, basePath: '/forms' })
    .registerGlobalComponents(simpleReactComponents)
    .registerPackage({ journey: simpleJourney })
}

function createInitialState(path: string): NextForgeFormState {
  return {
    path,
    title: 'Start',
    blocks: [],
  }
}

describe('createNextForgePage', () => {
  it('should render Forge content for a Next page without html or body wrappers', async () => {
    // Arrange
    const forge = createForge()
    const Page = createNextForgePage(forge, {
      mountPath: '/forms',
      origin: 'http://localhost',
    })

    // Act
    const node = await Page({ params: { forgePath: ['demo', 'start'] } })
    const html = renderToStaticMarkup(node)

    // Assert
    expect(html).toContain('<main>')
    expect(html).not.toContain('<html')
    expect(html).not.toContain('<body')
    expect(html).toContain('<h1>Start</h1>')
    expect(html).toContain('<form action="/forms/demo/start" method="post">')
    expect(html).toContain('<p>Hello from a Next page</p>')
  })

  it('should call redirect from next/navigation when Forge navigates during page render', async () => {
    // Arrange
    const forge = createForge()
    const Page = createNextForgePage(forge, {
      mountPath: '/forms',
      origin: 'http://localhost',
    })

    // Act & Assert
    await expect(Page({ params: { forgePath: ['demo'] } })).rejects.toThrow('redirect:/forms/demo/start')
    expect(redirect).toHaveBeenCalledWith('/forms/demo/start')
  })

  it('should call redirect from next/navigation when a server action navigates', async () => {
    // Arrange
    const forge = createForge()
    const action = createNextForgeAction(forge, {
      origin: 'http://localhost',
    })
    const formData = new FormData()

    // Act & Assert
    await expect(action(createInitialState('/forms/demo/start'), formData)).rejects.toThrow('redirect:/forms/demo/done')
    expect(redirect).toHaveBeenCalledWith('/forms/demo/done')
  })

  it('should return rendered Forge state when a server action hits validation errors', async () => {
    // Arrange
    const forge = createValidatingForge()
    const action = createNextForgeAction(forge, {
      origin: 'http://localhost',
    })
    const formData = new FormData()

    // Act
    const state = await action(createInitialState('/forms/demo/start'), formData)
    const html = renderToStaticMarkup(state.blocks)

    // Assert
    expect(state.path).toBe('/forms/demo/start')
    expect(state.title).toBe('Start')
    expect(html).toContain('Enter your name')
    expect(html).toContain('aria-invalid="true"')
  })

  it('should render an action-state form when a submit action is provided', async () => {
    // Arrange
    const forge = createValidatingForge()
    const action = createNextForgeAction(forge, {
      origin: 'http://localhost',
    })
    const ActionForm: NextForgeActionForm = ({ initialState }) => <section data-path={initialState.path}>{initialState.blocks}</section>
    const Page = createNextForgePage(forge, {
      mountPath: '/forms',
      origin: 'http://localhost',
      submit: action,
      actionForm: ActionForm,
    })

    // Act
    const node = await Page({ params: { forgePath: ['demo', 'start'] } })
    const html = renderToStaticMarkup(node)

    // Assert
    expect(html).toContain('<section data-path="/forms/demo/start">')
    expect(html).toContain('<label for="name">Name</label>')
  })

  it('should reject components that render non-serializable props when used with server actions', async () => {
    // Arrange
    interface ClickableBlock extends BlockDefinition, BasicBlockProps {
      variant: 'clickable'
    }

    const clickableComponent = buildReactComponent<ClickableBlock>('clickable', () => (
      <button onClick={() => {}}>Click</button>
    ))

    const clickableJourney = journey({
      code: 'demo',
      path: '/demo',
      title: 'Demo',
      reachability: { disableReachabilityChecks: true },
      steps: [
        step({
          code: 'start',
          path: '/start',
          title: 'Start',
          blocks: [block<ClickableBlock>({ variant: 'clickable' })],
        }),
      ],
    })

    const forge = new Forge({ logger: silentLogger, basePath: '/forms' })
      .registerGlobalComponent(clickableComponent)
      .registerPackage({ journey: clickableJourney })

    const action = createNextForgeAction(forge, { origin: 'http://localhost' })
    const Page = createNextForgePage(forge, {
      mountPath: '/forms',
      origin: 'http://localhost',
      submit: action,
    })

    // Act & Assert
    await expect(Page({ params: { forgePath: ['demo', 'start'] } })).rejects.toThrow(
      'A Forge component rendered <button> with a function prop "onClick"',
    )
  })
})
