import { Code } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import Name from '../../codegen/Name'

export interface IteratorScopeFrame {
  readonly itemVar: Name
  readonly indexVar: Name
  readonly inputLengthExpr: Code | Name
  readonly rawItemExpr: Code | Name
}

export interface NodeCompilationContext {
  compileOperandCode(value: unknown): Code
  compileFunctionCallCode(funcName: string, argExprs: readonly Code[], source?: unknown): Code
  namespaceToCtxCode(namespace: string): Code
  readonly generator: CodeGenerator
  readonly iteratorStack: readonly IteratorScopeFrame[]
  readonly selfCodeExpr: Code | undefined

  /**
   * Indicates that the generated expression body has async dependencies.
   *
   * Expression compilers use this to emit awaitable wrappers while preserving
   * the same expression-shaped contract for sync and async source.
   */
  readonly usesAwait: boolean
}
