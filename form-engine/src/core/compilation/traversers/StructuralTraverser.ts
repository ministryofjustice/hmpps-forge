import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isArrayValue, isMapValue, isObjectValue } from '@form-engine/typeguards/primitives'
import { ASTNode } from '@form-engine/core/types/engine.type'

/**
 * Control flow instructions that visitors can return
 */
export enum StructuralVisitResult {
  CONTINUE = 'continue',
  SKIP = 'skip',
  STOP = 'stop',
}

export type VisitorResult = StructuralVisitResult

/**
 * Types of entities encountered during traversal
 */
export type EntityType = 'node' | 'array' | 'element' | 'property' | 'primitive' | 'object'

/**
 * Context provided to visitor methods
 */
export interface StructuralContext {
  // Path from root
  path: (string | number)[]
  depth: number

  // Entity information
  type: EntityType
  key?: string // Property key if this is a property
  index?: number // Array index if this is an element

  // Sibling information (crucial for tree printing)
  siblings?: any[]
  siblingIndex: number
  isFirst: boolean
  isLast: boolean

  // For properties in Maps/Objects
  propertyKeys?: string[]
  propertyIndex?: number
  isFirstProperty?: boolean
  isLastProperty?: boolean

  // Parent references
  parent?: any
  parentType?: string
  ancestors: any[] // Full stack from root

  // Track whether each ancestor was last in its context (for tree printing)
  ancestorLastStates?: boolean[]
}

/**
 * Visitor interface for structural traversal
 * All visitor methods must explicitly return a VisitorResult
 */
export interface StructuralVisitor {
  // Node events (for AST nodes)
  enterNode?(node: any, ctx: StructuralContext): VisitorResult
  exitNode?(node: any, ctx: StructuralContext): VisitorResult

  // Array events (called for arrays themselves, not elements)
  enterArray?(array: any[], ctx: StructuralContext): VisitorResult
  exitArray?(array: any[], ctx: StructuralContext): VisitorResult

  // Array element events
  enterElement?(element: any, ctx: StructuralContext): VisitorResult
  exitElement?(element: any, ctx: StructuralContext): VisitorResult

  // Property events (for Map/Object properties)
  enterProperty?(key: string, value: any, ctx: StructuralContext): VisitorResult
  exitProperty?(key: string, value: any, ctx: StructuralContext): VisitorResult

  // Leaf values
  visitPrimitive?(value: any, ctx: StructuralContext): VisitorResult
  visitObject?(obj: any, ctx: StructuralContext): VisitorResult
}

export interface StructuralTraverseOptions {
  /** Order property keys for Map/Object before visiting. */
  propertyOrder?: (owner: any, keys: string[]) => string[]

  /** When true (default), traverse non-node Maps as objects. */
  visitMaps?: boolean

  /** When true (default), traverse plain objects. */
  visitObjects?: boolean
}

interface FrameAncestors {
  ancestors: any[]
  ancestorLastStates: boolean[]
}

function defaultOrder(_owner: any, keys: string[]): string[] {
  return keys
}

function isStop(result: VisitorResult | undefined): boolean {
  return result === StructuralVisitResult.STOP
}

function isSkip(result: VisitorResult | undefined): boolean {
  return result === StructuralVisitResult.SKIP
}

/**
 * Structural traversal across AST nodes, arrays, maps/objects, and primitives.
 * Provides rich context about sibling relationships, property indices, and
 * ancestor last-states for tree-like structures
 */
export function structuralTraverse(
  root: any,
  visitor: StructuralVisitor,
  options: StructuralTraverseOptions = {},
): void {
  const opts: Required<StructuralTraverseOptions> = {
    propertyOrder: options.propertyOrder ?? defaultOrder,
    visitMaps: options.visitMaps ?? true,
    visitObjects: options.visitObjects ?? true,
  }

  const frames: FrameAncestors = {
    ancestors: [],
    ancestorLastStates: [],
  }

  let stopped = false

  /**
   * Executes a function while tracking an ancestor entity in the traversal stack
   * @param entity The entity to add as an ancestor during execution
   * @param isLast Whether this entity is the last among its siblings
   * @param fn The function to execute with the ancestor tracked
   */
  const withAncestor = (entity: any, isLast: boolean, fn: () => void) => {
    frames.ancestors.push(entity)
    frames.ancestorLastStates.push(isLast)

    fn()

    frames.ancestors.pop()
    frames.ancestorLastStates.pop()
  }

  /**
   * Builds the base context object with common properties for all entity types
   * @param type The type of entity being visited
   * @param path The path from root to this entity
   * @param depth The depth of this entity in the tree
   * @param siblingSet The array of siblings containing this entity
   * @param siblingIndex The index of this entity among its siblings
   * @returns Base context object with common properties
   */
  const buildBaseCtx = (
    type: StructuralContext['type'],
    path: (string | number)[],
    depth: number,
    siblingSet: any[],
    siblingIndex: number,
  ): Pick<
    StructuralContext,
    'path' | 'depth' | 'type' | 'siblings' | 'siblingIndex' | 'isFirst' | 'isLast' | 'ancestors' | 'ancestorLastStates'
  > => {
    const isFirst = siblingIndex === 0
    const isLast = siblingIndex === siblingSet.length - 1

    return {
      type,
      path,
      depth,
      siblings: siblingSet,
      siblingIndex,
      isFirst,
      isLast,
      ancestors: [...frames.ancestors],
      ancestorLastStates: [...frames.ancestorLastStates],
    }
  }

  /**
   * Visits a primitive value (string, number, boolean, null, etc.) during traversal
   * @param value The primitive value to visit
   * @param path The path from root to this value
   * @param depth The depth of this value in the tree
   * @param siblings Array of sibling values
   * @param siblingIndex Index of this value among siblings
   * @param parent The parent entity containing this value
   * @param parentType The type of the parent entity
   */
  const visitPrimitive = (
    value: any,
    path: (string | number)[],
    depth: number,
    siblings: any[],
    siblingIndex: number,
    parent?: any,
    parentType?: string,
  ): void => {
    if (stopped) {
      return
    }

    const base = buildBaseCtx('primitive', path, depth, siblings, siblingIndex)

    const ctx: StructuralContext = {
      ...base,
      parent,
      parentType,
      ancestors: base.ancestors,
      ancestorLastStates: base.ancestorLastStates,
    }

    const res = visitor.visitPrimitive?.(value, ctx)

    if (isStop(res)) {
      stopped = true
    }
  }

  /**
   * Visits a plain object during traversal and recursively visits its properties
   * @param obj The object to visit
   * @param path The path from root to this object
   * @param depth The depth of this object in the tree
   * @param siblings Array of sibling values
   * @param siblingIndex Index of this object among siblings
   * @param parent The parent entity containing this object
   * @param parentType The type of the parent entity
   */
  const visitObject = (
    obj: Record<string, any>,
    path: (string | number)[],
    depth: number,
    siblings: any[],
    siblingIndex: number,
    parent?: any,
    parentType?: string,
  ): void => {
    if (stopped) {
      return
    }

    const base = buildBaseCtx('object', path, depth, siblings, siblingIndex)

    const ctx: StructuralContext = {
      ...base,
      parent,
      parentType,
      ancestors: base.ancestors,
      ancestorLastStates: base.ancestorLastStates,
    }

    const res = visitor.visitObject?.(obj, ctx)

    if (isStop(res)) {
      stopped = true
      return
    }

    if (isSkip(res)) {
      return
    }

    const keys = opts.propertyOrder(obj, Object.keys(obj))

    withAncestor(obj, base.isLast, () => {
      for (let i = 0; i < keys.length; i += 1) {
        if (stopped) {
          return
        }

        const key = keys[i]
        const value = obj[key]

        const propertyCtx: StructuralContext = {
          ...buildBaseCtx('property', [...path, key], depth + 1, keys, i),
          key,
          propertyKeys: keys,
          propertyIndex: i,
          isFirstProperty: i === 0,
          isLastProperty: i === keys.length - 1,
          parent: obj,
          parentType: 'object',
          ancestors: [...frames.ancestors],
          ancestorLastStates: [...frames.ancestorLastStates],
        }

        const enterRes = visitor.enterProperty?.(key, value, propertyCtx)
        if (isStop(enterRes)) {
          stopped = true
          return
        }

        if (!isSkip(enterRes)) {
          withAncestor({ kind: 'property', key, owner: obj }, propertyCtx.isLastProperty === true, () => {
            traverseValue(value, [...path, key], depth + 1, [value], 0, obj, 'object-property')
          })
        }

        if (stopped) {
          return
        }

        const exitRes = visitor.exitProperty?.(key, value, propertyCtx)
        if (isStop(exitRes)) {
          stopped = true
          return
        }
      }
    })
  }

  /**
   * Visits an array during traversal and recursively visits its elements
   * @param arr The array to visit
   * @param path The path from root to this array
   * @param depth The depth of this array in the tree
   * @param siblings Array of sibling values
   * @param siblingIndex Index of this array among siblings
   * @param parent The parent entity containing this array
   * @param parentType The type of the parent entity
   */
  const visitArray = (
    arr: any[],
    path: (string | number)[],
    depth: number,
    siblings: any[],
    siblingIndex: number,
    parent?: any,
    parentType?: string,
  ): void => {
    if (stopped) {
      return
    }

    const base = buildBaseCtx('array', path, depth, siblings, siblingIndex)

    const ctx: StructuralContext = {
      ...base,
      parent,
      parentType,
      ancestors: base.ancestors,
      ancestorLastStates: base.ancestorLastStates,
    }

    const enterRes = visitor.enterArray?.(arr, ctx)

    if (isStop(enterRes)) {
      stopped = true
      return
    }

    if (!isSkip(enterRes)) {
      withAncestor(arr, base.isLast, () => {
        for (let i = 0; i < arr.length; i += 1) {
          if (stopped) {
            return
          }

          const el = arr[i]
          const elCtx: StructuralContext = {
            ...buildBaseCtx('element', [...path, i], depth + 1, arr, i),
            index: i,
            parent: arr,
            parentType: 'array',
            ancestors: [...frames.ancestors],
            ancestorLastStates: [...frames.ancestorLastStates],
          }

          const elEnter = visitor.enterElement?.(el, elCtx)
          if (isStop(elEnter)) {
            stopped = true
            return
          }

          if (!isSkip(elEnter)) {
            traverseValue(el, [...path, i], depth + 1, arr, i, arr, 'array')
          }

          if (stopped) {
            return
          }

          const elExit = visitor.exitElement?.(el, elCtx)
          if (isStop(elExit)) {
            stopped = true
            return
          }
        }
      })
    }

    if (stopped) {
      return
    }

    const exitRes = visitor.exitArray?.(arr, ctx)
    if (isStop(exitRes)) {
      stopped = true
    }
  }

  /**
   * Visits an AST node during traversal and recursively visits its properties
   * @param node The AST node to visit
   * @param path The path from root to this node
   * @param depth The depth of this node in the tree
   * @param siblings Array of sibling values
   * @param siblingIndex Index of this node among siblings
   * @param parent The parent entity containing this node
   * @param parentType The type of the parent entity
   */
  const visitNode = (
    node: ASTNode,
    path: (string | number)[],
    depth: number,
    siblings: any[],
    siblingIndex: number,
    parent?: any,
    parentType?: string,
  ): void => {
    if (stopped) {
      return
    }

    const base = buildBaseCtx('node', path, depth, siblings, siblingIndex)

    const ctx: StructuralContext = {
      ...base,
      parent,
      parentType,
      ancestors: base.ancestors,
      ancestorLastStates: base.ancestorLastStates,
    }

    const enterNodeRes = visitor.enterNode?.(node, ctx)
    if (isStop(enterNodeRes)) {
      stopped = true
      return
    }

    if (!isSkip(enterNodeRes)) {
      // Traverse node.properties if present
      const props = (node as any).properties

      if (props) {
        const keys = Object.keys(props)
        const getValue = (key: string) => props[key]

        // Order node property keys using the node as owner
        const orderedKeys = opts.propertyOrder(node, keys)

        withAncestor(node, base.isLast, () => {
          for (let i = 0; i < orderedKeys.length; i += 1) {
            if (stopped) {
              return
            }

            const key = orderedKeys[i]
            const value = getValue(key)

            const propCtx: StructuralContext = {
              ...buildBaseCtx('property', [...path, key], depth + 1, orderedKeys, i),
              key,
              propertyKeys: orderedKeys,
              propertyIndex: i,
              isFirstProperty: i === 0,
              isLastProperty: i === orderedKeys.length - 1,
              parent: node,
              parentType: 'node',
              ancestors: [...frames.ancestors],
              ancestorLastStates: [...frames.ancestorLastStates],
            }

            const enterPropRes = visitor.enterProperty?.(key, value, propCtx)
            if (isStop(enterPropRes)) {
              stopped = true
              return
            }

            if (!isSkip(enterPropRes)) {
              // Descend into value (push property as an ancestor for branch context)
              withAncestor({ kind: 'property', key, owner: node }, propCtx.isLastProperty === true, () => {
                traverseValue(value, [...path, key], depth + 1, [value], 0, node, 'node-property')
              })
            }

            if (stopped) {
              return
            }

            const exitPropRes = visitor.exitProperty?.(key, value, propCtx)
            if (isStop(exitPropRes)) {
              stopped = true
              return
            }
          }
        })
      }
    }

    if (stopped) {
      return
    }

    const leaveNodeRes = visitor.exitNode?.(node, ctx)
    if (isStop(leaveNodeRes)) {
      stopped = true
    }
  }

  /**
   * Main dispatch function that determines the type of value and delegates to appropriate visitor
   * @param value The value to traverse (can be node, array, object, or primitive)
   * @param path The path from root to this value
   * @param depth The depth of this value in the tree
   * @param siblings Array of sibling values
   * @param siblingIndex Index of this value among siblings
   * @param parent The parent entity containing this value
   * @param parentType The type of the parent entity
   */
  const traverseValue = (
    value: any,
    path: (string | number)[],
    depth: number,
    siblings: any[],
    siblingIndex: number,
    parent?: any,
    parentType?: string,
  ): void => {
    if (stopped) {
      return
    }

    if (isASTNode(value)) {
      visitNode(value, path, depth, siblings, siblingIndex, parent, parentType)

      return
    }

    if (isArrayValue(value)) {
      visitArray(value, path, depth, siblings, siblingIndex, parent, parentType)

      return
    }

    if (opts.visitMaps && isMapValue(value)) {
      const mapObj: Record<string, any> = Object.fromEntries(value as Map<string, any>)

      visitObject(mapObj, path, depth, siblings, siblingIndex, parent, parentType)

      return
    }

    if (opts.visitObjects && isObjectValue(value)) {
      visitObject(value as Record<string, any>, path, depth, siblings, siblingIndex, parent, parentType)

      return
    }

    visitPrimitive(value, path, depth, siblings, siblingIndex, parent, parentType)
  }

  // Kick off traversal
  traverseValue(root, [], 0, [root], 0, undefined, undefined)
}
