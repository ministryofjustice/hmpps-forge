import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  StructuralContext,
  structuralTraverse,
  StructuralTraverseOptions,
  StructuralVisitor,
  VisitorResult,
  StructuralVisitResult,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType } from '@form-engine/form/types/enums'

describe('StructuralTraverser', () => {
  const createVisitorMocks = () => ({
    enterNode: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['enterNode']>>,
    exitNode: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['exitNode']>>,
    enterArray: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['enterArray']>>,
    exitArray: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['exitArray']>>,
    enterElement: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['enterElement']>>,
    exitElement: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['exitElement']>>,
    enterProperty: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['enterProperty']>>,
    exitProperty: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['exitProperty']>>,
    visitPrimitive: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['visitPrimitive']>>,
    visitObject: jest.fn() as jest.MockedFunction<NonNullable<StructuralVisitor['visitObject']>>,
  })

  const createComplexTree = (): ASTNode => {
    const journey = ASTTestFactory.journey().withId('compile_ast:1').build()
    const step1 = ASTTestFactory.step().withId('compile_ast:2').build()
    const step2 = ASTTestFactory.step().withId('compile_ast:3').build()
    const block1 = ASTTestFactory.block('testVariant', 'basic').withId('compile_ast:4').build()
    const block2 = ASTTestFactory.block('testVariant', 'basic').withId('compile_ast:5').build()
    const expr1 = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:6').build()

    block1.properties.expression = expr1
    block1.properties.data = { key: 'value' }
    block2.properties.items = ['item1', 'item2']

    step1.properties.blocks = [block1, block2]
    step2.properties.title = 'Step 2 Title'

    journey.properties.steps = [step1, step2]
    journey.properties.metadata = { version: '1.0' }

    return journey
  }

  describe('basic traversal', () => {
    it('should traverse AST nodes', () => {
      const node = ASTTestFactory.step().withId('compile_ast:7').build()
      const visitor = createVisitorMocks()

      structuralTraverse(node, visitor)

      expect(visitor.enterNode).toHaveBeenCalledWith(node, expect.any(Object))
      expect(visitor.exitNode).toHaveBeenCalledWith(node, expect.any(Object))
    })

    it('should traverse arrays in node properties', () => {
      const node = ASTTestFactory.step().withId('compile_ast:8').build()
      const block1 = ASTTestFactory.block('testVariant', 'basic').withId('compile_ast:9').build()
      const block2 = ASTTestFactory.block('testVariant', 'basic').withId('compile_ast:10').build()
      const blocks = [block1, block2]

      node.properties.blocks = blocks

      const visitor = createVisitorMocks()
      structuralTraverse(node, visitor)

      expect(visitor.enterArray).toHaveBeenCalled()
      expect(visitor.enterElement).toHaveBeenCalledTimes(2)
      expect(visitor.enterNode).toHaveBeenCalledTimes(3) // step + 2 blocks
    })

    it('should traverse object properties', () => {
      const node = ASTTestFactory.block('TextInput', 'basic').withId('compile_ast:11').build()

      node.properties.key1 = 'value1'
      node.properties.key2 = 'value2'

      const visitor = createVisitorMocks()
      structuralTraverse(node, visitor)

      expect(visitor.enterProperty).toHaveBeenCalled()
      expect(visitor.visitPrimitive).toHaveBeenCalled()
    })

    it('should traverse nested structures', () => {
      const tree = createComplexTree()
      const visitor = createVisitorMocks()

      structuralTraverse(tree, visitor)

      // Journey, 2 steps, 2 blocks, 1 expression = 6 nodes
      expect(visitor.enterNode).toHaveBeenCalledTimes(6)
    })

    it('should handle mixed node/array/object traversal', () => {
      const tree = createComplexTree()
      const visitor = createVisitorMocks()

      structuralTraverse(tree, visitor)

      expect(visitor.enterNode).toHaveBeenCalled() // Nodes
      expect(visitor.enterArray).toHaveBeenCalled() // Arrays
      expect(visitor.visitObject).toHaveBeenCalled() // Plain objects
      expect(visitor.visitPrimitive).toHaveBeenCalled() // Primitives
    })
  })

  describe('visitor hooks', () => {
    it('should call enter and exit hooks for nodes', () => {
      const node = ASTTestFactory.journey().withId('compile_ast:12').build()
      const visitor = createVisitorMocks()

      structuralTraverse(node, visitor)

      expect(visitor.enterNode).toHaveBeenCalledWith(node, expect.any(Object))
      expect(visitor.exitNode).toHaveBeenCalledWith(node, expect.any(Object))
    })

    it('should call hooks in correct order', () => {
      const node = ASTTestFactory.step().withId('compile_ast:13').build()
      const child = ASTTestFactory.block('testVariant', 'basic').withId('compile_ast:14').build()

      node.properties.blocks = [child]

      const order: string[] = []
      const visitor: StructuralVisitor = {
        enterNode: () => {
          order.push('enterNode')
          return StructuralVisitResult.CONTINUE
        },
        exitNode: () => {
          order.push('exitNode')
          return StructuralVisitResult.CONTINUE
        },
        enterProperty: () => {
          order.push('enterProperty')
          return StructuralVisitResult.CONTINUE
        },
        exitProperty: () => {
          order.push('exitProperty')
          return StructuralVisitResult.CONTINUE
        },
        enterArray: () => {
          order.push('enterArray')
          return StructuralVisitResult.CONTINUE
        },
        exitArray: () => {
          order.push('exitArray')
          return StructuralVisitResult.CONTINUE
        },
        enterElement: () => {
          order.push('enterElement')
          return StructuralVisitResult.CONTINUE
        },
        exitElement: () => {
          order.push('exitElement')
          return StructuralVisitResult.CONTINUE
        },
      }

      structuralTraverse(node, visitor)

      expect(order).toEqual([
        'enterNode', // parent node
        'enterProperty', // blocks property
        'enterArray', // blocks array
        'enterElement', // first element
        'enterNode', // child node
        'exitNode', // child node
        'exitElement', // first element
        'exitArray', // blocks array
        'exitProperty', // blocks property
        'exitNode', // parent node
      ])
    })

    it('should call array hooks correctly', () => {
      const arr = [1, 2, 3]
      const visitor = createVisitorMocks()

      structuralTraverse(arr, visitor)

      expect(visitor.enterArray).toHaveBeenCalledWith(
        arr,
        expect.objectContaining({
          type: 'array',
          path: [],
          depth: 0,
        }),
      )

      expect(visitor.enterElement).toHaveBeenCalledTimes(3)
      expect(visitor.exitArray).toHaveBeenCalledWith(arr, expect.any(Object))
    })

    it('should call property hooks for node properties', () => {
      const node = ASTTestFactory.step().withId('compile_ast:15').build()

      node.properties.title = 'Test Step'

      const visitor = createVisitorMocks()
      structuralTraverse(node, visitor)

      expect(visitor.enterProperty).toHaveBeenCalledWith(
        'title',
        'Test Step',
        expect.objectContaining({
          type: 'property',
          key: 'title',
          parent: node,
          parentType: 'node',
        }),
      )
    })

    it('should call property hooks for object properties', () => {
      const obj = { foo: 'bar', num: 42 }
      const visitor = createVisitorMocks()

      structuralTraverse(obj, visitor)

      expect(visitor.enterProperty).toHaveBeenCalledWith(
        'foo',
        'bar',
        expect.objectContaining({
          type: 'property',
          key: 'foo',
          parent: obj,
          parentType: 'object',
        }),
      )
    })
  })

  describe('context metadata', () => {
    it('should provide correct path information', () => {
      const tree = createComplexTree()
      const paths: Array<{ path: (string | number)[]; value: any }> = []

      const visitor: StructuralVisitor = {
        enterNode: (node, ctx) => {
          paths.push({ path: ctx.path, value: node.id })
          return StructuralVisitResult.CONTINUE
        },
      }

      structuralTraverse(tree, visitor)

      expect(paths.find(p => p.value === 'compile_ast:1')?.path).toEqual([])
      expect(paths.find(p => p.value === 'compile_ast:2')?.path).toEqual(['steps', 0])
      expect(paths.find(p => p.value === 'compile_ast:4')?.path).toEqual(['steps', 0, 'blocks', 0])
      expect(paths.find(p => p.value === 'compile_ast:6')?.path).toEqual(['steps', 0, 'blocks', 0, 'expression'])
    })

    it('should provide correct depth information', () => {
      const tree = createComplexTree()
      const depths: Array<{ depth: number; id?: string | number }> = []

      const visitor: StructuralVisitor = {
        enterNode: (node, ctx) => {
          depths.push({ depth: ctx.depth, id: node.id })
          return StructuralVisitResult.CONTINUE
        },
      }

      structuralTraverse(tree, visitor)

      expect(depths.find(d => d.id === 'compile_ast:1')?.depth).toBe(0)
      expect(depths.find(d => d.id === 'compile_ast:2')?.depth).toBe(2) // Through property and array
      expect(depths.find(d => d.id === 'compile_ast:4')?.depth).toBe(4) // Deeper nesting
      expect(depths.find(d => d.id === 'compile_ast:6')?.depth).toBe(5) // Through property
    })

    it('should provide sibling information', () => {
      const arr = ['first', 'middle', 'last']
      const contexts: StructuralContext[] = []

      const visitor: StructuralVisitor = {
        visitPrimitive: (_, ctx) => {
          contexts.push(ctx)
          return StructuralVisitResult.CONTINUE
        },
      }

      structuralTraverse(arr, visitor)

      expect(contexts[0]).toMatchObject({
        siblings: arr,
        siblingIndex: 0,
        isFirst: true,
        isLast: false,
      })

      expect(contexts[2]).toMatchObject({
        siblingIndex: 2,
        isFirst: false,
        isLast: true,
      })
    })

    it('should provide parent references', () => {
      const parent = ASTTestFactory.step().withId('compile_ast:16').build()
      const child = ASTTestFactory.block('testVariant', 'basic').withId('compile_ast:17').build()
      const childArray = [child]

      parent.properties.blocks = childArray

      let childContext: StructuralContext | null = null

      const visitor: StructuralVisitor = {
        enterNode: (node, ctx) => {
          if (node.id === 'compile_ast:17') {
            childContext = ctx
          }
          return StructuralVisitResult.CONTINUE
        },
      }

      structuralTraverse(parent, visitor)

      expect(childContext?.parent).toBe(childArray)
      expect(childContext?.parentType).toBe('array')
    })

    it('should track ancestors correctly', () => {
      const tree = createComplexTree()
      let blockContext: StructuralContext | null = null

      const visitor: StructuralVisitor = {
        enterNode: (node, ctx) => {
          if (node.id === 'compile_ast:4') {
            blockContext = ctx
          }
          return StructuralVisitResult.CONTINUE
        },
      }

      structuralTraverse(tree, visitor)

      expect(blockContext?.ancestors.length).toBeGreaterThan(0)
      expect(blockContext?.ancestors[0]).toBe(tree)
      const hasStep1 = blockContext?.ancestors.some((a: any) => a.id === 'compile_ast:2')
      expect(hasStep1).toBe(true)
    })

    it('should track ancestor last states for tree printing', () => {
      const node = ASTTestFactory.journey().withId('compile_ast:18').build()
      const step1 = ASTTestFactory.step().withId('compile_ast:19').build()
      const step2 = ASTTestFactory.step().withId('compile_ast:20').build()
      const steps = [step1, step2]

      node.properties.steps = steps

      let s1Context: StructuralContext | null = null
      let s2Context: StructuralContext | null = null

      const visitor: StructuralVisitor = {
        enterNode: (n, ctx) => {
          if (n.id === 'compile_ast:19') s1Context = ctx
          if (n.id === 'compile_ast:20') s2Context = ctx
          return StructuralVisitResult.CONTINUE
        },
      }

      structuralTraverse(node, visitor)

      expect(s1Context?.isLast).toBe(false)
      expect(s2Context?.isLast).toBe(true)
      expect(s1Context?.ancestorLastStates).toBeDefined()
      expect(s2Context?.ancestorLastStates).toBeDefined()
    })

    it('should provide index for array elements', () => {
      const arr = ['a', 'b', 'c']
      const contexts: StructuralContext[] = []

      const visitor: StructuralVisitor = {
        enterElement: (_, ctx) => {
          contexts.push(ctx)
          return StructuralVisitResult.CONTINUE
        },
      }

      structuralTraverse(arr, visitor)

      expect(contexts[0].index).toBe(0)
      expect(contexts[1].index).toBe(1)
      expect(contexts[2].index).toBe(2)
    })

    it('should provide property metadata', () => {
      const obj = { first: 1, second: 2, third: 3 }
      const contexts: StructuralContext[] = []

      const visitor: StructuralVisitor = {
        enterProperty: (_, __, ctx) => {
          contexts.push(ctx)
          return StructuralVisitResult.CONTINUE
        },
      }

      structuralTraverse(obj, visitor)

      expect(contexts[0]).toMatchObject({
        key: 'first',
        propertyKeys: ['first', 'second', 'third'],
        propertyIndex: 0,
        isFirstProperty: true,
        isLastProperty: false,
      })
    })
  })

  describe('control flow', () => {
    it('should skip node children when enterNode returns skip', () => {
      const parent = ASTTestFactory.step().withId('compile_ast:21').build()
      const child = ASTTestFactory.block('testVariant', 'basic').withId('compile_ast:22').build()

      parent.properties.blocks = [child]

      const visitor = createVisitorMocks()
      visitor.enterNode.mockImplementation((node): VisitorResult => {
        if (node.id === 'compile_ast:21') return StructuralVisitResult.SKIP
        return StructuralVisitResult.CONTINUE
      })

      structuralTraverse(parent, visitor)

      expect(visitor.enterNode).toHaveBeenCalledTimes(1)
      expect(visitor.enterNode).toHaveBeenCalledWith(parent, expect.any(Object))
      expect(visitor.enterNode).not.toHaveBeenCalledWith(child, expect.any(Object))
    })

    it('should stop entire traversal when visitor returns stop', () => {
      const tree = createComplexTree()
      const visitor = createVisitorMocks()

      let callCount = 0
      visitor.enterNode.mockImplementation((node): VisitorResult => {
        callCount += 1
        if (node.id === 'compile_ast:2') return StructuralVisitResult.STOP
        return StructuralVisitResult.CONTINUE
      })

      structuralTraverse(tree, visitor)

      // Should have visited journey and step1, then stopped
      expect(callCount).toBe(2)
    })

    it('should skip array elements when enterArray returns skip', () => {
      const arr = [1, 2, 3]
      const visitor = createVisitorMocks()
      visitor.enterArray.mockReturnValue(StructuralVisitResult.SKIP)

      structuralTraverse(arr, visitor)

      expect(visitor.enterArray).toHaveBeenCalled()
      expect(visitor.enterElement).not.toHaveBeenCalled()
      expect(visitor.exitArray).toHaveBeenCalled()
    })

    it('should skip property value when enterProperty returns skip', () => {
      const block = ASTTestFactory.block('testVariant', 'basic').withId('compile_ast:23').build()
      const obj = { foo: block }
      const visitor = createVisitorMocks()

      visitor.enterProperty.mockReturnValue(StructuralVisitResult.SKIP)

      structuralTraverse(obj, visitor)

      expect(visitor.enterProperty).toHaveBeenCalled()
      expect(visitor.enterNode).not.toHaveBeenCalled()
      expect(visitor.exitProperty).toHaveBeenCalled()
    })

    it('should not call exit hooks after stop', () => {
      const node = ASTTestFactory.step().withId('compile_ast:24').build()
      const visitor = createVisitorMocks()

      visitor.enterNode.mockReturnValue(StructuralVisitResult.STOP)

      structuralTraverse(node, visitor)

      expect(visitor.enterNode).toHaveBeenCalled()
      expect(visitor.exitNode).not.toHaveBeenCalled()
    })
  })

  describe('options configuration', () => {
    it('should use custom property order function', () => {
      const obj = { z: 1, a: 2, m: 3 }
      const orderedKeys: string[] = []

      const visitor: StructuralVisitor = {
        enterProperty: key => {
          orderedKeys.push(key)
          return StructuralVisitResult.CONTINUE
        },
      }

      const options: StructuralTraverseOptions = {
        propertyOrder: (_, keys) => keys.sort(),
      }

      structuralTraverse(obj, visitor, options)

      expect(orderedKeys).toEqual(['a', 'm', 'z'])
    })

    it('should handle visitMaps option', () => {
      const map = new Map([['key', 'value']])
      const visitor = createVisitorMocks()

      // With visitMaps true (default)
      structuralTraverse(map, visitor, { visitMaps: true })
      expect(visitor.visitObject).toHaveBeenCalled()

      // Reset and test with visitMaps false
      jest.clearAllMocks()
      structuralTraverse(map, visitor, { visitMaps: false })
      expect(visitor.visitObject).not.toHaveBeenCalled()
      expect(visitor.visitPrimitive).toHaveBeenCalled()
    })

    it('should handle visitObjects option', () => {
      const obj = { foo: 'bar' }
      const visitor = createVisitorMocks()

      // With visitObjects false
      structuralTraverse(obj, visitor, { visitObjects: false })
      expect(visitor.visitObject).not.toHaveBeenCalled()
      expect(visitor.visitPrimitive).toHaveBeenCalledWith(obj, expect.any(Object))
    })
  })
})
