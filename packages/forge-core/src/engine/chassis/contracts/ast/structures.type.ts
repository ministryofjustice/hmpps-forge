import { ASTNodeType } from './enums'
import { BlockType } from '../../../../authoring/types/enums'
import { ASTNode } from './ast.type'
import { AccessHookASTNode, SubmitHookASTNode, TieBreakerASTNode } from './expressions.type'
import type { RouteMetadata, UnreachableRedirectTarget, ViewConfig } from '../../../../authoring/types/structures.type'
import type { ResolvableString } from '../../../../components/types/structures.type'

export interface JourneyReachabilityAST {
  resumeWhen?: true | ASTNode
  unreachableRedirect?: UnreachableRedirectTarget
  disableReachabilityChecks?: boolean
}

export interface StepReachabilityAST {
  entryWhen?: true | ASTNode
  tieBreakers?: TieBreakerASTNode[]
}

export interface StepEntryValidationAST {
  groups: string[]
  when: true | ASTNode
}

export interface JourneyASTNode extends ASTNode {
  type: ASTNodeType.JOURNEY
  properties: {
    path: string
    code: string
    onAccess?: AccessHookASTNode[]
    steps?: StepASTNode[]
    children?: JourneyASTNode[]
    title: ResolvableString
    description?: ResolvableString
    version?: string
    view?: ViewConfig
    metadata?: RouteMetadata
    data?: Record<string, unknown>
    reachability?: JourneyReachabilityAST
  }
}

export interface StepASTNode extends ASTNode {
  type: ASTNodeType.STEP
  properties: {
    path: string
    code?: string
    onAccess?: AccessHookASTNode[]
    onSubmission?: SubmitHookASTNode[]
    validateOnEntry?: StepEntryValidationAST[]
    blocks?: BlockASTNode[]
    title: ResolvableString
    description?: ResolvableString
    view?: ViewConfig
    reachability?: StepReachabilityAST
    backlink?: string
    metadata?: RouteMetadata
    data?: Record<string, unknown>
    validWhen?: unknown
    cleardownFieldCodes?: string[]
  }
}

/**
 * Basic Block AST node - for non-field UI components (HTML, dividers, etc.)
 */
export interface BasicBlockASTNode extends ASTNode {
  type: ASTNodeType.BLOCK
  variant: string
  blockType: BlockType.BASIC
  properties: {
    visibleWhen?: ASTNode // Conditional visibility
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
  blockType: BlockType.FIELD
  properties: {
    // Known field properties
    code?: string | ASTNode // Optional because it might not be set initially
    defaultValue?: ASTNode | any
    formatters?: ASTNode[]
    parsers?: ASTNode[]
    visibleWhen?: ASTNode
    validWhen?: unknown
    dependentWhen?: ASTNode
    metadata?: Record<string, any>

    // Component-specific arbitrary parameters
    [key: string]: any
  }
}

/**
 * Block AST node - union type for all block variants
 */
export type BlockASTNode = BasicBlockASTNode | FieldBlockASTNode
