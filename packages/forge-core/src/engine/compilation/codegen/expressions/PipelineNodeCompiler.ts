import { compileIifeExpression } from './IifeExpressionCompiler'
import { NodeCompilationContext } from './types'

const PIPELINE_VALUE_PARAM = '_forgePipelineValue'

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
    const steps = (properties.steps ?? []) as Record<string, unknown>[]

    return steps.reduce((expr, step) => this.compilePipelineStep(expr, step), this.ctx.compileOperand(properties.input))
  }

  /**
   * Emits one transformer step, treating undefined as an absent piped value.
   */
  private compilePipelineStep(inputExpr: string, step: Record<string, unknown>): string {
    const stepProps = (step.properties ?? step) as Record<string, unknown>
    const funcName = stepProps.name as string
    const funcArgs = (stepProps.arguments ?? []) as unknown[]
    const argExprs = funcArgs.map(arg => this.ctx.compileOperand(arg))
    const callExpr = this.ctx.compileFunctionCall(funcName, [PIPELINE_VALUE_PARAM, ...argExprs], step)

    return this.compileOptionalPipelineCall(inputExpr, callExpr)
  }

  /**
   * Skips transformer evaluation when a pipeline receives no value to transform.
   */
  private compileOptionalPipelineCall(inputExpr: string, callExpr: string): string {
    return compileIifeExpression({
      args: [inputExpr],
      awaitResult: this.ctx.usesAwait,
      isAsync: this.ctx.usesAwait,
      params: [PIPELINE_VALUE_PARAM],
      compileBody: emitter => {
        emitter.if(`${PIPELINE_VALUE_PARAM} === undefined`, () => {
          emitter.return('undefined')
        })

        if (this.ctx.usesAwait) {
          emitter.return(`await (${callExpr})`)
        } else {
          emitter.return(`(${callExpr})`)
        }
      },
    })
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
