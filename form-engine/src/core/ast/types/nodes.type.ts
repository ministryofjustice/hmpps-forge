import { ExpressionType, FunctionType, LogicType, TransitionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'

/**
 * Base AST node interface that all nodes extend
 */
export interface ASTNode {
  type: ASTNodeType
  id?: string
  raw?: any
}

/**
 * Journey AST node - represents the top-level form journey
 */
export interface JourneyASTNode extends ASTNode {
  type: ASTNodeType.JOURNEY
  properties: Map<string, ASTNode | any>
}

/**
 * Step AST node - represents a single page/step in the journey
 */
export interface StepASTNode extends ASTNode {
  type: ASTNodeType.STEP
  properties: Map<string, ASTNode | any>
}

/**
 * Block AST node - represents UI components
 */
export interface BlockASTNode extends ASTNode {
  type: ASTNodeType.BLOCK
  variant: string
  blockType: 'basic' | 'field' | 'collection' | 'composite'
  properties: Map<string, ASTNode | any>
}

/**
 * Expression AST node - represents any expression in the form
 */
export interface ExpressionASTNode extends ASTNode {
  type: ASTNodeType.EXPRESSION
  expressionType: ExpressionType | FunctionType | LogicType
  properties: Map<string, ASTNode | any>
}

/**
 * Reference Expression AST node
 */
export interface ReferenceASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.REFERENCE
  properties: Map<string, ASTNode | any>
}

/**
 * Pipeline Expression AST node
 */
export interface PipelineASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.PIPELINE
  properties: Map<string, ASTNode | any>
}

/**
 * Conditional Expression AST node
 */
export interface ConditionalASTNode extends ExpressionASTNode {
  expressionType: LogicType.CONDITIONAL
  properties: Map<string, ASTNode | any>
}

/**
 * Predicate Expression AST node
 */
export interface PredicateASTNode extends ExpressionASTNode {
  expressionType: LogicType
  properties: Map<string, ASTNode | any>
}

/**
 * Function Expression AST node
 */
export interface FunctionASTNode extends ExpressionASTNode {
  expressionType: FunctionType
  properties: Map<string, ASTNode | any>
}

/**
 * Validation Expression AST node
 */
export interface ValidationASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.VALIDATION
  properties: Map<string, ASTNode | any>
}

/**
 * Transition AST node - represents lifecycle transitions
 */
export interface TransitionASTNode extends ASTNode {
  type: ASTNodeType.TRANSITION
  transitionType: TransitionType
  properties: Map<string, ASTNode | any>
}

/**
 * Load Transition AST node
 */
export interface LoadTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.LOAD
  properties: Map<string, ASTNode | any>
}

/**
 * Access Transition AST node
 */
export interface AccessTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.ACCESS
  properties: Map<string, ASTNode | any>
}

/**
 * Submit Transition AST node
 */
export interface SubmitTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.SUBMIT
  properties: Map<string, ASTNode | any>
}
