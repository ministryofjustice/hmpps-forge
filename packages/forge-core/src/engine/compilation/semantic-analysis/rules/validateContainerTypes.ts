import { FunctionType, HookType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { AccessHookASTNode, SubmitHookASTNode } from '../../../contracts/ast/expressions.type'
import type { StepASTNode, JourneyASTNode } from '../../../contracts/ast/structures.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { DSLSourceLocation } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object'
}

function getSource(value: unknown): DSLSourceLocation | undefined {
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

  return { path, formattedPath }
}

interface ContainerCheck {
  message: string
  code: string
  isValid: (value: unknown) => boolean
}

function buildError(
  check: ContainerCheck,
  source: DSLSourceLocation | undefined,
): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: check.message,
    code: check.code,
    formattedPath: source?.formattedPath ?? 'unknown',
  })
}

function checkEntries(
  entries: unknown,
  check: ContainerCheck,
  containerSource: DSLSourceLocation | undefined,
  errors: Error[],
): void {
  if (!Array.isArray(entries)) {
    return
  }

  entries.forEach((entry: unknown) => {
    if (check.isValid(entry)) {
      return
    }

    errors.push(buildError(check, getSource(entry) ?? containerSource))
  })
}

function isAccessHook(value: unknown): boolean {
  return isObject(value) && value.type === ASTNodeType.HOOK && value.hookType === HookType.ACCESS
}

function isSubmitHook(value: unknown): boolean {
  return isObject(value) && value.type === ASTNodeType.HOOK && value.hookType === HookType.SUBMIT
}

function isBlock(value: unknown): boolean {
  return isObject(value) && value.type === ASTNodeType.BLOCK
}

function isEffect(value: unknown): boolean {
  return isObject(value) && value.expressionType === FunctionType.EFFECT
}

function isOutcome(value: unknown): boolean {
  return isObject(value) && value.type === ASTNodeType.OUTCOME
}

const ON_ACCESS: ContainerCheck = {
  message: 'onAccess can only contain access hooks',
  code: 'invalid_entry_in_on_access',
  isValid: isAccessHook,
}

const ON_SUBMISSION: ContainerCheck = {
  message: 'onSubmission can only contain submit hooks',
  code: 'invalid_entry_in_on_submission',
  isValid: isSubmitHook,
}

const BLOCKS: ContainerCheck = {
  message: 'blocks can only contain block definitions',
  code: 'invalid_entry_in_blocks',
  isValid: isBlock,
}

const EFFECTS: ContainerCheck = {
  message: 'effects can only contain effect functions',
  code: 'invalid_entry_in_effects',
  isValid: isEffect,
}

const NEXT: ContainerCheck = {
  message: 'next can only contain outcomes',
  code: 'invalid_entry_in_next',
  isValid: isOutcome,
}

function checkHookBranch(
  branch: { effects?: unknown[]; next?: unknown[] } | undefined,
  containerSource: DSLSourceLocation | undefined,
  errors: Error[],
): void {
  if (!branch) {
    return
  }

  checkEntries(branch.effects, EFFECTS, containerSource, errors)
  checkEntries(branch.next, NEXT, containerSource, errors)
}

export const validateContainerTypes: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByType<StepASTNode>(ASTNodeType.STEP).forEach(step => {
    const source = step.diagnostics?.source

    checkEntries(step.properties.onAccess, ON_ACCESS, source, errors)
    checkEntries(step.properties.onSubmission, ON_SUBMISSION, source, errors)
    checkEntries(step.properties.blocks, BLOCKS, source, errors)
  })

  nodeIndex.findByType<JourneyASTNode>(ASTNodeType.JOURNEY).forEach(journey => {
    checkEntries(journey.properties.onAccess, ON_ACCESS, journey.diagnostics?.source, errors)
  })

  nodeIndex.findByType<AccessHookASTNode>(HookType.ACCESS).forEach(hook => {
    const source = hook.diagnostics?.source

    checkEntries(hook.properties.effects, EFFECTS, source, errors)
    checkEntries(hook.properties.next, NEXT, source, errors)
  })

  nodeIndex.findByType<SubmitHookASTNode>(HookType.SUBMIT).forEach(hook => {
    const source = hook.diagnostics?.source

    checkHookBranch(hook.properties.onAlways, source, errors)
    checkHookBranch(hook.properties.onValid, source, errors)
    checkHookBranch(hook.properties.onInvalid, source, errors)
  })

  return errors
}
