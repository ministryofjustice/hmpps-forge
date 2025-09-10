import { StructureType, ExpressionType, LogicType, FunctionType, TransitionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { transformJourney, transformStep, transformBlock } from './transformStructures'
import { JourneyASTNode, StepASTNode, BlockASTNode, ASTNode } from '../../types/nodes.type'

describe('Structure Transformations', () => {
  describe('transformJourney()', () => {
    it('should transform a complete journey with all properties', () => {
      const journey = {
        type: StructureType.JOURNEY,
        code: 'assessment',
        title: 'Assessment Journey',
        description: 'A test assessment',
        path: '/assessment',
        version: '1.0',
        controller: 'customController',
        onLoad: [
          {
            type: TransitionType.LOAD,
            effects: [] as any[],
          },
        ],
        onAccess: [
          {
            type: TransitionType.ACCESS,
            guards: {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['data', 'authenticated'] },
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
            },
          },
        ],
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            blocks: [] as any[],
          },
        ],
        children: [
          {
            type: StructureType.JOURNEY,
            code: 'child-journey',
            title: 'Child Journey',
            steps: [] as any[],
          },
        ],
      }

      const result = transformJourney(journey, ['test']) as JourneyASTNode

      expect(result.type).toBe(ASTNodeType.JOURNEY)
      expect(result.properties.get('code')).toBe('assessment')
      expect(result.properties.get('title')).toBe('Assessment Journey')
      expect(result.properties.get('description')).toBe('A test assessment')
      expect(result.properties.get('version')).toBe('1.0')
      expect(result.properties.get('controller')).toBe('customController')

      const steps = result.properties.get('steps') as ASTNode[]
      expect(steps).toHaveLength(1)
      expect(steps[0]).toMatchObject({
        type: ASTNodeType.STEP,
      })

      const children = result.properties.get('children') as ASTNode[]
      expect(children).toHaveLength(1)
      expect(children[0]).toMatchObject({
        type: ASTNodeType.JOURNEY,
      })

      const onLoad = result.properties.get('onLoad') as ASTNode[]
      expect(onLoad).toHaveLength(1)
      expect(onLoad[0]).toMatchObject({
        type: ASTNodeType.TRANSITION,
        transitionType: 'TransitionType.Load',
      })
    })

    it('should handle journey with minimal properties', () => {
      const journey = {
        type: StructureType.JOURNEY,
        code: 'minimal',
        title: 'Minimal Journey',
      }

      const result = transformJourney(journey, ['test']) as JourneyASTNode

      expect(result.type).toBe(ASTNodeType.JOURNEY)
      expect(result.properties.get('code')).toBe('minimal')
      expect(result.properties.get('title')).toBe('Minimal Journey')
      expect(result.properties.get('steps')).toBeUndefined()
      expect(result.properties.get('children')).toBeUndefined()
    })
  })

  describe('transformStep()', () => {
    it('should transform a complete step with all properties', () => {
      const step = {
        type: StructureType.STEP,
        path: '/personal-details',
        blocks: [
          {
            type: StructureType.BLOCK,
            variant: 'text',
            code: 'name',
          },
        ],
        onLoad: [
          {
            type: TransitionType.LOAD,
            effects: [] as any[],
          },
        ],
        onSubmission: [
          {
            type: TransitionType.SUBMIT,
            validate: true,
            onValid: {
              next: [{ type: ExpressionType.NEXT, goto: '/next-step' }],
            },
            onInvalid: {
              next: [{ type: ExpressionType.NEXT, goto: '@self' }],
            },
          },
        ],
        controller: 'stepController',
        template: 'custom-template',
        entry: true,
        checkJourneyTraversal: false,
        backlink: '/previous',
      }

      const result = transformStep(step, ['test']) as StepASTNode

      expect(result.type).toBe(ASTNodeType.STEP)
      expect(result.properties.get('path')).toBe('/personal-details')
      expect(result.properties.get('controller')).toBe('stepController')
      expect(result.properties.get('template')).toBe('custom-template')
      expect(result.properties.get('entry')).toBe(true)
      expect(result.properties.get('checkJourneyTraversal')).toBe(false)
      expect(result.properties.get('backlink')).toBe('/previous')

      const blocks = result.properties.get('blocks') as ASTNode[]
      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toMatchObject({
        type: ASTNodeType.BLOCK,
        variant: 'text',
      })

      const onSubmission = result.properties.get('onSubmission') as ASTNode[]
      expect(onSubmission).toHaveLength(1)
      expect(onSubmission[0]).toMatchObject({
        type: ASTNodeType.TRANSITION,
        transitionType: 'TransitionType.Submit',
      })
    })
  })

  describe('transformBlock()', () => {
    it('should transform a field block', () => {
      const fieldBlock = {
        type: StructureType.BLOCK,
        variant: 'text',
        code: 'username',
        label: 'Username',
        validate: [
          {
            type: ExpressionType.VALIDATION,
            when: {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
              negate: true,
              condition: { type: FunctionType.CONDITION, name: 'isRequired', arguments: [] as any[] },
            },
            message: 'Username is required',
          },
        ],
      }

      const result = transformBlock(fieldBlock, ['test']) as BlockASTNode

      expect(result.type).toBe(ASTNodeType.BLOCK)
      expect(result.variant).toBe('text')
      expect(result.blockType).toBe('field')
      expect(result.properties.get('code')).toBe('username')
      expect(result.properties.get('label')).toBe('Username')

      const validate = result.properties.get('validate') as ASTNode[]
      expect(validate).toHaveLength(1)
      expect(validate[0]).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: 'ExpressionType.Validation',
      })
    })

    it('should transform a collection block', () => {
      const collectionBlock = {
        type: StructureType.BLOCK,
        variant: 'collection',
        template: [
          {
            type: StructureType.BLOCK,
            variant: 'text',
            code: 'item_name',
          },
        ],
        collectionContext: {
          collection: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] },
        },
      }

      const result = transformBlock(collectionBlock, ['test']) as BlockASTNode

      expect(result.type).toBe(ASTNodeType.BLOCK)
      expect(result.variant).toBe('collection')
      expect(result.blockType).toBe('collection')

      const template = result.properties.get('template') as ASTNode[]
      expect(template).toHaveLength(1)
      expect(template[0]).toMatchObject({
        type: ASTNodeType.BLOCK,
        variant: 'text',
      })

      const collectionContext = result.properties.get('collectionContext') as any
      expect(collectionContext.collection).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: 'ExpressionType.Reference',
      })
    })

    it('should transform a composite block', () => {
      const compositeBlock = {
        type: StructureType.BLOCK,
        variant: 'fieldset',
        blocks: [
          {
            type: StructureType.BLOCK,
            variant: 'text',
            code: 'first_name',
          },
          {
            type: StructureType.BLOCK,
            variant: 'text',
            code: 'last_name',
          },
        ],
      }

      const result = transformBlock(compositeBlock, ['test']) as BlockASTNode

      expect(result.type).toBe(ASTNodeType.BLOCK)
      expect(result.variant).toBe('fieldset')
      expect(result.blockType).toBe('composite')

      const blocks = result.properties.get('blocks') as ASTNode[]
      expect(blocks).toHaveLength(2)
      expect(blocks[0]).toMatchObject({
        type: ASTNodeType.BLOCK,
        variant: 'text',
      })
    })
  })
})
