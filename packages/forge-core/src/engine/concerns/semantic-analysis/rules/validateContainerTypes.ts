import { FunctionCallType, HookType, StructureType } from '../../../../shared/taxonomy'
import { ASTNodeFamily, astNodeFamily } from '../../../chassis/contracts/ast/enums'
import type { AccessHookASTNode, SubmitHookASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { StepASTNode, JourneyASTNode } from '../../../chassis/contracts/ast/structures.type'
import { isASTNode } from '../../../chassis/contracts/ast/nodes'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object'
}

function getDiagnostics(value: unknown): ASTNodeDiagnostics | undefined {
  if (!isObject(value) || !isObject(value.diagnostics) || !isObject(value.diagnostics.source)) {
    return undefined
  }

  const { path, formattedPath } = value.diagnostics.source

  if (
    !Array.isArray(path) ||
    !path.every(segment => typeof segment === 'string' || typeof segment === 'number') ||
    typeof formattedPath !== 'string'
  ) {
    return undefined
  }

  const callsite = isObject(value.diagnostics.callsite)
    ? (value.diagnostics.callsite as { readonly stack?: string })
    : undefined

  return { source: { path, formattedPath }, callsite }
}

interface ContainerCheck {
  message: string
  isValid: (value: unknown) => boolean
}

function buildError(check: ContainerCheck, diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: check.message,
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function checkEntries(
  entries: unknown,
  check: ContainerCheck,
  containerDiagnostics: ASTNodeDiagnostics | undefined,
  errors: Error[],
): void {
  if (!Array.isArray(entries)) {
    return
  }

  entries.forEach((entry: unknown) => {
    if (check.isValid(entry)) {
      return
    }

    errors.push(buildError(check, getDiagnostics(entry) ?? containerDiagnostics))
  })
}

function checkBlockStructure(
  value: unknown,
  containerDiagnostics: ASTNodeDiagnostics | undefined,
  errors: Error[],
): void {
  if (isBlock(value)) {
    return
  }

  if (Array.isArray(value)) {
    value.forEach(entry => checkBlockStructure(entry, containerDiagnostics, errors))

    return
  }

  if (isObject(value) && !isASTNode(value)) {
    Object.values(value).forEach(entry => checkBlockStructure(entry, containerDiagnostics, errors))

    return
  }

  errors.push(buildError(BLOCKS, getDiagnostics(value) ?? containerDiagnostics))
}

function isAccessHook(value: unknown): boolean {
  return isObject(value) && value.kind === HookType.ACCESS
}

function isSubmitHook(value: unknown): boolean {
  return isObject(value) && value.kind === HookType.SUBMIT
}

function isBlock(value: unknown): boolean {
  return isASTNode(value) && astNodeFamily(value.kind) === ASTNodeFamily.COMPONENT_CALL
}

function isEffect(value: unknown): boolean {
  return isObject(value) && value.kind === FunctionCallType.EFFECT
}

function isOutcome(value: unknown): boolean {
  return isASTNode(value) && astNodeFamily(value.kind) === ASTNodeFamily.POLICY_OUTCOME
}

const ON_ACCESS: ContainerCheck = {
  message: 'onAccess can only contain access hooks',
  isValid: isAccessHook,
}

const ON_SUBMISSION: ContainerCheck = {
  message: 'onSubmission can only contain submit hooks',
  isValid: isSubmitHook,
}

const BLOCKS: ContainerCheck = {
  message: 'blocks can only contain block definitions',
  isValid: isBlock,
}

const EFFECTS: ContainerCheck = {
  message: 'effects can only contain effect functions',
  isValid: isEffect,
}

const NEXT: ContainerCheck = {
  message: 'next can only contain outcomes',
  isValid: isOutcome,
}

function checkHookBranch(
  branch: { effects?: unknown[]; next?: unknown[] } | undefined,
  containerDiagnostics: ASTNodeDiagnostics | undefined,
  errors: Error[],
): void {
  if (!branch) {
    return
  }

  checkEntries(branch.effects, EFFECTS, containerDiagnostics, errors)
  checkEntries(branch.next, NEXT, containerDiagnostics, errors)
}

export const validateContainerTypes: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByKind<StepASTNode>(StructureType.STEP).forEach(step => {
    const diagnostics = step.diagnostics

    checkEntries(step.properties.onAccess, ON_ACCESS, diagnostics, errors)
    checkEntries(step.properties.onSubmission, ON_SUBMISSION, diagnostics, errors)
    if (step.properties.blocks !== undefined) {
      checkBlockStructure(step.properties.blocks, diagnostics, errors)
    }
  })

  nodeIndex.findByKind<JourneyASTNode>(StructureType.JOURNEY).forEach(journey => {
    checkEntries(journey.properties.onAccess, ON_ACCESS, journey.diagnostics, errors)
  })

  nodeIndex.findByKind<AccessHookASTNode>(HookType.ACCESS).forEach(hook => {
    const diagnostics = hook.diagnostics

    checkEntries(hook.properties.effects, EFFECTS, diagnostics, errors)
    checkEntries(hook.properties.next, NEXT, diagnostics, errors)
  })

  nodeIndex.findByKind<SubmitHookASTNode>(HookType.SUBMIT).forEach(hook => {
    const diagnostics = hook.diagnostics

    checkHookBranch(hook.properties.onAlways, diagnostics, errors)
    checkHookBranch(hook.properties.onValid, diagnostics, errors)
    checkHookBranch(hook.properties.onInvalid, diagnostics, errors)
  })

  return errors
}
