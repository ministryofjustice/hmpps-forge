import type { ComponentRegistry } from '../../../../framework/types/adapter.type'
import type { ForgeRenderer } from '../../../../framework/types/rendering.type'
import type { NodeId } from '../ast/ast.type'
import type {
  CompiledAnswerPreparationFunction,
  CompiledEntryValidationFunction,
  CompiledReachabilityFactsFunction,
  CompiledReachabilityStateFunction,
  CompiledResolveFunction,
  CompiledRouteMetadataFunction,
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../compiled/compiledFunctions.type'
import type { CompiledFieldInventoryFunction } from '../../../concerns/answer-cleardown/contracts/compiledFieldInventory.type'
import type {
  CompiledAccessLifecycleFunction,
  CompiledSubmitHooksFunction,
} from '../../../concerns/hooks/contracts/hookLifecycle.type'
import type { JourneyRouteTemplateCatalog, StoredRouteTree } from '../../../concerns/route/contracts/routeTree.type'
import type { HttpMethod } from '../../../../framework/types/request.type'
import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import type { WorkTask } from '../work/work.type'

export interface RequestPipelineWorkProps {
  readonly phases: readonly WorkTask[]
}

/**
 * The shared shape of a phase that runs one compiled function over the step path.
 * Access, answer-preparation, entry-validation, submit, and render all instantiate
 * it; `compiled` is the phase's compiled function.
 */
interface PhaseWorkProps<TCompiled> {
  readonly compiled: TCompiled
  readonly path: string
}

export type RequestAccessWorkProps = PhaseWorkProps<CompiledAccessLifecycleFunction>

export type RequestAnswerPreparationWorkProps = PhaseWorkProps<CompiledAnswerPreparationFunction>

export type RequestEntryValidationWorkProps = PhaseWorkProps<CompiledEntryValidationFunction>

export type RequestSubmitWorkProps = PhaseWorkProps<CompiledSubmitHooksFunction>

export type RequestResolveWorkProps = PhaseWorkProps<CompiledResolveFunction>

/**
 * The route-tree phase resolves the package's route metadata and hydrates it onto
 * the static topology. It carries the same topology props the resolve phase used
 * to own, plus the package-level `compiled` metadata function it evaluates.
 */
export type RequestRouteTreeWorkProps = PhaseWorkProps<CompiledRouteMetadataFunction> & {
  readonly routeTree: StoredRouteTree
  readonly currentRouteTemplatePath: string
}

export interface RequestReachabilityWorkProps {
  readonly mode: 'step' | 'journey'
  readonly compiledReachabilityFacts: CompiledReachabilityFactsFunction
  readonly compiledReachabilityState: CompiledReachabilityStateFunction
  readonly compiledFieldInventory: CompiledFieldInventoryFunction | undefined
  readonly routeTemplateCatalog: JourneyRouteTemplateCatalog
  readonly method: HttpMethod
}

// Answer-cleardown reads everything it needs (projection, evaluation, answers, params)
// from the request context, so the phase carries no compiled props of its own.
export type RequestAnswerCleardownWorkProps = Record<string, never>

export interface RequestValiditiesWorkProps {
  readonly compiledStepValidations: ReadonlyMap<NodeId, CompiledValidationFunction>
}

export interface RequestRenderWorkProps {
  readonly renderer: ForgeRenderer<unknown>
  readonly componentRegistry: ComponentRegistry
}

export interface RequestContextPreparationWorkProps {
  readonly compiledStaticData: CompiledStaticDataFunction
  readonly snapshot: RequestSnapshot
}
