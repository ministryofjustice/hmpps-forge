import { ExpressionType, FunctionType, LogicType, TransitionType } from '@form-engine/form/types/enums'
import { AST_NODE_SYMBOLS, type ASTNodeSymbol } from '@form-engine/core/types/symbols'

/**
 * Base AST node interface that all nodes extend
 */
export interface ASTNode {
  type: ASTNodeSymbol
  id?: string
  raw?: any
}

/**
 * Journey AST node - represents the top-level form journey
 */
export interface JourneyASTNode extends ASTNode {
  type: typeof AST_NODE_SYMBOLS.JOURNEY
  properties: Map<string, ASTNode | any>
}

/**
 * Step AST node - represents a single page/step in the journey
 */
export interface StepASTNode extends ASTNode {
  type: typeof AST_NODE_SYMBOLS.STEP
  properties: Map<string, ASTNode | any>
}

/**
 * Block AST node - represents UI components
 */
export interface BlockASTNode extends ASTNode {
  type: typeof AST_NODE_SYMBOLS.BLOCK
  blockType: 'basic' | 'field' | 'collection' | 'composite'
  properties: Map<string, ASTNode | any>
}

/**
 * Expression AST node - represents any expression in the form
 */
export interface ExpressionASTNode extends ASTNode {
  type: typeof AST_NODE_SYMBOLS.EXPRESSION
  expressionType: ExpressionType | FunctionType | LogicType
  properties: Map<string, ASTNode | any>
}

/**
 * Reference Expression AST node
 */
export interface ReferenceASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.REFERENCE
}

/**
 * Pipeline Expression AST node
 */
export interface PipelineASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.PIPELINE
}

/**
 * Conditional Expression AST node
 */
export interface ConditionalASTNode extends ExpressionASTNode {
  expressionType: LogicType.CONDITIONAL
}

/**
 * Predicate Expression AST node
 */
export interface PredicateASTNode extends ExpressionASTNode {
  expressionType: LogicType
}

/**
 * Function Expression AST node
 */
export interface FunctionASTNode extends ExpressionASTNode {
  expressionType: FunctionType
}

/**
 * Validation Expression AST node
 */
export interface ValidationASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.VALIDATION
}

/**
 * Transition AST node - represents lifecycle transitions
 */
export interface TransitionASTNode extends ASTNode {
  type: typeof AST_NODE_SYMBOLS.TRANSITION
  transitionType: TransitionType
  properties: Map<string, ASTNode | any>
}

/**
 * Load Transition AST node
 */
export interface LoadTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.LOAD
}

/**
 * Access Transition AST node
 */
export interface AccessTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.ACCESS
}

/**
 * Submit Transition AST node
 */
export interface SubmitTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.SUBMIT
}
