import {
  ComponentCallType,
  ExpressionType,
  FunctionCallType,
  HookType,
  PolicyType,
  PredicateType,
  StructureType,
} from '../../../../authoring/types/enums'

export type ASTPolicyNodeKind = Exclude<PolicyType, PolicyType.NAVIGATION_NEXT>

/** The exact semantic identity of every constructible AST node. */
export type ASTNodeKind =
  | StructureType
  | ComponentCallType
  | ExpressionType
  | FunctionCallType
  | PredicateType
  | HookType
  | ASTPolicyNodeKind

/** The immediate taxonomy parent used for broad AST index queries. */
export enum ASTNodeFamily {
  STRUCTURE = 'structure',
  COMPONENT_CALL = 'component.call',
  EXPRESSION = 'expression',
  FUNCTION_CALL = 'function.call',
  PREDICATE = 'predicate',
  HOOK = 'hook',
  POLICY_VALIDATION = 'policy.validation',
  POLICY_NAVIGATION = 'policy.navigation',
  POLICY_OUTCOME = 'policy.outcome',
}

export function astNodeFamily(kind: ASTNodeKind): ASTNodeFamily {
  return kind.slice(0, kind.lastIndexOf('.')) as ASTNodeFamily
}
