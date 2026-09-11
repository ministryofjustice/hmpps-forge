import type { PipelineValue, FunctionValue } from '../../../contracts/models/authoredValue.type'
import { CodeFragment, code } from '../codegen/fragments/CodeFragment'
import IdentifierName from '../codegen/fragments/IdentifierName'
import { NodeCompilationContext } from './types'

/**
 * Compiles authored function calls and pipelines (chains of transformers
 * where each step receives the previous step's result).
 *
 * The `ExpressionDispatcher` owns diagnostics and await tracking, so this
 * class only shapes arguments and feeds function calls back through it.
 */
export default class PipelineNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Threads the previous step result into each pipeline function call.
   */
  compilePipeline(properties: PipelineValue): CodeFragment {
    const steps = properties.steps
    const value = this.ctx.generator.let('pipelineValue', this.ctx.compileValueCode(properties.input))

    steps.forEach(step => this.compilePipelineStep(value, step))

    return code`${value}`
  }

  /**
   * Compiles one transformer step, treating `undefined` as "no value was
   * passed through the pipeline".
   */
  private compilePipelineStep(value: IdentifierName, step: FunctionValue): void {
    const funcName = step.name
    const funcArgs = step.arguments
    this.ctx.generator.if(code`${value} !== undefined`, () => {
      const argExprs = funcArgs.map(arg => this.ctx.compileValueCode(arg))
      const callResult = this.ctx.compileFunctionCallCode(funcName, [code`${value}`, ...argExprs], step.source, {
        argumentPrefixes: ['pipelineValue', ...funcArgs.map((_, index) => `functionArgument${index + 1}`)],
      })

      this.ctx.generator.assign(value, callResult)
    })
  }

  /**
   * Compiles a standalone function call (condition, transformer, or generator)
   * with diagnostic source metadata for runtime error reporting.
   */
  compileFunction(properties: FunctionValue): CodeFragment {
    const funcName = properties.name
    const funcArgs = properties.arguments
    const argExprs = funcArgs.map(arg => this.ctx.compileValueCode(arg))

    return this.ctx.compileFunctionCallCode(funcName, argExprs, properties.source, {
      argumentPrefixes: funcArgs.map((_, index) => `functionArgument${index + 1}`),
    })
  }
}
