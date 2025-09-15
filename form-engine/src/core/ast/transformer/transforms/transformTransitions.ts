import { isAccessTransition, isLoadTransition, isSubmitTransition } from '@form-engine/form/typeguards/transitions'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import { transformNode, transformValue } from '@form-engine/core/ast/transformer/transformToAst'
import {
  AccessTransitionASTNode,
  LoadTransitionASTNode,
  SubmitTransitionASTNode,
  TransitionASTNode,
} from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'

/**
 * Transform Transition node: Lifecycle event handlers
 * Routes to specific transition type (Load, Access, Submit)
 */
export function transformTransition(json: any, path: string[]): TransitionASTNode {
  if (isLoadTransition(json)) {
    return transformLoadTransition(json, path)
  }

  if (isAccessTransition(json)) {
    return transformAccessTransition(json, path)
  }

  if (isSubmitTransition(json)) {
    return transformSubmitTransition(json, path)
  }

  const { type, ...dataProperties } = json
  const properties = new Map<string, ASTNode | any>()

  for (const [key, value] of Object.entries(dataProperties)) {
    properties.set(key, transformValue(value, [...path, key]))
  }

  return {
    type: ASTNodeType.TRANSITION,
    transitionType: json.type,
    properties,
    raw: json,
  }
}

/**
 * Transform Load transition: Data loading on step/journey access
 * Executes effects before rendering
 */
export function transformLoadTransition(json: any, path: string[]): LoadTransitionASTNode {
  const properties = new Map<string, ASTNode | any>()

  const effects = json.effects.map((effect: any, i: number) =>
    transformNode(effect, [...path, 'effects', i.toString()]),
  )

  properties.set('effects', effects)

  return {
    type: ASTNodeType.TRANSITION,
    transitionType: TransitionType.LOAD,
    properties,
    raw: json,
  }
}

/**
 * Transform Access transition: Guards and analytics
 * Controls access and tracks user navigation
 */
export function transformAccessTransition(json: any, path: string[]): AccessTransitionASTNode {
  const properties = new Map<string, ASTNode | any>()

  if (json.guards) {
    properties.set('guards', transformNode(json.guards, [...path, 'guards']))
  }

  if (Array.isArray(json.effects)) {
    const effects = json.effects.map((effect: any, i: number) =>
      transformNode(effect, [...path, 'effects', i.toString()]),
    )

    properties.set('effects', effects)
  }

  if (Array.isArray(json.redirect)) {
    const redirect = json.redirect.map((r: any, i: number) => transformNode(r, [...path, 'redirect', i.toString()]))

    properties.set('redirect', redirect)
  }

  return {
    type: ASTNodeType.TRANSITION,
    transitionType: TransitionType.ACCESS,
    properties,
    raw: json,
  }
}

/**
 * Transform Submit transition: Form submission handling
 * Manages validation, effects, and navigation on submit
 */
export function transformSubmitTransition(json: any, path: string[]): SubmitTransitionASTNode {
  const properties = new Map<string, ASTNode | any>()

  if (json.when) {
    properties.set('when', transformNode(json.when, [...path, 'when']))
  }

  if (json.guards) {
    properties.set('guards', transformNode(json.guards, [...path, 'guards']))
  }

  // Default to validation enabled unless explicitly false
  properties.set('validate', json.validate !== false)

  // Helper to transform submission branches (onAlways/onValid/onInvalid)
  const transformBranch = (branch: any, branchPath: string[]) => {
    if (!branch) {
      return undefined
    }

    const result: any = {}

    if (Array.isArray(branch.effects)) {
      result.effects = branch.effects.map((effect: any, i: number) =>
        transformNode(effect, [...branchPath, 'effects', i.toString()]),
      )
    }

    if (Array.isArray(branch.next)) {
      result.next = branch.next.map((n: any, i: number) => transformNode(n, [...branchPath, 'next', i.toString()]))
    }

    return result
  }

  if (json.onAlways) {
    properties.set('onAlways', transformBranch(json.onAlways, [...path, 'onAlways']))
  }

  if (json.onValid) {
    properties.set('onValid', transformBranch(json.onValid, [...path, 'onValid']))
  }

  if (json.onInvalid) {
    properties.set('onInvalid', transformBranch(json.onInvalid, [...path, 'onInvalid']))
  }

  return {
    type: ASTNodeType.TRANSITION,
    transitionType: TransitionType.SUBMIT,
    properties,
    raw: json,
  }
}
