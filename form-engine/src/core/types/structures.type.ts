import { ASTNodeType } from '@form-engine/core/types/enums'
import { ASTNode } from '@form-engine/core/types/engine.type'

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
