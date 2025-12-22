import { ExpressionType, FunctionType, LogicType, TransitionType, IteratorType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ASTNode } from '@form-engine/core/types/engine.type'

/**
 * Expression AST node - represents any expression in the form
 */
export interface ExpressionASTNode extends ASTNode {
  type: ASTNodeType.EXPRESSION
  expressionType: ExpressionType | FunctionType | LogicType
}

/**
 * Reference Expression AST node
 */
export interface ReferenceASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.REFERENCE
  properties: {
    path: (ASTNode | string | number)[]
    /**
     * Optional base expression to evaluate first.
     * When present, evaluates the base and navigates into the result using path.
     */
    base?: ASTNode
  }
}

/**
 * Next Expression AST node
 */
export interface NextASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.NEXT
  properties: {
    when?: ASTNode
    goto: ASTNode | string
  }
}

/**
 * Pipeline Expression AST node
 */
export interface PipelineASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.PIPELINE
  properties: {
    input: ASTNode | any
    steps: ASTNode[]
  }
}

/**
 * Format Expression AST node
 */
export interface FormatASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.FORMAT
  properties: {
    template: string
    arguments: (ASTNode | any)[]
  }
}

/**
 * Iterate Expression AST node - applies an iterator to a source collection.
 *
 * Similar to Collection, the yield/predicate templates are stored as raw JSON
 * and instantiated at runtime per item.
 */
export interface IterateASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.ITERATE
  properties: {
    /** The input source (array or prior iterate result) */
    input: ASTNode | any
    /** Iterator configuration */
    iterator: {
      type: IteratorType
      /** For MAP: template to yield per item (raw JSON, instantiated at runtime) */
      yield?: any
      /** For FILTER: predicate (raw JSON, instantiated at runtime) */
      predicate?: any
    }
  }
}

/**
 * Conditional Expression AST node
 */
export interface ConditionalASTNode extends ExpressionASTNode {
  expressionType: LogicType.CONDITIONAL
  properties: {
    predicate: ASTNode
    thenValue?: ASTNode | any
    elseValue?: ASTNode | any
  }
}

/**
 * Test Predicate Expression AST node
 */
export interface TestPredicateASTNode extends ExpressionASTNode {
  expressionType: LogicType.TEST
  properties: {
    subject: ASTNode
    condition: ASTNode
    negate: boolean
  }
}

/**
 * Not Predicate Expression AST node
 */
export interface NotPredicateASTNode extends ExpressionASTNode {
  expressionType: LogicType.NOT
  properties: {
    operand: ASTNode
  }
}

/**
 * And Predicate Expression AST node
 */
export interface AndPredicateASTNode extends ExpressionASTNode {
  expressionType: LogicType.AND
  properties: {
    operands: ASTNode[]
  }
}

/**
 * Or Predicate Expression AST node
 */
export interface OrPredicateASTNode extends ExpressionASTNode {
  expressionType: LogicType.OR
  properties: {
    operands: ASTNode[]
  }
}

/**
 * Xor Predicate Expression AST node
 */
export interface XorPredicateASTNode extends ExpressionASTNode {
  expressionType: LogicType.XOR
  properties: {
    operands: ASTNode[]
  }
}

/**
 * Union type for all Predicate Expression AST nodes
 */
export type PredicateASTNode =
  | TestPredicateASTNode
  | NotPredicateASTNode
  | AndPredicateASTNode
  | OrPredicateASTNode
  | XorPredicateASTNode

/**
 * Function Expression AST node
 */
export interface FunctionASTNode extends ExpressionASTNode {
  expressionType: FunctionType
  properties: {
    name: string
    arguments: (ASTNode | any)[]
  }
}

/**
 * Validation Expression AST node
 */
export interface ValidationASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.VALIDATION
  properties: {
    when: ASTNode // Required: the predicate that determines if validation passes
    message: ASTNode | string // Can be a plain string or a ConditionalString expression
    submissionOnly?: boolean
    details?: Record<string, any>
    resolvedBlockCode?: string | ASTNode // Computed during normalization
  }
}

/**
 * Transition AST node - represents lifecycle transitions
 */
export interface TransitionASTNode extends ASTNode {
  type: ASTNodeType.TRANSITION
  transitionType: TransitionType
}

/**
 * Load Transition AST node
 */
export interface LoadTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.LOAD
  properties: {
    effects: ASTNode[]
  }
}

/**
 * Access Transition AST node
 */
export interface AccessTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.ACCESS
  properties: {
    guards?: ASTNode
    effects?: ASTNode[]
    redirect?: ASTNode[]
    status?: number
    message?: ASTNode | string
  }
}

/**
 * Action Transition AST node
 */
export interface ActionTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.ACTION
  properties: {
    when: ASTNode
    effects: ASTNode[]
  }
}

/**
 * Submit Transition AST node
 */
export interface SubmitTransitionASTNode extends TransitionASTNode {
  transitionType: TransitionType.SUBMIT
  properties: {
    when?: ASTNode
    guards?: ASTNode
    validate: boolean
    onAlways?: {
      effects?: ASTNode[]
      next?: ASTNode[]
    }
    onValid?: {
      effects?: ASTNode[]
      next?: ASTNode[]
    }
    onInvalid?: {
      effects?: ASTNode[]
      next?: ASTNode[]
    }
  }
}
