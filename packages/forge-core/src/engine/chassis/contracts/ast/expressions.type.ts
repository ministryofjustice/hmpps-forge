import { ExpressionType, FunctionType, IteratorType, HookType, OutcomeType } from '../../../../authoring/types/enums'
import { ASTNodeType } from './enums'
import { ASTNode } from './ast.type'
import { TemplateValue } from './template.type'

/**
 * Expression AST node - represents any expression in the form
 */
export interface ExpressionASTNode extends ASTNode {
  type: ASTNodeType.EXPRESSION
  expressionType: ExpressionType | FunctionType
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
 * Outcome AST node - represents hook outcomes (redirects and errors)
 */
export interface OutcomeASTNode extends ASTNode {
  type: ASTNodeType.OUTCOME
  outcomeType: OutcomeType
}

/**
 * Redirect Outcome AST node
 */
export interface RedirectOutcomeASTNode extends OutcomeASTNode {
  outcomeType: OutcomeType.REDIRECT
  properties: {
    when?: ASTNode
    goto: ASTNode | string
  }
}

/**
 * Throw Error Outcome AST node
 */
export interface ThrowErrorOutcomeASTNode extends OutcomeASTNode {
  outcomeType: OutcomeType.THROW_ERROR
  properties: {
    when?: ASTNode
    status: number
    message: ASTNode | string
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
 * Iterate Expression AST node - applies an iterator to a source collection.
 *
 * Iterator templates are compiled once and instantiated with fresh runtime IDs
 * per item during evaluation.
 */
export interface IterateASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.ITERATE
  properties: {
    /** The input source (array or prior iterate result) */
    input: ASTNode | any
    /** Iterator configuration */
    iterator: {
      type: IteratorType
      /** For MAP: compiled template instantiated per item at runtime */
      yieldTemplate?: TemplateValue
      /** For FILTER/FIND: compiled predicate template instantiated per item at runtime */
      predicateTemplate?: TemplateValue
    }
  }
}

/**
 * Conditional Expression AST node
 */
export interface ConditionalASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.CONDITIONAL
  properties: {
    predicate: ASTNode
    thenValue?: ASTNode | any
    elseValue?: ASTNode | any
  }
}

/**
 * Match Expression AST node
 */
export interface MatchASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.MATCH
  properties: {
    branches: Array<{
      predicate: ASTNode
      value: ASTNode | any
    }>
    otherwise?: ASTNode | any
  }
}

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
    condition: ASTNode // Required: the predicate — truthy means validation passes
    message: ASTNode | string // Can be a plain string or a ResolvableString expression
    submissionOnly?: boolean
    groups?: string[]
    details?: Record<string, any>
  }
}

/**
 * Tie-breaker Expression AST node - one prioritised rule inside a step's
 * `reachability.tieBreakers` list. The `when` predicate (when present) decides
 * whether this priority applies to the owning step.
 */
export interface TieBreakerASTNode extends ExpressionASTNode {
  expressionType: ExpressionType.TIE_BREAKER
  properties: {
    priority: number
    when?: ASTNode
  }
}

/**
 * Hook AST node - represents lifecycle hooks
 */
interface HookASTNode extends ASTNode {
  type: ASTNodeType.HOOK
  hookType: HookType
}

/**
 * Access Hook AST node
 */
export interface AccessHookASTNode extends HookASTNode {
  hookType: HookType.ACCESS
  properties: {
    when?: ASTNode
    effects?: ASTNode[]
    next?: ASTNode[]
  }
}

/**
 * Submit Hook AST node
 */
export interface SubmitHookASTNode extends HookASTNode {
  hookType: HookType.SUBMIT
  properties: {
    when?: ASTNode
    guards?: ASTNode
    validate: boolean
    validationGroups: string[]
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
