import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { StepASTNode, StepReachabilityAST } from '../../../../../contracts/ast/structures.type'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import type { StepDefinition } from '../../../../../../authoring/types/structures.type'
import { isExpression, isTieBreaker } from '../../../../../../authoring/typeguards/expressions'

/**
 * StepFactory: Creates Step AST nodes
 *
 * Step represents a single page within a journey, containing blocks and hooks.
 */
export default class StepFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
  ) {}

  /**
   * Transform Step node: Single page within a journey
   * Contains blocks and hooks for user interaction
   */
  create(json: StepDefinition): StepASTNode {
    const { type, ...dataProperties } = json

    const properties: StepASTNode['properties'] = {
      path: json.path,
      title: this.nodeFactory.transformChild(json.title, 'title'),
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
      properties.onAccess = this.nodeFactory.transformChild(dataProperties.onAccess, 'onAccess')
    }

    if (dataProperties.code !== undefined) {
      properties.code = dataProperties.code
    }

    if (dataProperties.onSubmission !== undefined) {
      properties.onSubmission = this.nodeFactory.transformChild(dataProperties.onSubmission, 'onSubmission')
    }

    if (dataProperties.validateOnEntry !== undefined) {
      properties.validateOnEntry = dataProperties.validateOnEntry.map((entry, index) => ({
        groups: entry.groups,
        when:
          entry.when === true ? true : this.nodeFactory.createChildNode(entry.when, 'validateOnEntry', index, 'when'),
      }))
    }

    if (dataProperties.blocks !== undefined) {
      properties.blocks = this.nodeFactory.transformChild(dataProperties.blocks, 'blocks')
    }

    if (dataProperties.description !== undefined) {
      properties.description = this.nodeFactory.transformChild(dataProperties.description, 'description')
    }

    if (dataProperties.view !== undefined) {
      properties.view = this.nodeFactory.transformChild(dataProperties.view, 'view')
    }

    if (dataProperties.reachability !== undefined) {
      const { entryWhen, tieBreakers } = dataProperties.reachability
      const reachability: StepReachabilityAST = {}

      if (entryWhen === true) {
        reachability.entryWhen = true
      }

      if (isExpression(entryWhen)) {
        reachability.entryWhen = this.nodeFactory.createChildNode(entryWhen, 'reachability', 'entryWhen')
      }

      if (tieBreakers?.every(isTieBreaker)) {
        reachability.tieBreakers = this.nodeFactory.transformChild(tieBreakers, 'reachability', 'tieBreakers')
      }

      properties.reachability = reachability
    }

    if (dataProperties.backlink !== undefined) {
      properties.backlink = dataProperties.backlink
    }

    if (dataProperties.metadata !== undefined) {
      properties.metadata = this.nodeFactory.transformChild(dataProperties.metadata, 'metadata')
    }

    if (dataProperties.data !== undefined) {
      properties.data = dataProperties.data
    }

    if (dataProperties.validWhen !== undefined) {
      properties.validWhen = this.nodeFactory.transformChild(dataProperties.validWhen, 'validWhen')
    }

    if (dataProperties.cleardownFieldCodes !== undefined) {
      properties.cleardownFieldCodes = dataProperties.cleardownFieldCodes
    }

    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.STEP,
      properties,
    }
  }
}
