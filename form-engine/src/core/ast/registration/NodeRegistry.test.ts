import { ASTNodeType } from '@form-engine/core/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType } from '@form-engine/form/types/enums'
import NodeRegistry from './NodeRegistry'

describe('NodeRegistry', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = new NodeRegistry()
  })

  describe('register', () => {
    it('should register a node with ID and path', () => {
      const node = ASTTestFactory.block('TextField', 'field').withId('compile_ast:1').build()

      registry.register('compile_ast:1', node, ['steps', 0, 'blocks', 0])

      expect(registry.has('compile_ast:1')).toBe(true)
      expect(registry.get('compile_ast:1')).toBe(node)
    })

    it('should register a node with empty path when path not provided', () => {
      const node = ASTTestFactory.block('TextField', 'field').withId('compile_ast:1').build()

      registry.register('compile_ast:1', node)

      const entry = registry.getEntry('compile_ast:1')
      expect(entry?.path).toEqual([])
    })

    it('should throw error when registering duplicate ID', () => {
      const node1 = ASTTestFactory.block('TextField', 'field').build()
      const node2 = ASTTestFactory.block('TextField', 'field').build()

      registry.register('compile_ast:1', node1)

      expect(() => registry.register('compile_ast:1', node2)).toThrow(
        'Node with ID "compile_ast:1" is already registered',
      )
    })
  })

  describe('get', () => {
    it('should retrieve a registered node by ID', () => {
      const node = ASTTestFactory.block('TextField', 'field').build()
      registry.register('compile_ast:1', node)

      const retrieved = registry.get('compile_ast:1')
      expect(retrieved).toBe(node)
    })

    it('should return undefined for non-existent ID', () => {
      const retrieved = registry.get('compile_ast:999')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('getEntry', () => {
    it('should retrieve node entry with path', () => {
      const node = ASTTestFactory.block('TextField', 'field').build()
      const path = ['steps', 0, 'blocks', 1]
      registry.register('compile_ast:1', node, path)

      const entry = registry.getEntry('compile_ast:1')
      expect(entry).toEqual({
        node,
        path,
      })
    })

    it('should return undefined for non-existent ID', () => {
      const entry = registry.getEntry('compile_ast:999')
      expect(entry).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for registered ID', () => {
      const node = ASTTestFactory.block('TextField', 'field').build()
      registry.register('compile_ast:1', node)

      expect(registry.has('compile_ast:1')).toBe(true)
    })

    it('should return false for non-existent ID', () => {
      expect(registry.has('compile_ast:999')).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return all registered nodes as a Map', () => {
      const node1 = ASTTestFactory.block('TextField', 'field').withCode('field1').build()
      const node2 = ASTTestFactory.block('TextField', 'field').withCode('field2').build()
      const node3 = ASTTestFactory.step().build()

      registry.register('compile_ast:1', node1)
      registry.register('compile_ast:2', node2)
      registry.register('compile_ast:3', node3)

      const allNodes = registry.getAll()

      expect(allNodes.size).toBe(3)
      expect(allNodes.get('compile_ast:1')).toBe(node1)
      expect(allNodes.get('compile_ast:2')).toBe(node2)
      expect(allNodes.get('compile_ast:3')).toBe(node3)
    })

    it('should return empty Map when no nodes registered', () => {
      const allNodes = registry.getAll()
      expect(allNodes.size).toBe(0)
    })

    it('should return a new Map instance', () => {
      const node = ASTTestFactory.block('TextField', 'field').build()
      registry.register('compile_ast:1', node)

      const map1 = registry.getAll()
      const map2 = registry.getAll()

      expect(map1).not.toBe(map2)
      expect(map1).toEqual(map2)
    })
  })

  describe('getAllEntries', () => {
    it('should return all entries with paths', () => {
      const node1 = ASTTestFactory.block('TextField', 'field').build()
      const node2 = ASTTestFactory.step().build()

      registry.register('compile_ast:1', node1, ['blocks', 0])
      registry.register('compile_ast:2', node2, ['steps', 0])

      const allEntries = registry.getAllEntries()

      expect(allEntries.size).toBe(2)
      expect(allEntries.get('compile_ast:1')).toEqual({ node: node1, path: ['blocks', 0] })
      expect(allEntries.get('compile_ast:2')).toEqual({ node: node2, path: ['steps', 0] })
    })

    it('should return a new Map instance', () => {
      const node = ASTTestFactory.block('TextField', 'field').build()
      registry.register('compile_ast:1', node, ['test'])

      const map1 = registry.getAllEntries()
      const map2 = registry.getAllEntries()

      expect(map1).not.toBe(map2)
      expect(map1).toEqual(map2)
    })
  })

  describe('getIds', () => {
    it('should return array of all registered IDs', () => {
      const node1 = ASTTestFactory.block('TextField', 'field').build()
      const node2 = ASTTestFactory.step().build()
      const node3 = ASTTestFactory.journey().build()

      registry.register('compile_ast:5', node1)
      registry.register('compile_ast:10', node2)
      registry.register('compile_ast:15', node3)

      const ids = registry.getIds()

      expect(ids).toEqual(['compile_ast:5', 'compile_ast:10', 'compile_ast:15'])
    })

    it('should return empty array when no nodes registered', () => {
      const ids = registry.getIds()
      expect(ids).toEqual([])
    })
  })

  describe('size', () => {
    it('should return count of registered nodes', () => {
      expect(registry.size()).toBe(0)

      const node1 = ASTTestFactory.block('TextField', 'field').build()
      registry.register('compile_ast:1', node1)
      expect(registry.size()).toBe(1)

      const node2 = ASTTestFactory.step().build()
      registry.register('compile_ast:2', node2)
      expect(registry.size()).toBe(2)
    })
  })

  describe('findByType', () => {
    it('should find all nodes of specified type', () => {
      const block1 = ASTTestFactory.block('TextField', 'field').build()
      const block2 = ASTTestFactory.block('RadioInput', 'field').build()
      const step = ASTTestFactory.step().build()
      const journey = ASTTestFactory.journey().build()
      const expr = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      registry.register('compile_ast:1', block1)
      registry.register('compile_ast:2', block2)
      registry.register('compile_ast:3', step)
      registry.register('compile_ast:4', journey)
      registry.register('compile_ast:5', expr)

      const blocks = registry.findByType(ASTNodeType.BLOCK)
      expect(blocks).toHaveLength(2)
      expect(blocks).toContain(block1)
      expect(blocks).toContain(block2)

      const steps = registry.findByType(ASTNodeType.STEP)
      expect(steps).toHaveLength(1)
      expect(steps).toContain(step)

      const expressions = registry.findByType(ASTNodeType.EXPRESSION)
      expect(expressions).toHaveLength(1)
      expect(expressions).toContain(expr)
    })

    it('should return empty array when no nodes of type exist', () => {
      const block = ASTTestFactory.block('TextField', 'field').build()
      registry.register('compile_ast:1', block)

      const journeys = registry.findByType(ASTNodeType.JOURNEY)
      expect(journeys).toEqual([])
    })

    it('should return empty array when registry is empty', () => {
      const results = registry.findByType(ASTNodeType.BLOCK)
      expect(results).toEqual([])
    })
  })

  describe('findBy', () => {
    it('should find nodes matching predicate', () => {
      const block1 = ASTTestFactory.block('TextField', 'field').withCode('firstName').withId('compile_ast:1').build()
      const block2 = ASTTestFactory.block('TextField', 'field').withCode('lastName').withId('compile_ast:2').build()
      const block3 = ASTTestFactory.block('RadioInput', 'field').withCode('choice').withId('compile_ast:3').build()

      registry.register('compile_ast:1', block1)
      registry.register('compile_ast:2', block2)
      registry.register('compile_ast:3', block3)

      // Find all TextField blocks
      const textFields = registry.findBy(
        node => node.type === ASTNodeType.BLOCK && (node as any).variant === 'TextField',
      )
      expect(textFields).toHaveLength(2)
      expect(textFields).toContain(block1)
      expect(textFields).toContain(block2)
    })

    it('should return empty array when no nodes match', () => {
      const block = ASTTestFactory.block('TextField', 'field').build()
      registry.register('compile_ast:1', block)

      const results = registry.findBy(node => node.type === ASTNodeType.JOURNEY)
      expect(results).toEqual([])
    })

    it('should return empty array when registry is empty', () => {
      const results = registry.findBy(() => true)
      expect(results).toEqual([])
    })

    it('should work with complex predicates', () => {
      const block1 = ASTTestFactory.block('TextField', 'field').withCode('email').withLabel('Email Address').build()
      const block2 = ASTTestFactory.block('TextField', 'field').withCode('phone').withLabel('Phone Number').build()

      registry.register('compile_ast:1', block1)
      registry.register('compile_ast:2', block2)

      // Find blocks with "Email" in their label
      const emailFields = registry.findBy(node => {
        if (node.type !== ASTNodeType.BLOCK) return false
        const label = (node as any).properties?.get('label')
        return label && label.includes('Email')
      })

      expect(emailFields).toHaveLength(1)
      expect(emailFields[0]).toBe(block1)
    })
  })
})
