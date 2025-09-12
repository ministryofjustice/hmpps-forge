/**
 * Symbol constants for AST node types
 */
export const AST_NODE_SYMBOLS = {
  JOURNEY: Symbol.for('AstNode.Journey'),
  STEP: Symbol.for('AstNode.Step'),
  BLOCK: Symbol.for('AstNode.Block'),
  EXPRESSION: Symbol.for('AstNode.Expression'),
  TRANSITION: Symbol.for('AstNode.Transition'),
} as const

export type ASTNodeSymbol = (typeof AST_NODE_SYMBOLS)[keyof typeof AST_NODE_SYMBOLS]

export const VALID_AST_NODE_SYMBOLS = new Set(Object.values(AST_NODE_SYMBOLS))
