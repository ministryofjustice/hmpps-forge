import { createRequire } from 'node:module'

import type nunjucks from 'nunjucks'
import { vi } from 'vitest'
import type { Mocked } from 'vitest'

import { StructureType } from '@ministryofjustice/hmpps-forge/core/authoring'
import { BlockDefinition, EvaluatedBlock, ComponentRegistryEntry } from '@ministryofjustice/hmpps-forge/core/components'

import { NunjucksComponentRenderer } from '@ministryofjustice/hmpps-forge/express-nunjucks'

/**
 * Test helper for MOJ Frontend components
 *
 * Provides utilities for testing component data transformation and rendering.
 */
export class MojComponentTestHelper<T extends BlockDefinition> {
  private static readonly require = createRequire(import.meta.url)

  private readonly renderFn: NunjucksComponentRenderer<T>

  private mockNunjucksEnv: Mocked<nunjucks.Environment>

  constructor(component: ComponentRegistryEntry<T, string>) {
    this.renderFn = (block, nunjucksEnv) => {
      const rendered = component.render(block, nunjucksEnv)

      if (typeof rendered !== 'string') {
        throw new Error('MOJ component test helpers only support synchronous Nunjucks components')
      }

      return rendered
    }
    this.mockNunjucksEnv = {
      render: vi.fn().mockReturnValue('<div>Mocked HTML</div>'),
    } as unknown as Mocked<nunjucks.Environment>
  }

  /**
   * Gets the params object passed to MOJ templates
   *
   * MOJ templates expect params wrapped in a { params: ... } object.
   * This method extracts just the params for easy assertion.
   */
  getParams(props: Partial<EvaluatedBlock<T>> = {}): Record<string, any> {
    const { context } = this.executeComponent(props)

    return (context as { params: Record<string, any> }).params
  }

  /**
   * Executes the component and returns the template and context passed to nunjucks
   */
  executeComponent(props: Partial<EvaluatedBlock<T>> = {}) {
    const block: EvaluatedBlock<T> = {
      type: StructureType.BLOCK,
      ...props,
    } as EvaluatedBlock<T>

    this.renderFn(block, this.mockNunjucksEnv)

    const lastCallIndex = this.mockNunjucksEnv.render.mock.calls.length - 1
    const [template, context] = this.mockNunjucksEnv.render.mock.calls[lastCallIndex]

    return { template, context }
  }

  /**
   * Renders the component with real nunjucks for DOM testing
   */
  renderWithNunjucks(props: Partial<EvaluatedBlock<T>> = {}) {
    const nunjucksReal = MojComponentTestHelper.require('nunjucks') as typeof nunjucks
    const govukPath = MojComponentTestHelper.require
      .resolve('govuk-frontend/package.json')
      .replace('/package.json', '/dist/')
    const mojPath = MojComponentTestHelper.require
      .resolve('@ministryofjustice/frontend/package.json')
      .replace('/package.json', '/')
    const realEnv = nunjucksReal.configure([govukPath, mojPath])

    const block: EvaluatedBlock<T> = {
      type: StructureType.BLOCK,
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
