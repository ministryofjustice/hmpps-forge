import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { AuthoredValue } from '../../../chassis/contracts/models/authoredValue.type'

/**
 * The route concern's semantic model for one step or journey node's authored
 * metadata. Built by `RouteAnalyzer`, consumed by `RouteMetadataCompiler`.
 * AST nodes survive here only as expression leaves and diagnostic tokens.
 */
export interface RouteMetadataModel {
  readonly nodeId: NodeId
  readonly title: AuthoredValue
  readonly description?: AuthoredValue
  readonly metadata?: AuthoredValue
}
