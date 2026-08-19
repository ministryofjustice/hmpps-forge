import type { NodeId } from '../../contracts/ast/ast.type'
import type { JourneyASTNode, StepASTNode } from '../../contracts/ast/structures.type'
import type { FieldModel } from '../../contracts/models/fieldModel.type'
import type ComponentRegistry from '../../registries/ComponentRegistry'
import type FunctionRegistry from '../../registries/FunctionRegistry'
import type Ancestry from './shared/Ancestry'
import type AuthoredValueClassifier from './shared/AuthoredValueClassifier'
import type NodeLabeller from './shared/NodeLabeller'
import type OwnershipIndex from './shared/OwnershipIndex'

/**
 * The concern analyzer family. Every concern implements one or both interfaces
 * with a zero-argument constructor: everything an analyzer needs arrives in
 * its context. Analyzers are total — they throw `ForgeInternalError` for
 * impossible states only; semantic analysis remains the only authoring-error
 * gate.
 */

/** A concern analyzer that produces one step-scoped model per step. */
export interface StepModelAnalyzer<TModel> {
  analyzeStep(context: StepAnalysisContext): TModel
}

/** A concern analyzer that produces one journey-scoped model per journey. */
export interface JourneyModelAnalyzer<TModel> {
  analyzeJourney(context: JourneyAnalysisContext): TModel
}

export interface AnalysisRegistries {
  readonly componentRegistry: ComponentRegistry
  readonly functionRegistry: FunctionRegistry
}

export interface StepAnalysisContext {
  readonly stepNode: StepASTNode
  readonly ownership: OwnershipIndex
  readonly ancestry: Ancestry
  readonly registries: AnalysisRegistries
  readonly classifier: AuthoredValueClassifier
  /** This step's field occurrences, built once by the shared field walk. */
  readonly fields: readonly FieldModel[]
  readonly labels: NodeLabeller
}

export interface JourneyAnalysisContext {
  readonly journeyNode: JourneyASTNode
  /** Owned steps in document order — the walk's order, never the reachability state table's. */
  readonly stepNodes: readonly StepASTNode[]
  readonly ownership: OwnershipIndex
  readonly ancestry: Ancestry
  readonly registries: AnalysisRegistries
  readonly classifier: AuthoredValueClassifier
  readonly labels: NodeLabeller
  /** Per owned step, that step's field occurrences, in `stepNodes` order. */
  readonly stepFields: ReadonlyMap<NodeId, readonly FieldModel[]>
}
