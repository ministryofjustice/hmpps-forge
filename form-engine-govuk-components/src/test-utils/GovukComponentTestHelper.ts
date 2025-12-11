import type nunjucks from 'nunjucks'

import { BlockDefinition, EvaluatedBlock } from '@form-engine/form/types/structures.type'
import { StructureType } from '@form-engine/form/types/enums'
import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

import { NunjucksComponentRenderer } from '../internal/buildNunjucksComponent'

/**
 * Test helper for GOV.UK Frontend components
 *
 * Provides utilities for testing component data transformation and rendering.
 */
export class GovukComponentTestHelper<T extends BlockDefinition> {
  private readonly renderFn: NunjucksComponentRenderer<T>

  private mockNunjucksEnv: jest.Mocked<nunjucks.Environment>

  constructor(component: ComponentRegistryEntry<T>) {
    this.renderFn = (block, nunjucksEnv) => component.render(block, nunjucksEnv)
    this.mockNunjucksEnv = {
      render: jest.fn().mockReturnValue('<div>Mocked HTML</div>'),
    } as unknown as jest.Mocked<nunjucks.Environment>
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
      type: StructureType.BLOCK,
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
    const nunjucksReal = jest.requireActual('nunjucks') as typeof nunjucks
    const realEnv = nunjucksReal.configure(['node_modules/govuk-frontend/dist/'])

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
