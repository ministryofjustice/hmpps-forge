import type { JourneyDefinition } from '../../../../authoring/types/structures.type'
import type { JourneyASTNode } from '../../contracts/ast/structures.type'
import type { NodeId } from '../../contracts/ast/engine.type'
import type { CompilationModel } from '../../contracts/models/compilationModel.type'
import type {
  CompiledJourney,
  CompiledPackageFunctions,
  CompiledStep,
} from '../../contracts/plans/compilationArtefacts.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../../../concerns/route/contracts/routeDescriptors.type'
import type { CompilationDependencies } from '../lowering/compilationDependencies.type'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import type TemplateNodeIndex from '../ast/ast-state/TemplateNodeIndex'
import ForgeInternalError from '../../../errors/ForgeInternalError'

export interface AstContext {
  readonly rootNode: JourneyASTNode
  readonly nodeIndex: ASTNodeIndex
  /** Template contents indexed for semantic analysis only — analysis and lowering must not plan against them. */
  readonly templateNodeIndex: TemplateNodeIndex
}

export interface RouteIndexes {
  readonly stepRouteIndex: StepRouteIndex
  readonly journeyRouteIndex: JourneyRouteIndex
}

/**
 * The draft the compilation phases build up, one phase at a time: the AST
 * phase records the tree, analysis records the model, the codegen tasks fill
 * the artifact maps, and the route phase records the indexes. Each getter
 * throws when read before its phase has run — the phase order is fixed, so a
 * missing value is a pipeline bug, not an outcome.
 *
 * Like the AST and the compilation model, this state never leaves
 * compilation: the pipeline assembles the `CompiledPackage` from it and only
 * that crosses the boundary.
 */
export default class CompilationState {
  readonly journeys = new Map<NodeId, CompiledJourney>()

  readonly steps = new Map<NodeId, CompiledStep>()

  private mutableAst?: AstContext

  private mutableJourneyCode?: string

  private mutableModel?: CompilationModel

  private mutablePackageFunctions?: CompiledPackageFunctions

  private mutableRouteIndexes?: RouteIndexes

  constructor(
    readonly journeyDefinition: JourneyDefinition,
    readonly dependencies: CompilationDependencies,
  ) {}

  get ast(): AstContext {
    if (this.mutableAst === undefined) {
      throw new ForgeInternalError('Compilation state read before the AST phase recorded the tree')
    }

    return this.mutableAst
  }

  /** Undefined until the AST phase has run — the error path reports traces for packages that failed before then. */
  get journeyCode(): string | undefined {
    return this.mutableJourneyCode
  }

  get model(): CompilationModel {
    if (this.mutableModel === undefined) {
      throw new ForgeInternalError('Compilation state read before the analysis phase recorded the model')
    }

    return this.mutableModel
  }

  get packageFunctions(): CompiledPackageFunctions {
    if (this.mutablePackageFunctions === undefined) {
      throw new ForgeInternalError('Compilation state read before the package functions were compiled')
    }

    return this.mutablePackageFunctions
  }

  get routeIndexes(): RouteIndexes {
    if (this.mutableRouteIndexes === undefined) {
      throw new ForgeInternalError('Compilation state read before the route phase recorded the indexes')
    }

    return this.mutableRouteIndexes
  }

  recordAst(ast: AstContext): void {
    this.mutableAst = ast
    this.mutableJourneyCode = ast.rootNode.properties.code
  }

  recordModel(model: CompilationModel): void {
    this.mutableModel = model
  }

  recordPackageFunctions(packageFunctions: CompiledPackageFunctions): void {
    this.mutablePackageFunctions = packageFunctions
  }

  recordRouteIndexes(routeIndexes: RouteIndexes): void {
    this.mutableRouteIndexes = routeIndexes
  }
}
