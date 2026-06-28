import { NodeIDGenerator } from './NodeIDGenerator'

describe('NodeIDGenerator', () => {
  let generator: NodeIDGenerator

  beforeEach(() => {
    generator = new NodeIDGenerator()
  })

  describe('nextAstNodeId()', () => {
    it('should generate sequential IDs for compile AST nodes', () => {
      expect(generator.nextAstNodeId()).toBe('compile_ast:1')
      expect(generator.nextAstNodeId()).toBe('compile_ast:2')
      expect(generator.nextAstNodeId()).toBe('compile_ast:3')
    })
  })

  describe('nextTemplateNodeId()', () => {
    it('should generate sequential IDs for template nodes', () => {
      expect(generator.nextTemplateNodeId()).toBe('template:1')
      expect(generator.nextTemplateNodeId()).toBe('template:2')
      expect(generator.nextTemplateNodeId()).toBe('template:3')
    })

    it('should maintain separate counters from compile AST nodes', () => {
      expect(generator.nextAstNodeId()).toBe('compile_ast:1')
      expect(generator.nextTemplateNodeId()).toBe('template:1')
      expect(generator.nextAstNodeId()).toBe('compile_ast:2')
      expect(generator.nextTemplateNodeId()).toBe('template:2')
    })
  })

  describe('clone', () => {
    it('should create a new generator with the same counter state', () => {
      generator.nextAstNodeId()
      generator.nextAstNodeId()
      generator.nextTemplateNodeId()

      const cloned = generator.clone()

      expect(cloned).not.toBe(generator)
      expect(cloned.nextAstNodeId()).toBe('compile_ast:3')
      expect(cloned.nextTemplateNodeId()).toBe('template:2')
    })

    it('should allow independent counter increments after cloning', () => {
      generator.nextAstNodeId()

      const cloned = generator.clone()

      expect(generator.nextAstNodeId()).toBe('compile_ast:2')
      expect(cloned.nextAstNodeId()).toBe('compile_ast:2')
      expect(generator.nextAstNodeId()).toBe('compile_ast:3')
      expect(cloned.nextAstNodeId()).toBe('compile_ast:3')
    })

    it('should clone generator with zero counters', () => {
      const cloned = generator.clone()

      expect(cloned.nextAstNodeId()).toBe('compile_ast:1')
      expect(generator.nextAstNodeId()).toBe('compile_ast:1')
    })
  })
})
