import { NodeIDGenerator, NodeIDCategory } from './NodeIDGenerator'

describe('IdGenerator', () => {
  let generator: NodeIDGenerator

  beforeEach(() => {
    generator = new NodeIDGenerator()
  })

  describe('next', () => {
    it('should generate sequential IDs for compile AST', () => {
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:1')
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:2')
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:3')
    })

    it('should maintain separate counters per category', () => {
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:1')
      expect(generator.next(NodeIDCategory.TEMPLATE)).toBe('template:1')
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:2')
      expect(generator.next(NodeIDCategory.TEMPLATE)).toBe('template:2')
    })
  })

  describe('clone', () => {
    it('should create a new generator with the same counter state', () => {
      generator.next(NodeIDCategory.COMPILE_AST)
      generator.next(NodeIDCategory.COMPILE_AST)
      generator.next(NodeIDCategory.TEMPLATE)

      const cloned = generator.clone()

      expect(cloned).not.toBe(generator)
      expect(cloned.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:3')
      expect(cloned.next(NodeIDCategory.TEMPLATE)).toBe('template:2')
    })

    it('should allow independent counter increments after cloning', () => {
      generator.next(NodeIDCategory.COMPILE_AST)

      const cloned = generator.clone()

      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:2')
      expect(cloned.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:2')
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:3')
      expect(cloned.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:3')
    })

    it('should clone generator with zero counters', () => {
      const cloned = generator.clone()

      expect(cloned.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:1')
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:1')
    })
  })
})
