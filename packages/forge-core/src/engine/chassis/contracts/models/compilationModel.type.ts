import type { NodeId } from '../ast/ast.type'
import type { JourneyMountInfo, StepMountInfo } from '../plans/mountInfo.type'
import type { FieldModel } from './fieldModel.type'
import type { AnswerPreparationModel } from '../../../concerns/answer-preparation/contracts/answerPreparationModel.type'
import type { CleardownModel } from '../../../concerns/answer-cleardown/contracts/cleardownModel.type'
import type { JourneyHookModel, StepHookModel } from '../../../concerns/hooks/contracts/hookModel.type'
import type { ReachabilityModel } from '../../../concerns/reachability/contracts/reachabilityModel.type'
import type { ResolveModel } from '../../../concerns/resolve/contracts/resolveModel.type'
import type { RouteMetadataModel } from '../../../concerns/route/contracts/routeMetadataModel.type'
import type { ValidationModel } from '../../../concerns/validation/contracts/validationModel.type'

/**
 * The semantic model analysis hands to lowering: route metadata for
 * every node plus one `JourneyModel` per journey, each owning its steps.
 * Ownership is structure — a step lives inside its journey's map, so lowering
 * never joins flat maps by `NodeId`. Past analysis there is no `unknown` and
 * no structural AST querying; AST survives only as expression leaves and
 * diagnostic tokens. The model is strictly pre-codegen and never reaches
 * runtime state.
 */
export interface CompilationModel {
  /** Every step and journey, container journeys included. */
  readonly routeMetadata: ReadonlyMap<NodeId, RouteMetadataModel>
  /** Every journey; a container journey has an empty `steps` map. */
  readonly journeys: ReadonlyMap<NodeId, JourneyModel>
}

export interface JourneyModel {
  readonly journeyId: NodeId
  /** Script-URL identity segment; `undefined` leaves scripts unlabelled. */
  readonly label?: string
  readonly mountInfo: JourneyMountInfo
  /** Opaque authored payload — spread into runtime state, never inspected. */
  readonly staticData: Record<string, unknown>
  readonly hooks: JourneyHookModel
  readonly reachability: ReachabilityModel
  readonly cleardown: CleardownModel
  readonly answerPreparation: AnswerPreparationModel
  /** Owned steps in document order — the same order as the reachability state table. */
  readonly steps: ReadonlyMap<NodeId, StepModel>
}

export interface StepModel {
  readonly stepId: NodeId
  /** Script-URL identity segment; `undefined` leaves scripts unlabelled. */
  readonly label?: string
  readonly mountInfo: StepMountInfo
  /** Opaque authored payload — spread into runtime state, never inspected. */
  readonly staticData: Record<string, unknown>
  /** Every field occurrence the step owns; concern models hold projections of these. */
  readonly fields: readonly FieldModel[]
  readonly answerPreparation: AnswerPreparationModel
  readonly hooks: StepHookModel
  readonly validation: ValidationModel
  readonly resolve: ResolveModel
}
