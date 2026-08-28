import { createRequire } from 'node:module'

import type nunjucks from 'nunjucks'
import { vi } from 'vitest'
import type { Mocked } from 'vitest'

import { ComponentCallType } from '@ministryofjustice/hmpps-forge/core/authoring'
import { BlockDefinition, ComponentRegistryEntry, EvaluatedBlock } from '@ministryofjustice/hmpps-forge/core/components'

import type { NunjucksComponentRenderer } from '../utils/nunjucksComponent'

/**
 * Test helper for GOV.UK Frontend components
 *
 * Provides utilities for testing component data transformation and rendering.
 */
export class GovukComponentTestHelper<T extends BlockDefinition> {
  private static readonly require = createRequire(import.meta.url)

  private readonly renderFn: NunjucksComponentRenderer<T>

  private mockNunjucksEnv: Mocked<nunjucks.Environment>

  constructor(component: ComponentRegistryEntry<T, string>) {
    this.renderFn = (block, nunjucksEnv) => {
      const rendered = component.render(block, nunjucksEnv)

      if (typeof rendered !== 'string') {
        throw new Error('GOV.UK component test helpers only support synchronous Nunjucks components')
      }

      return rendered
    }
    this.mockNunjucksEnv = {
      render: vi.fn().mockReturnValue('<div>Mocked HTML</div>'),
    } as unknown as Mocked<nunjucks.Environment>
  }

  /**
   * Gets the params object passed to GOV.UK templates
   *
   * GOV.UK templates expect params wrapped in a { params: ... } object.
   * This method extracts just the params for easy assertion.
   */
  async getParams(props: Partial<EvaluatedBlock<T>> = {}): Promise<Record<string, any>> {
    const { context } = await this.executeComponent(props)

    return (context as { params: Record<string, any> }).params
  }

  /**
   * Executes the component and returns the template and context passed to nunjucks
   */
  async executeComponent(props: Partial<EvaluatedBlock<T>> = {}) {
    const block: EvaluatedBlock<T> = {
      _forge: ComponentCallType.BASIC,
      ...props,
    } as EvaluatedBlock<T>

    await this.renderFn(block, this.mockNunjucksEnv)

    const lastCallIndex = this.mockNunjucksEnv.render.mock.calls.length - 1
    const [template, context] = this.mockNunjucksEnv.render.mock.calls[lastCallIndex]

    return { template, context }
  }

  /**
   * Renders the component with real nunjucks for DOM testing
   */
  async renderWithNunjucks(props: Partial<EvaluatedBlock<T>> = {}) {
    const nunjucksReal = GovukComponentTestHelper.require('nunjucks') as typeof nunjucks
    const govukPath = GovukComponentTestHelper.require
      .resolve('govuk-frontend/package.json')
      .replace('/package.json', '/dist/')
    const realEnv = nunjucksReal.configure([govukPath])

    const block: EvaluatedBlock<T> = {
      _forge: ComponentCallType.BASIC,
      ...props,
    } as EvaluatedBlock<T>

    return this.renderFn(block, realEnv)
  }

  /**
   * Reset mock between tests
   */
  resetMock() {
    this.mockNunjucksEnv.render.mockClear()
  }
}
