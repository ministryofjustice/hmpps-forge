import { z, type ZodType } from 'zod'
import type { FunctionDefinitionLookup } from '../../../authoring/types/functions.type'
import type { JourneyDefinition, StepDefinition } from '../../../authoring/types/structures.type'
import type { RendererInvocation } from '../../../components/types/renderFunctions.type'
import { FunctionEntryType } from '../../../shared/taxonomy'
import DSLSourceLocator from '../../../shared/diagnostics/DSLSourceLocator'
import type { DSLPathSegment } from '../../../shared/diagnostics/sourceLocation.type'
import ForgeSchemaError from '../../errors/ForgeSchemaError'
import { BlockSchema } from './schemas/structures.schema'

const FlatBlocksSchema = z.array(BlockSchema).optional()

/** Validates each step's block layout against its effective page renderer. */
export default class RendererBlocksValidator {
  private readonly sourceLocator: DSLSourceLocator

  constructor(
    private readonly journeyDefinition: JourneyDefinition<unknown>,
    private readonly functionRegistry: FunctionDefinitionLookup,
  ) {
    this.sourceLocator = new DSLSourceLocator(journeyDefinition)
  }

  validate(): void {
    const errors = this.validateJourney(this.journeyDefinition, undefined, [])

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Renderer block schema validation failed')
    }
  }

  private validateJourney(
    journey: JourneyDefinition<unknown>,
    inheritedRenderer: RendererInvocation | undefined,
    path: readonly DSLPathSegment[],
  ): readonly Error[] {
    const renderer = journey.renderer ?? inheritedRenderer
    const stepErrors = (journey.steps ?? []).flatMap((step, index) =>
      this.validateStep(step, step.renderer ?? renderer, [...path, 'steps', index]),
    )
    const childErrors = (journey.children ?? []).flatMap((child, index) =>
      this.validateJourney(child, renderer, [...path, 'children', index]),
    )

    return [...stepErrors, ...childErrors]
  }

  private validateStep(
    step: StepDefinition<unknown>,
    renderer: RendererInvocation | undefined,
    path: readonly DSLPathSegment[],
  ): readonly Error[] {
    const schema = this.resolveBlocksSchema(renderer)
    const result = schema?.safeParse(step.blocks)

    if (result === undefined || result.success) {
      return []
    }

    return result.error.issues.map(issue => {
      const issuePath = issue.path.map(pathPart => (typeof pathPart === 'symbol' ? pathPart.toString() : pathPart))
      const blockPath = [...path, 'blocks', ...issuePath]

      return new ForgeSchemaError({
        message: issue.message,
        formattedPath: this.sourceLocator.fromPath(blockPath).formattedPath,
        expected: 'expected' in issue && typeof issue.expected === 'string' ? issue.expected : undefined,
        callsite: this.sourceLocator.callsiteFromPath(blockPath),
      })
    })
  }

  private resolveBlocksSchema(renderer: RendererInvocation | undefined): ZodType | undefined {
    if (renderer === undefined) {
      return FlatBlocksSchema
    }

    const definition = this.functionRegistry.get(renderer.variant)

    if (definition?._forge !== FunctionEntryType.RENDERER) {
      return undefined
    }

    return definition.blocksSchema
  }
}
