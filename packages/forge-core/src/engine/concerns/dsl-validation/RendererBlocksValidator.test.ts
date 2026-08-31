import { z, type ZodType } from 'zod'
import type { FunctionDefinitionObject } from '../../../authoring/types/functions.type'
import type { JourneyDefinition } from '../../../authoring/types/structures.type'
import { blockSchema } from '../../../components/blockSchema'
import type { BlockDefinition } from '../../../components/types/structures.type'
import { ComponentCallType, FunctionEntryType, StructureType } from '../../../shared/taxonomy'
import FunctionDefinitionCatalog from '../../chassis/registries/FunctionDefinitionCatalog'
import ForgeSchemaError from '../../errors/ForgeSchemaError'
import RendererBlocksValidator from './RendererBlocksValidator'

const twoColumnSchema = z.strictObject({
  main: z.array(blockSchema),
  aside: z.array(blockSchema),
})

describe('RendererBlocksValidator', () => {
  describe('validate()', () => {
    it('should accept a structured layout matching an inherited renderer schema', () => {
      // Arrange
      const validator = createValidator(
        createJourney({ main: [createBlock('main')], aside: [createBlock('aside')] }, 'two-column'),
        createRendererDefinitions('two-column', twoColumnSchema),
      )

      // Act / Assert
      expect(() => validator.validate()).not.toThrow()
    })

    it('should reject a structured layout without a custom renderer', () => {
      // Arrange
      const validator = createValidator(createJourney({ main: [createBlock('main')] }))

      // Act / Assert
      expect(() => validator.validate()).toThrow(AggregateError)
    })

    it('should allow a structured layout when its renderer omits blocksSchema', () => {
      // Arrange
      const validator = createValidator(
        createJourney({ main: [createBlock('main')] }, 'unvalidated-layout'),
        createRendererDefinitions('unvalidated-layout'),
      )

      // Act / Assert
      expect(() => validator.validate()).not.toThrow()
    })

    it('should report renderer schema failures at the step blocks path', () => {
      // Arrange
      const validator = createValidator(
        createJourney({ main: [createBlock('main')], unexpected: [] }, 'two-column'),
        createRendererDefinitions('two-column', twoColumnSchema),
      )

      // Act
      const validate = () => validator.validate()

      // Assert
      expect(validate).toThrow(AggregateError)

      try {
        validate()
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)

        if (error instanceof AggregateError) {
          expect(error.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining<Partial<ForgeSchemaError>>({
                formattedPath: 'test-journey > test-step > blocks',
              }),
            ]),
          )
        }
      }
    })

    it('should pass omitted blocks to the renderer schema as undefined', () => {
      // Arrange
      const validator = createValidator(
        createJourney(undefined, 'two-column'),
        createRendererDefinitions('two-column', twoColumnSchema),
      )

      // Act / Assert
      expect(() => validator.validate()).toThrow(AggregateError)
    })

    it('should use a step renderer instead of its inherited renderer', () => {
      // Arrange
      const journey = createJourney([createBlock('flat')], 'two-column')
      const step = journey.steps?.[0]

      if (step !== undefined) {
        step.renderer = {
          _forge: ComponentCallType.BASIC,
          variant: 'flat-layout',
        }
      }

      const validator = createValidator(journey, {
        ...createRendererDefinitions('two-column', twoColumnSchema),
        ...createRendererDefinitions('flat-layout', z.array(blockSchema)),
      })

      // Act / Assert
      expect(() => validator.validate()).not.toThrow()
    })
  })
})

function createValidator(
  journey: JourneyDefinition<unknown>,
  definitions: FunctionDefinitionObject = {},
): RendererBlocksValidator {
  const functionRegistry = new FunctionDefinitionCatalog()

  functionRegistry.register(definitions)

  return new RendererBlocksValidator(journey, functionRegistry)
}

function createRendererDefinitions(name: string, blocksSchema?: ZodType): FunctionDefinitionObject {
  return {
    [name]: {
      name,
      _forge: FunctionEntryType.RENDERER,
      factory: () => () => '',
      ...(blocksSchema === undefined ? {} : { blocksSchema }),
    },
  }
}

function createJourney(blocks: unknown, renderer?: string): JourneyDefinition<unknown> {
  return {
    _forge: StructureType.JOURNEY,
    path: '/test',
    code: 'test-journey',
    title: 'Test journey',
    ...(renderer === undefined
      ? {}
      : {
          renderer: {
            _forge: ComponentCallType.BASIC,
            variant: renderer,
          },
        }),
    steps: [
      {
        _forge: StructureType.STEP,
        path: '/step',
        code: 'test-step',
        title: 'Test step',
        ...(blocks === undefined ? {} : { blocks }),
      },
    ],
  }
}

function createBlock(variant: string): BlockDefinition {
  return {
    _forge: ComponentCallType.BASIC,
    variant,
  }
}
