import nunjucks from 'nunjucks'
import { RegistryComponent } from '@form-engine/registry/utils/buildComponent'
import { BlockDefinition, EvaluatedBlock } from '../form/types/structures.type'
import { StructureType } from '../form/types/enums'

export class ComponentTestHelper<T extends BlockDefinition> {
  protected componentFn: RegistryComponent<T>['spec']['render']

  protected defaultProps: Omit<EvaluatedBlock<T>, 'type'>

  protected mockRender: jest.MockedFunction<typeof nunjucks.render>

  constructor(component: RegistryComponent<T>) {
    this.componentFn = component.spec.render
    this.mockRender = nunjucks.render as jest.MockedFunction<typeof nunjucks.render>
  }

  /**
   * Executes the component and returns the template and context passed to nunjucks
   */
  async executeComponent(props: Partial<EvaluatedBlock<T>> = {}) {
    const block: EvaluatedBlock<T> = {
      type: StructureType.BLOCK,
      ...this.defaultProps,
      ...props,
    } as EvaluatedBlock<T>

    await this.componentFn(block)
    const lastCallIndex = this.mockRender.mock.calls.length - 1
    const [template, context] = this.mockRender.mock.calls[lastCallIndex]
    return { template, context }
  }

  /**
   * Renders the component with real nunjucks for DOM testing
   */
  async renderWithNunjucks(props: Partial<EvaluatedBlock<T>> = {}) {
    this.mockRender.mockRestore()
    const nunjucksReal = jest.requireActual('nunjucks') as typeof nunjucks

    const env = nunjucksReal.configure(['node_modules/govuk-frontend/dist/'])

    const block: EvaluatedBlock<T> = {
      type: StructureType.BLOCK,
      ...this.defaultProps,
      ...props,
    } as EvaluatedBlock<T>

    this.mockRender.mockImplementationOnce((template: string, context: any) => {
      return env.render(template, context)
    })

    return this.componentFn(block)
  }

  /**
   * Gets just the params that would be passed to the template
   */
  async getParams(props: Partial<EvaluatedBlock<T>> = {}) {
    const { context } = await this.executeComponent(props)
    return context
  }
}

/**
 * Standard beforeEach setup for component tests
 */
export const setupComponentTest = () => {
  const mockRender = nunjucks.render as jest.MockedFunction<typeof nunjucks.render>

  beforeEach(() => {
    jest.clearAllMocks()
    mockRender.mockReturnValue('<div>Mocked HTML</div>' as any)
  })

  return mockRender
}
