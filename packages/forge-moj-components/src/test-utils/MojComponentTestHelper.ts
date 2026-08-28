import { createRequire } from 'node:module'

import type nunjucks from 'nunjucks'
import { vi } from 'vitest'
import type { Mocked } from 'vitest'

import { ComponentRegistryEntry } from '@ministryofjustice/hmpps-forge/core/components'

/**
 * Test helper for MOJ Frontend components
 *
 * Provides utilities for testing component data transformation and rendering.
 */
export class MojComponentTestHelper<TProps extends object> {
  private static readonly require = createRequire(import.meta.url)

  private mockNunjucksEnv: Mocked<nunjucks.Environment>

  constructor(private readonly component: ComponentRegistryEntry<TProps, string>) {
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
  getParams(props: Partial<TProps> = {}): Record<string, any> {
    const { context } = this.executeComponent(props)

    return (context as { params: Record<string, any> }).params
  }

  /**
   * Executes the component and returns the template and context passed to nunjucks
   */
  executeComponent(props: Partial<TProps> = {}) {
    this.render(props as TProps, this.mockNunjucksEnv)

    const lastCallIndex = this.mockNunjucksEnv.render.mock.calls.length - 1
    const [template, context] = this.mockNunjucksEnv.render.mock.calls[lastCallIndex]

    return { template, context }
  }

  /**
   * Renders the component with real nunjucks for DOM testing
   */
  renderWithNunjucks(props: Partial<TProps> = {}) {
    const nunjucksReal = MojComponentTestHelper.require('nunjucks') as typeof nunjucks
    const govukPath = MojComponentTestHelper.require
      .resolve('govuk-frontend/package.json')
      .replace('/package.json', '/dist/')
    const mojPath = MojComponentTestHelper.require
      .resolve('@ministryofjustice/frontend/package.json')
      .replace('/package.json', '/')
    const realEnv = nunjucksReal.configure([govukPath, mojPath])

    return this.render(props as TProps, realEnv)
  }

  /**
   * Reset mock between tests
   */
  resetMock() {
    this.mockNunjucksEnv.render.mockClear()
  }

  private render(props: TProps, nunjucksEnv: nunjucks.Environment): string {
    const rendered = this.component.render(props, nunjucksEnv)

    if (typeof rendered !== 'string') {
      throw new Error('MOJ component test helpers only support synchronous Nunjucks components')
    }

    return rendered
  }
}
