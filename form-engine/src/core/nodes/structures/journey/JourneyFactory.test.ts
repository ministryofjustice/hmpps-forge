import { ASTNodeType } from '@form-engine/core/types/enums'
import { StructureType } from '@form-engine/form/types/enums'
import type { BlockDefinition, JourneyDefinition, StepDefinition } from '@form-engine/form/types/structures.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import JourneyFactory from './JourneyFactory'

describe('JourneyFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let journeyFactory: JourneyFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    journeyFactory = new JourneyFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
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
      expect(result.raw).toBe(json)
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
  })
})
