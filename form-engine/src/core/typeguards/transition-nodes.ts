import { TransitionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  TransitionASTNode,
  LoadTransitionASTNode,
  AccessTransitionASTNode,
  ActionTransitionASTNode,
  SubmitTransitionASTNode,
} from '@form-engine/core/types/expressions.type'

export function isTransitionNode(obj: any): obj is TransitionASTNode {
  return obj != null && obj.type === ASTNodeType.TRANSITION
}

/**
 * Check if an AST node is a Load Transition node
 */
export function isLoadTransitionNode(obj: any): obj is LoadTransitionASTNode {
  return isTransitionNode(obj) && obj.transitionType === TransitionType.LOAD
}

/**
 * Check if an AST node is an Access Transition node
 */
export function isAccessTransitionNode(obj: any): obj is AccessTransitionASTNode {
  return isTransitionNode(obj) && obj.transitionType === TransitionType.ACCESS
}

/**
 * Check if an AST node is an Action Transition node
 */
export function isActionTransitionNode(obj: any): obj is ActionTransitionASTNode {
  return isTransitionNode(obj) && obj.transitionType === TransitionType.ACTION
}

/**
 * Check if an AST node is a Submit Transition node
 */
export function isSubmitTransitionNode(obj: any): obj is SubmitTransitionASTNode {
  return isTransitionNode(obj) && obj.transitionType === TransitionType.SUBMIT
}

/**
 * Check if an AST node is a Skip Validation Transition node (Submit without validation)
 */
export function isSkipValidationTransitionNode(obj: any): obj is SubmitTransitionASTNode {
  return isSubmitTransitionNode(obj) && obj.properties.validate === false
}

/**
 * Check if an AST node is a Validating Transition node (Submit with validation)
 */
export function isValidatingTransitionNode(obj: any): obj is SubmitTransitionASTNode {
  return isSubmitTransitionNode(obj) && obj.properties.validate === true
}
