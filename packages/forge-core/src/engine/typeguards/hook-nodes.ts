import { HookType } from '../../authoring/types/enums'
import { ASTNodeType } from '../types/enums'
import { HookASTNode, AccessHookASTNode, SubmitHookASTNode } from '../types/expressions.type'

export function isHookNode(obj: any): obj is HookASTNode {
  return obj != null && obj.type === ASTNodeType.HOOK
}

/**
 * Check if an AST node is an Access Hook node
 */
export function isAccessHookNode(obj: any): obj is AccessHookASTNode {
  return isHookNode(obj) && obj.hookType === HookType.ACCESS
}

/**
 * Check if an AST node is a Submit Hook node
 */
export function isSubmitHookNode(obj: any): obj is SubmitHookASTNode {
  return isHookNode(obj) && obj.hookType === HookType.SUBMIT
}

/**
 * Check if an AST node is a Skip Validation Hook node (Submit without validation)
 */
export function isSkipValidationHookNode(obj: any): obj is SubmitHookASTNode {
  return isSubmitHookNode(obj) && obj.properties.validate === false
}

/**
 * Check if an AST node is a Validating Hook node (Submit with validation)
 */
export function isValidatingHookNode(obj: any): obj is SubmitHookASTNode {
  return isSubmitHookNode(obj) && obj.properties.validate === true
}
