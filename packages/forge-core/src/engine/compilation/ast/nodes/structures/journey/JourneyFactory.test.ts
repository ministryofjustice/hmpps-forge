import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType, StructureType } from '../../../../../../authoring/types/enums'
import type { JourneyDefinition, StepDefinition } from '../../../../../../authoring/types/structures.type'
import type { BlockDefinition, ResolvableBoolean } from '../../../../../../components/types/structures.type'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { StepASTNode } from '../../../../../contracts/ast/structures.type'
import { NodeFactory } from '../../NodeFactory'
import JourneyFactory from './JourneyFactory'

describe('JourneyFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let journeyFactory: JourneyFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator)
    journeyFactory = new JourneyFactory(nodeIDGenerator, nodeFactory)
  })

  describe('create()', () => {
    it('should create a Journey node with basic properties', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = journeyFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.JOURNEY)
      expect(result.properties.title).toBe('Test Journey')
      expect(result.properties.code).toBe('test-journey')
      expect(result.properties.path).toBe('test-journey')
    })

    it('should transform nested steps using nodeFactory', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            type: StructureType.STEP,
            path: 'step1',
            title: 'step1',
            blocks: [] as BlockDefinition[],
          } satisfies StepDefinition,
          {
            type: StructureType.STEP,
            path: 'step2',
            title: 'step2',
            blocks: [] as BlockDefinition[],
          } satisfies StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act
      const result = journeyFactory.create(json)
      const steps = result.properties.steps as StepASTNode[]

      // Assert
      expect(Array.isArray(steps)).toBe(true)
      expect(steps).toHaveLength(2)
      steps.forEach((step: StepASTNode) => {
        expect(step.type).toBe(ASTNodeType.STEP)
      })
    })

    it('should exclude type from properties', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = journeyFactory.create(json)

      // Assert
      expect('type' in result.properties).toBe(false)
      expect('title' in result.properties).toBe(true)
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result1 = journeyFactory.create(json)
      const result2 = journeyFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should pass through unreachable redirect reachability config', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        reachability: {
          unreachableRedirect: 'frontier',
        },
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = journeyFactory.create(json)

      // Assert
      expect(result.properties.reachability?.unreachableRedirect).toBe('frontier')
    })

    it('should omit resumeWhen from reachability config when set to false', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: false,
        },
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = journeyFactory.create(json)

      // Assert
      expect(result.properties.reachability).toBeDefined()
      expect(result.properties.reachability?.resumeWhen).toBeUndefined()
    })

    it('should create a child node for resumeWhen when set to an expression', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: {
            type: ExpressionType.REFERENCE,
            path: ['data', 'resumeActive'],
          } as unknown as ResolvableBoolean,
        },
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = journeyFactory.create(json)
      const resumeWhen = result.properties.reachability?.resumeWhen

      // Assert
      expect(resumeWhen).not.toBe(true)
      expect(resumeWhen).toMatchObject({ type: ASTNodeType.EXPRESSION, expressionType: ExpressionType.REFERENCE })
    })
  })
})
