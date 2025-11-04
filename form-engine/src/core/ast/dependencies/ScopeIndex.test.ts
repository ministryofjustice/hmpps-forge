import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import ScopeIndex from '@form-engine/core/ast/dependencies/ScopeIndex'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import { PseudoNodeType, AnswerPseudoNode } from '@form-engine/core/types/pseudoNodes.type'

describe('ScopeIndex', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('getScope', () => {
    it('should return undefined for non-existent node', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const result = scopeIndex.getScope('compile_ast:999')

      expect(result).toBeUndefined()
    })

    it('should return undefined for pseudo node', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const pseudoNode: AnswerPseudoNode = {
        id: 'compile_pseudo:1',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'test',
        },
      }

      registry.register(pseudoNode.id, pseudoNode)

      const result = scopeIndex.getScope(pseudoNode.id)

      expect(result).toBeUndefined()
    })

    it('should return scope with journey for root journey node', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const journey = ASTTestFactory.journey().withId('compile_ast:1').build()

      registry.register(journey.id, journey)

      const result = scopeIndex.getScope(journey.id)

      expect(result).toBeDefined()
      expect(result?.scopeChain).toHaveLength(1)
      expect(result?.scopeChain[0]).toEqual({
        id: journey.id,
        nodeType: ASTNodeType.JOURNEY,
      })
    })

    it('should return scope for field in block', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const journey = ASTTestFactory.journey().withId('compile_ast:1').build()

      const step = ASTTestFactory.step().withId('compile_ast:2').build()

      step.parentNode = journey

      const block = ASTTestFactory.block('text', 'basic').withId('compile_ast:3').build()

      block.parentNode = step

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:4')
        .withProperty('code', 'firstName')
        .build()

      field.parentNode = block

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(block.id, block)
      registry.register(field.id, field)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.scopeChain).toHaveLength(4)
      expect(result?.scopeChain[0]).toEqual({
        id: journey.id,
        nodeType: ASTNodeType.JOURNEY,
      })
      expect(result?.scopeChain[1]).toEqual({
        id: step.id,
        nodeType: ASTNodeType.STEP,
      })
      expect(result?.scopeChain[2]).toEqual({
        id: block.id,
        nodeType: ASTNodeType.BLOCK,
      })
      expect(result?.scopeChain[3]).toEqual({
        id: field.id,
        nodeType: ASTNodeType.BLOCK,
      })
      expect(result?.onLoadChain).toEqual([])
    })

    it('should return scope for field directly in step', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const journey = ASTTestFactory.journey().withId('compile_ast:1').build()

      const step = ASTTestFactory.step().withId('compile_ast:2').build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'email')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.scopeChain).toHaveLength(3)
      expect(result?.scopeChain[0]).toEqual({
        id: journey.id,
        nodeType: ASTNodeType.JOURNEY,
      })
      expect(result?.scopeChain[1]).toEqual({
        id: step.id,
        nodeType: ASTNodeType.STEP,
      })
      expect(result?.scopeChain[2]).toEqual({
        id: field.id,
        nodeType: ASTNodeType.BLOCK,
      })
    })

    it('should collect onLoad transitions from journey', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const onLoadTransition = ASTTestFactory.transition(TransitionType.LOAD).withId('compile_ast:10').build()

      const journey = ASTTestFactory.journey()
        .withId('compile_ast:1')
        .withProperty('onLoad', [onLoadTransition])
        .build()

      const step = ASTTestFactory.step().withId('compile_ast:2').build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'name')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)
      registry.register(onLoadTransition.id, onLoadTransition)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.onLoadChain).toEqual([onLoadTransition.id])
    })

    it('should collect onLoad transitions from step', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const onLoadTransition = ASTTestFactory.transition(TransitionType.LOAD).withId('compile_ast:10').build()

      const journey = ASTTestFactory.journey().withId('compile_ast:1').build()

      const step = ASTTestFactory.step().withId('compile_ast:2').withProperty('onLoad', [onLoadTransition]).build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'address')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)
      registry.register(onLoadTransition.id, onLoadTransition)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.onLoadChain).toEqual([onLoadTransition.id])
    })

    it('should collect onLoad transitions from both journey and step', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const journeyOnLoad = ASTTestFactory.transition(TransitionType.LOAD).withId('compile_ast:10').build()
      const stepOnLoad = ASTTestFactory.transition(TransitionType.LOAD).withId('compile_ast:11').build()

      const journey = ASTTestFactory.journey().withId('compile_ast:1').withProperty('onLoad', [journeyOnLoad]).build()
      const step = ASTTestFactory.step().withId('compile_ast:2').withProperty('onLoad', [stepOnLoad]).build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'phone')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)
      registry.register(journeyOnLoad.id, journeyOnLoad)
      registry.register(stepOnLoad.id, stepOnLoad)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.onLoadChain).toEqual([journeyOnLoad.id, stepOnLoad.id])
    })

    it('should collect multiple onLoad transitions from journey', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const onLoad1 = ASTTestFactory.transition(TransitionType.LOAD).withId('compile_ast:10').build()
      const onLoad2 = ASTTestFactory.transition(TransitionType.LOAD).withId('compile_ast:11').build()

      const journey = ASTTestFactory.journey()
        .withId('compile_ast:1')
        .withProperty('onLoad', [onLoad1, onLoad2])
        .build()

      const step = ASTTestFactory.step().withId('compile_ast:2').build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'data')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)
      registry.register(onLoad1.id, onLoad1)
      registry.register(onLoad2.id, onLoad2)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.onLoadChain).toEqual([onLoad1.id, onLoad2.id])
    })

    it('should handle nested blocks in scope chain', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const journey = ASTTestFactory.journey().withId('compile_ast:1').build()
      const step = ASTTestFactory.step().withId('compile_ast:2').build()
      const outerBlock = ASTTestFactory.block('fieldset', 'basic').withId('compile_ast:3').build()
      const innerBlock = ASTTestFactory.block('text', 'basic').withId('compile_ast:4').build()
      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:5')
        .withProperty('code', 'nested')
        .build()

      step.parentNode = journey
      outerBlock.parentNode = step
      innerBlock.parentNode = outerBlock
      field.parentNode = innerBlock

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(outerBlock.id, outerBlock)
      registry.register(innerBlock.id, innerBlock)
      registry.register(field.id, field)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.scopeChain).toHaveLength(5)
      expect(result?.scopeChain[0]).toEqual({
        id: journey.id,
        nodeType: ASTNodeType.JOURNEY,
      })
      expect(result?.scopeChain[1]).toEqual({
        id: step.id,
        nodeType: ASTNodeType.STEP,
      })
      expect(result?.scopeChain[2]).toEqual({
        id: outerBlock.id,
        nodeType: ASTNodeType.BLOCK,
      })
      expect(result?.scopeChain[3]).toEqual({
        id: innerBlock.id,
        nodeType: ASTNodeType.BLOCK,
      })
      expect(result?.scopeChain[4]).toEqual({
        id: field.id,
        nodeType: ASTNodeType.BLOCK,
      })
    })

    it('should skip non-load transitions in onLoad arrays', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const loadTransition = ASTTestFactory.transition(TransitionType.LOAD).withId('compile_ast:10').build()
      const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT).withId('compile_ast:11').build()

      const journey = ASTTestFactory.journey()
        .withId('compile_ast:1')
        .withProperty('onLoad', [loadTransition, submitTransition])
        .build()

      const step = ASTTestFactory.step().withId('compile_ast:2').build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'mixed')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)
      registry.register(loadTransition.id, loadTransition)
      registry.register(submitTransition.id, submitTransition)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.onLoadChain).toEqual([loadTransition.id])
    })

    it('should handle node with no onLoad property', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const journey = ASTTestFactory.journey().withId('compile_ast:1').build()

      const step = ASTTestFactory.step().withId('compile_ast:2').build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'simple')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.onLoadChain).toEqual([])
    })

    it('should handle node with empty onLoad array', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const journey = ASTTestFactory.journey().withId('compile_ast:1').withProperty('onLoad', []).build()

      const step = ASTTestFactory.step().withId('compile_ast:2').build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'empty')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)

      const result = scopeIndex.getScope(field.id)

      expect(result).toBeDefined()
      expect(result?.onLoadChain).toEqual([])
    })
  })

  describe('getOnLoadChain', () => {
    it('should return empty array for non-existent node', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const result = scopeIndex.getOnLoadChain('compile_ast:999')

      expect(result).toEqual([])
    })

    it('should return empty array for pseudo node', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const pseudoNode: AnswerPseudoNode = {
        id: 'compile_pseudo:1',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'test',
        },
      }

      registry.register(pseudoNode.id, pseudoNode)

      const result = scopeIndex.getOnLoadChain(pseudoNode.id)

      expect(result).toEqual([])
    })

    it('should return onLoad transitions from scope', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const journeyOnLoad = ASTTestFactory.transition(TransitionType.LOAD).withId('compile_ast:10').build()
      const stepOnLoad = ASTTestFactory.transition(TransitionType.LOAD).withId('compile_ast:11').build()

      const journey = ASTTestFactory.journey().withId('compile_ast:1').withProperty('onLoad', [journeyOnLoad]).build()

      const step = ASTTestFactory.step().withId('compile_ast:2').withProperty('onLoad', [stepOnLoad]).build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'test')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)
      registry.register(journeyOnLoad.id, journeyOnLoad)
      registry.register(stepOnLoad.id, stepOnLoad)

      const result = scopeIndex.getOnLoadChain(field.id)

      expect(result).toEqual([journeyOnLoad.id, stepOnLoad.id])
    })

    it('should return empty array for node with no onLoad transitions', () => {
      const registry = new NodeRegistry()
      const scopeIndex = new ScopeIndex(registry)

      const journey = ASTTestFactory.journey().withId('compile_ast:1').build()

      const step = ASTTestFactory.step().withId('compile_ast:2').build()

      step.parentNode = journey

      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3')
        .withProperty('code', 'noOnLoad')
        .build()

      field.parentNode = step

      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(field.id, field)

      const result = scopeIndex.getOnLoadChain(field.id)

      expect(result).toEqual([])
    })
  })
})
