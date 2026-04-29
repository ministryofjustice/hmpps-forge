import { NodeCompilationContext } from './types'

/**
 * Compiles authored function calls and pipelines.
 *
 * The dispatcher owns diagnostics and async decisions, so this class only
 * shapes arguments and feeds function calls back through the shared context.
 */
export default class PipelineNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Threads the previous step result into each pipeline function call.
   */
  compilePipeline(properties: Record<string, unknown>): string {
    let expr = this.ctx.compileOperand(properties.input)
    const steps = (properties.steps ?? []) as Record<string, unknown>[]

    for (const step of steps) {
      const stepProps = (step.properties ?? step) as Record<string, unknown>
      const funcName = stepProps.name as string
      const funcArgs = (stepProps.arguments ?? []) as unknown[]
      const argExprs = funcArgs.map(arg => this.ctx.compileOperand(arg))

      expr = this.ctx.compileFunctionCall(funcName, [expr, ...argExprs], step)
    }

    return expr
  }

  /**
   * Emits a single authored function call with diagnostic source metadata.
   */
  compileFunction(properties: Record<string, unknown>, source?: unknown): string {
    const funcName = properties.name as string
    const funcArgs = (properties.arguments ?? []) as unknown[]
    const argExprs = funcArgs.map(arg => this.ctx.compileOperand(arg))

    return this.ctx.compileFunctionCall(funcName, argExprs, source ?? properties)
  }
}
