import { ASTNodeType } from '../../../contracts/ast/enums'
import { HookType } from '../../../../../authoring/types/enums'
import { AccessHookASTNode, SubmitHookASTNode } from '../../../contracts/ast/expressions.type'
import { AccessHook, SubmitHook } from '../../../../../authoring/types/expressions.type'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import type { NodeBuildContext } from './NodeFactory'

type SubmitBranch = NonNullable<SubmitHook['onAlways']>
type SubmitBranchAST = {
  effects?: ASTNode[]
  next?: ASTNode[]
}

/**
 * Access hook: Access control, data loading, and outcomes through:
 * - `when` conditions for conditional execution
 * - `effects` for data loading and side effects
 * - `next` outcomes for redirects and errors (first-match semantics)
 */
export function createAccessHookNode(json: AccessHook, ctx: NodeBuildContext): AccessHookASTNode {
  const properties: AccessHookASTNode['properties'] = {}

  if (json.when) {
    properties.when = ctx.createNode(json.when)
  }

  if (Array.isArray(json.effects)) {
    properties.effects = json.effects.map((effect: unknown) => ctx.createNode(effect))
  }

  if (Array.isArray(json.next)) {
    properties.next = json.next.map((outcome: unknown) => ctx.createNode(outcome))
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.HOOK,
    hookType: HookType.ACCESS,
    properties,
  }
}

/**
 * Submit hook: Form submission handling
 * Manages validation, effects, and navigation on submit
 */
export function createSubmitHookNode(json: SubmitHook, ctx: NodeBuildContext): SubmitHookASTNode {
  const properties: SubmitHookASTNode['properties'] = {
    validate: json.validate !== undefined && json.validate !== false,
    validationGroups: getValidationGroups(json.validate),
  }

  if (json.when) {
    properties.when = ctx.createNode(json.when)
  }

  if (json.guards) {
    properties.guards = ctx.createNode(json.guards)
  }

  if (json.onAlways) {
    properties.onAlways = transformBranch(json.onAlways, ctx)
  }

  if (json.onValid) {
    properties.onValid = transformBranch(json.onValid, ctx)
  }

  if (json.onInvalid) {
    properties.onInvalid = transformBranch(json.onInvalid, ctx)
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.HOOK,
    hookType: HookType.SUBMIT,
    properties,
  }
}

function getValidationGroups(validate: SubmitHook['validate']): string[] {
  if (validate === true) {
    return ['default']
  }

  if (validate === false || validate === undefined) {
    return []
  }

  return validate.groups
}

function transformBranch(branch: SubmitBranch, ctx: NodeBuildContext): SubmitBranchAST {
  const result: SubmitBranchAST = {}

  if (Array.isArray(branch.effects)) {
    result.effects = branch.effects.map(effect => ctx.createNode(effect))
  }

  if (Array.isArray(branch.next)) {
    result.next = branch.next.map(next => ctx.createNode(next))
  }

  return result
}
