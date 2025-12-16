import { ASTNodeType } from '@form-engine/core/types/enums'
import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  AccessTransitionASTNode,
  ActionTransitionASTNode,
  LoadTransitionASTNode,
  SubmitTransitionASTNode,
  ValidationASTNode,
} from '@form-engine/core/types/expressions.type'
import { ViewConfig } from '@form-engine/form/types/structures.type'

/**
 * Journey AST node - represents the top-level form journey
 */
export interface JourneyASTNode extends ASTNode {
  type: ASTNodeType.JOURNEY
  properties: {
    path: string
    code: string
    onLoad?: LoadTransitionASTNode[]
    onAccess?: AccessTransitionASTNode[]
    steps?: StepASTNode[]
    children?: JourneyASTNode[]
    title: string
    description?: string
    version?: string
    view?: ViewConfig
    entryPath?: string
    metadata?: Record<string, any>
  }
}

/**
 * Step AST node - represents a single page/step in the journey
 */
export interface StepASTNode extends ASTNode {
  type: ASTNodeType.STEP
  properties: {
    path: string
    onLoad?: LoadTransitionASTNode[]
    onAccess?: AccessTransitionASTNode[]
    onAction?: ActionTransitionASTNode[]
    onSubmission?: SubmitTransitionASTNode[]
    blocks?: BlockASTNode[]
    title: string
    description?: string
    view?: ViewConfig
    isEntryPoint?: boolean
    backlink?: string
    metadata?: Record<string, any>
  }
}

/**
 * Basic Block AST node - for non-field UI components (HTML, dividers, etc.)
 */
export interface BasicBlockASTNode extends ASTNode {
  type: ASTNodeType.BLOCK
  variant: string
  blockType: 'basic'
  properties: {
    hidden?: ASTNode // Conditional visibility
    metadata?: Record<string, any>
    // Component-specific arbitrary parameters
    [key: string]: any
  }
}

/**
 * Field Block AST node - for input fields with validation
 */
export interface FieldBlockASTNode extends ASTNode {
  type: ASTNodeType.BLOCK
  variant: string
  blockType: 'field'
  properties: {
    // Known field properties
    code?: string | ASTNode // Optional because it might not be set initially
    defaultValue?: ASTNode | any
    formatters?: ASTNode // Pipeline node after normalization
    hidden?: ASTNode
    validate?: ValidationASTNode[]
    dependent?: ASTNode
    value?: ASTNode // Added by normalizer (Self reference)
    metadata?: Record<string, any>
    multiple?: boolean
    sanitize?: boolean // Whether to escape HTML entities (defaults to true)

    // Component-specific arbitrary parameters
    [key: string]: any
  }
}

/**
 * Block AST node - union type for all block variants
 */
export type BlockASTNode = BasicBlockASTNode | FieldBlockASTNode
