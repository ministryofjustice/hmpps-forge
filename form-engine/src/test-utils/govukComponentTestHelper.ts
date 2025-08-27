import { BlockDefinition, EvaluatedBlock } from '../form/types/structures.type'
import { ComponentTestHelper } from './componentTestHelper'

/**
 * GOV.UK specific component test helper
 */
export class GovukComponentTestHelper<T extends BlockDefinition> extends ComponentTestHelper<T> {
  /**
   * Gets the params object that's passed to GOV.UK templates
   * GOV.UK templates expect params to be wrapped in a { params: ... } object
   */
  async getParams(props: Partial<EvaluatedBlock<T>> = {}) {
    const { context } = await this.executeComponent(props)
    return (context as { params: any }).params
  }
}
