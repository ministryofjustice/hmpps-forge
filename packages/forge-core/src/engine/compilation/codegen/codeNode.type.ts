/**
 * Statement-level nodes for generated source. CodeEmitter builds this tree;
 * SourceRenderer turns it into JavaScript text. Keeping the tree until render
 * time means indentation, comment policy, and source-map positions are render
 * decisions instead of properties baked into concatenated strings.
 */

export enum CodeNodeKind {
  LINE = 'line',
  BLANK_LINE = 'blank-line',
  COMMENT = 'comment',
  BLOCK = 'block',
  TRY_CATCH = 'try-catch',
}

/** One logical line of code; may carry inline position markers, never a newline. */
export interface LineNode {
  readonly kind: CodeNodeKind.LINE
  readonly text: string
}

export interface BlankLineNode {
  readonly kind: CodeNodeKind.BLANK_LINE
}

/** A full comment line; dropped entirely by compact rendering. */
export interface CommentNode {
  readonly kind: CodeNodeKind.COMMENT
  readonly text: string
}

/**
 * An indented region. `open`/`close` carry the brace lines (`if (x) {` / `}`);
 * both stay undefined for pure indentation regions opened via
 * `CodeEmitter.indent()`, where the surrounding lines are emitted separately.
 */
export interface BlockNode {
  readonly kind: CodeNodeKind.BLOCK
  readonly open?: string
  readonly close?: string
  readonly body: CodeNode[]
}

/** A try/catch with the cuddled `} catch (error) {` join line. */
export interface TryCatchNode {
  readonly kind: CodeNodeKind.TRY_CATCH
  readonly tryBody: CodeNode[]
  readonly errorName: string
  readonly catchBody: CodeNode[]
}

export type CodeNode = LineNode | BlankLineNode | CommentNode | BlockNode | TryCatchNode
