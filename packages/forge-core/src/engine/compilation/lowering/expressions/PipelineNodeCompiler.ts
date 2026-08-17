import { Code, code, literal } from '../../codegen/Code'
import Name from '../../codegen/Name'
import { compileIifeExpression } from './IifeExpressionCompiler'
import { NodeCompilationContext } from './types'

const PIPELINE_VALUE_PARAM = new Name('_forgePipelineValue')

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
  compilePipeline(properties: Record<string, unknown>): Code {
    const steps = (properties.steps ?? []) as Record<string, unknown>[]

    return steps.reduce<Code>(
      (expr, step) => this.compilePipelineStep(expr, step),
      this.ctx.compileOperandCode(properties.input),
    )
  }

  /**
   * Emits one transformer step, treating undefined as an absent piped value.
   */
  private compilePipelineStep(inputExpr: Code, step: Record<string, unknown>): Code {
    const stepProps = (step.properties ?? step) as Record<string, unknown>
    const funcName = stepProps.name as string
    const funcArgs = (stepProps.arguments ?? []) as unknown[]
    const argExprs = funcArgs.map(arg => this.ctx.compileOperandCode(arg))
    const callExpr = this.ctx.compileFunctionCallCode(funcName, [code`${PIPELINE_VALUE_PARAM}`, ...argExprs], step)

    return this.compileOptionalPipelineCall(inputExpr, callExpr)
  }

  /**
   * Skips transformer evaluation when a pipeline receives no value to transform.
   */
  private compileOptionalPipelineCall(inputExpr: Code, callExpr: Code): Code {
    return compileIifeExpression({
      args: [inputExpr],
      awaitResult: () => this.ctx.usesAwait,
      generator: this.ctx.generator,
      isAsync: () => this.ctx.usesAwait,
      name: 'transform_pipeline_value',
      params: [PIPELINE_VALUE_PARAM.value],
      compileBody: (generator, [pipelineValue]) => {
        generator.if(code`${pipelineValue} === undefined`, () => {
          generator.return(literal(undefined))
        })

        if (this.ctx.usesAwait) {
          generator.return(code`await (${callExpr})`)
        } else {
          generator.return(code`(${callExpr})`)
        }
      },
    })
  }

  /**
   * Emits a single authored function call with diagnostic source metadata.
   */
  compileFunction(properties: Record<string, unknown>, source?: unknown): Code {
    const funcName = properties.name as string
    const funcArgs = (properties.arguments ?? []) as unknown[]
    const argExprs = funcArgs.map(arg => this.ctx.compileOperandCode(arg))

    return this.ctx.compileFunctionCallCode(funcName, argExprs, source ?? properties)
  }
}
