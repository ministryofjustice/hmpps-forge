import { ASTNodeType } from '../../../../types/enums'
import { StepASTNode, StepReachabilityAST } from '../../../../types/structures.type'
import InvalidNodeError from '../../../../errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '../../../id-generators/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import type { StepDefinition } from '../../../../../authoring/types/structures.type'
import { isExpression, isTieBreaker } from '../../../../../authoring/typeguards/expressions'

/**
 * StepFactory: Creates Step AST nodes
 *
 * Step represents a single page within a journey, containing blocks and hooks.
 */
export default class StepFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  /**
   * Transform Step node: Single page within a journey
   * Contains blocks and hooks for user interaction
   */
  create(json: StepDefinition): StepASTNode {
    const { type, ...dataProperties } = json

    const properties: StepASTNode['properties'] = {
      path: json.path,
      title: json.title,
    }

    if (dataProperties.path === undefined) {
      throw new InvalidNodeError({
        message: 'Step requires a path property',
        node: json,
        expected: 'path property',
        actual: 'undefined',
      })
    }

    if (dataProperties.title === undefined) {
      throw new InvalidNodeError({
        message: 'Step requires a title property',
        node: json,
        expected: 'path property',
        actual: 'undefined',
      })
    }

    if (dataProperties.onAccess !== undefined) {
      properties.onAccess = this.nodeFactory.transformValue(dataProperties.onAccess)
    }

    if (dataProperties.code !== undefined) {
      properties.code = dataProperties.code
    }

    if (dataProperties.onSubmission !== undefined) {
      properties.onSubmission = this.nodeFactory.transformValue(dataProperties.onSubmission)
    }

    if (dataProperties.validateOnEntry !== undefined) {
      properties.validateOnEntry = dataProperties.validateOnEntry.map(entry => ({
        groups: entry.groups,
        when: entry.when === true ? true : this.nodeFactory.createNode(entry.when),
      }))
    }

    if (dataProperties.blocks !== undefined) {
      properties.blocks = this.nodeFactory.transformValue(dataProperties.blocks)
    }

    if (dataProperties.view !== undefined) {
      properties.view = this.nodeFactory.transformValue(dataProperties.view)
    }

    if (dataProperties.reachability !== undefined) {
      const { entryWhen, tieBreakers } = dataProperties.reachability
      const reachability: StepReachabilityAST = {}

      if (entryWhen === true) {
        reachability.entryWhen = true
      }

      if (isExpression(entryWhen)) {
        reachability.entryWhen = this.nodeFactory.createNode(entryWhen)
      }

      if (tieBreakers?.every(isTieBreaker)) {
        reachability.tieBreakers = this.nodeFactory.transformValue(tieBreakers)
      }

      properties.reachability = reachability
    }

    if (dataProperties.backlink !== undefined) {
      properties.backlink = dataProperties.backlink
    }

    if (dataProperties.metadata !== undefined) {
      properties.metadata = dataProperties.metadata
    }

    if (dataProperties.data !== undefined) {
      properties.data = dataProperties.data
    }

    if (dataProperties.validWhen !== undefined) {
      properties.validWhen = this.nodeFactory.transformValue(dataProperties.validWhen)
    }

    if (dataProperties.cleardownFieldCodes !== undefined) {
      properties.cleardownFieldCodes = dataProperties.cleardownFieldCodes
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.STEP,
      properties,
      raw: json,
    }
  }
}
