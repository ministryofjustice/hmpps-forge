import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import type { ASTNode, NodeId } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import Ancestry from './Ancestry'

export interface StepOwnership {
  readonly stepNode: StepASTNode
  readonly fieldBlocks: FieldBlockASTNode[]
  readonly mapIterateNodes: IterateASTNode[]
  readonly allIterateNodes: IterateASTNode[]
}

export interface JourneyOwnership {
  readonly journeyNode: JourneyASTNode
  readonly stepNodes: StepASTNode[]
}

/**
 * Buckets the registered AST by owning step and journey in one pass.
 *
 * Registration order is `NodeRegistrationWalker`'s top-down depth-first
 * descent, so bucketing the registry's type lists by nearest owner preserves
 * document order inside every bucket — replacing the per-step parent-chain
 * rescans that made ownership lookups O(steps × nodes).
 */
export default class OwnershipIndex {
  private readonly stepBuckets = new Map<NodeId, StepOwnership>()

  private readonly journeyBuckets = new Map<NodeId, JourneyOwnership>()

  constructor(
    nodeRegistry: ASTNodeIndex,
    private readonly ancestry: Ancestry = new Ancestry(),
  ) {
    nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY).forEach(journeyNode => {
      this.journeyBuckets.set(journeyNode.id, { journeyNode, stepNodes: [] })
    })
    nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP).forEach(stepNode => {
      this.stepBuckets.set(stepNode.id, {
        stepNode,
        fieldBlocks: [],
        mapIterateNodes: [],
        allIterateNodes: [],
      })
      this.journeyBucketFor(stepNode)?.stepNodes.push(stepNode)
    })
    nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD).forEach(fieldBlock => {
      this.nearestStepBucket(fieldBlock)?.fieldBlocks.push(fieldBlock)
    })
    nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE).forEach(iterateNode => {
      const stepBucket = this.nearestStepBucket(iterateNode)

      if (stepBucket === undefined) {
        return
      }

      stepBucket.allIterateNodes.push(iterateNode)

      if (iterateNode.properties.iterator.type === IteratorType.MAP) {
        stepBucket.mapIterateNodes.push(iterateNode)
      }
    })
  }

  /** Every registered journey with its directly owned steps, in document order. */
  journeys(): JourneyOwnership[] {
    return [...this.journeyBuckets.values()]
  }

  // Accessors copy their bucket (matching ASTNodeIndex.findByType) so callers
  // can never mutate the index's document-ordered internals.
  fieldBlocksOf(stepId: NodeId): FieldBlockASTNode[] {
    return [...(this.stepBuckets.get(stepId)?.fieldBlocks ?? [])]
  }

  mapIterateNodesOf(stepId: NodeId): IterateASTNode[] {
    return [...(this.stepBuckets.get(stepId)?.mapIterateNodes ?? [])]
  }

  allIterateNodesOf(stepId: NodeId): IterateASTNode[] {
    return [...(this.stepBuckets.get(stepId)?.allIterateNodes ?? [])]
  }

  // A step without a registered parent journey stays unattached; the plan
  // builder owns rejecting that state so partial test registries stay usable.
  private journeyBucketFor(stepNode: StepASTNode): JourneyOwnership | undefined {
    const parentJourney = stepNode.parent

    return this.isJourneyNode(parentJourney) ? this.journeyBuckets.get(parentJourney.id) : undefined
  }

  // Steps never nest, so the nearest step ancestor is the unique owning step.
  private nearestStepBucket(node: ASTNode): StepOwnership | undefined {
    const owningStep = this.ancestry.nearestAncestorSetting(node, ancestor =>
      this.isStepNode(ancestor) ? ancestor : undefined,
    )

    return owningStep === undefined ? undefined : this.stepBuckets.get(owningStep.id)
  }

  private isJourneyNode(node: ASTNode | undefined): node is JourneyASTNode {
    return node?.type === ASTNodeType.JOURNEY
  }

  private isStepNode(node: ASTNode): node is StepASTNode {
    return node.type === ASTNodeType.STEP
  }
}
