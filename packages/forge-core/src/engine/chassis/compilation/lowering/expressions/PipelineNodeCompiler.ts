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
  compilePipeline(properties: Record<string, unknown>): CodeFragment {
    const steps = (properties.steps ?? []) as Record<string, unknown>[]
    const value = this.ctx.generator.let('pipelineValue', this.ctx.compileOperandCode(properties.input))

    steps.forEach(step => this.compilePipelineStep(value, step))

    return code`${value}`
  }

  /**
   * Compiles one transformer step, treating `undefined` as "no value was
   * passed through the pipeline".
   */
  private compilePipelineStep(value: IdentifierName, step: Record<string, unknown>): void {
    const stepProps = (step.properties ?? step) as Record<string, unknown>
    const funcName = stepProps.name as string
    const funcArgs = (stepProps.arguments ?? []) as unknown[]
    this.ctx.generator.if(code`${value} !== undefined`, () => {
      const argExprs = funcArgs.map(arg => this.ctx.compileOperandCode(arg))
      const callResult = this.ctx.compileFunctionCallCode(funcName, [code`${value}`, ...argExprs], step, {
        argumentPrefixes: ['pipelineValue', ...funcArgs.map((_, index) => `functionArgument${index + 1}`)],
      })

      this.ctx.generator.assign(value, callResult)
    })
  }

  /**
   * Compiles a standalone function call (condition, transformer, or generator)
   * with diagnostic source metadata for runtime error reporting.
   */
  compileFunction(properties: Record<string, unknown>, source?: unknown): CodeFragment {
    const funcName = properties.name as string
    const funcArgs = (properties.arguments ?? []) as unknown[]
    const argExprs = funcArgs.map(arg => this.ctx.compileOperandCode(arg))

    return this.ctx.compileFunctionCallCode(funcName, argExprs, source ?? properties, {
      argumentPrefixes: funcArgs.map((_, index) => `functionArgument${index + 1}`),
    })
  }
}
