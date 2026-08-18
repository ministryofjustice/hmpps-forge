import { CodeFragment, code, literal } from '../codegen/fragments/CodeFragment'
import IdentifierName from '../codegen/fragments/IdentifierName'
import { compileIifeExpression } from './IifeExpressionCompiler'
import { NodeCompilationContext } from './types'

const PIPELINE_VALUE_PARAM = new IdentifierName('_forgePipelineValue')

/**
 * Compiles authored function calls and pipelines (chains of transformers
 * where each step receives the previous step's result).
 *
 * The `ExpressionDispatcher` owns diagnostics and async decisions, so this
 * class only shapes arguments and feeds function calls back through it.
 */
export default class PipelineNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Threads the previous step result into each pipeline function call.
   */
  compilePipeline(properties: Record<string, unknown>): CodeFragment {
    const steps = (properties.steps ?? []) as Record<string, unknown>[]

    return steps.reduce<CodeFragment>(
      (expr, step) => this.compilePipelineStep(expr, step),
      this.ctx.compileOperandCode(properties.input),
    )
  }

  /**
   * Compiles one transformer step, treating `undefined` as "no value was
   * passed through the pipeline".
   */
  private compilePipelineStep(inputExpr: CodeFragment, step: Record<string, unknown>): CodeFragment {
    const stepProps = (step.properties ?? step) as Record<string, unknown>
    const funcName = stepProps.name as string
    const funcArgs = (stepProps.arguments ?? []) as unknown[]
    // The step call lands inside the transform IIFE and references its
    // pipeline-value parameter, so nothing here may hoist out of that scope.
    const callExpr = this.ctx.withoutCallHoisting(() => {
      const argExprs = funcArgs.map(arg => this.ctx.compileOperandCode(arg))

      return this.ctx.compileFunctionCallCode(funcName, [code`${PIPELINE_VALUE_PARAM}`, ...argExprs], step, {
        argumentPrefixes: ['pipelineValue', ...funcArgs.map((_, index) => `functionArgument${index + 1}`)],
      })
    })

    return this.compileOptionalPipelineCall(inputExpr, callExpr)
  }

  /**
   * Skips transformer evaluation when a pipeline receives no value to transform.
   */
  private compileOptionalPipelineCall(inputExpr: CodeFragment, callExpr: CodeFragment): CodeFragment {
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
