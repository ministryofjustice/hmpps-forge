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

    it('should generate sequential IDs for compile pseudo', () => {
      expect(generator.next(NodeIDCategory.COMPILE_PSEUDO)).toBe('compile_pseudo:1')
      expect(generator.next(NodeIDCategory.COMPILE_PSEUDO)).toBe('compile_pseudo:2')
    })

    it('should maintain separate counters per category', () => {
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:1')
      expect(generator.next(NodeIDCategory.COMPILE_PSEUDO)).toBe('compile_pseudo:1')
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:2')
      expect(generator.next(NodeIDCategory.RUNTIME_AST)).toBe('runtime_ast:1')
    })
  })

  describe('getCurrentCount', () => {
    it('should return current counter value', () => {
      generator.next(NodeIDCategory.COMPILE_AST)
      generator.next(NodeIDCategory.COMPILE_AST)

      expect(generator.getCurrentCount(NodeIDCategory.COMPILE_AST)).toBe(2)
      expect(generator.getCurrentCount(NodeIDCategory.COMPILE_PSEUDO)).toBe(0)
    })
  })

  describe('reset', () => {
    it('should reset specific category', () => {
      generator.next(NodeIDCategory.COMPILE_AST)
      generator.next(NodeIDCategory.COMPILE_PSEUDO)

      generator.reset(NodeIDCategory.COMPILE_AST)

      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:1')
      expect(generator.next(NodeIDCategory.COMPILE_PSEUDO)).toBe('compile_pseudo:2')
    })

    it('should reset all categories when no argument', () => {
      generator.next(NodeIDCategory.COMPILE_AST)
      generator.next(NodeIDCategory.COMPILE_PSEUDO)

      generator.reset()

      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:1')
      expect(generator.next(NodeIDCategory.COMPILE_PSEUDO)).toBe('compile_pseudo:1')
    })
  })

  describe('clone', () => {
    it('should create a new generator with the same counter state', () => {
      generator.next(NodeIDCategory.COMPILE_AST)
      generator.next(NodeIDCategory.COMPILE_AST)
      generator.next(NodeIDCategory.COMPILE_PSEUDO)

      const cloned = generator.clone()

      expect(cloned).not.toBe(generator)
      expect(cloned.getCurrentCount(NodeIDCategory.COMPILE_AST)).toBe(2)
      expect(cloned.getCurrentCount(NodeIDCategory.COMPILE_PSEUDO)).toBe(1)
    })

    it('should allow independent counter increments after cloning', () => {
      generator.next(NodeIDCategory.COMPILE_AST)

      const cloned = generator.clone()

      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:2')
      expect(cloned.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:2')
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:3')
      expect(cloned.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:3')

      expect(generator.getCurrentCount(NodeIDCategory.COMPILE_AST)).toBe(3)
      expect(cloned.getCurrentCount(NodeIDCategory.COMPILE_AST)).toBe(3)
    })

    it('should clone all category counters', () => {
      generator.next(NodeIDCategory.COMPILE_AST)
      generator.next(NodeIDCategory.COMPILE_PSEUDO)
      generator.next(NodeIDCategory.RUNTIME_AST)
      generator.next(NodeIDCategory.RUNTIME_PSEUDO)

      const cloned = generator.clone()

      expect(cloned.getCurrentCount(NodeIDCategory.COMPILE_AST)).toBe(1)
      expect(cloned.getCurrentCount(NodeIDCategory.COMPILE_PSEUDO)).toBe(1)
      expect(cloned.getCurrentCount(NodeIDCategory.RUNTIME_AST)).toBe(1)
      expect(cloned.getCurrentCount(NodeIDCategory.RUNTIME_PSEUDO)).toBe(1)
    })

    it('should clone generator with zero counters', () => {
      const cloned = generator.clone()

      expect(cloned.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:1')
      expect(generator.next(NodeIDCategory.COMPILE_AST)).toBe('compile_ast:1')
    })
  })
})
