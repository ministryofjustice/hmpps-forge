import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import { ResolveSelfReferencesNormalizer } from '@form-engine/core/ast/normalizers/ResolveSelfReferences'
import { AddSelfValueToFieldsNormalizer } from '@form-engine/core/ast/normalizers/AddSelfValueToFields'
import { ConvertFormattersToPipelineNormalizer } from '@form-engine/core/ast/normalizers/ConvertFormattersToPipeline'
import { AttachParentNodesNormalizer } from '@form-engine/core/ast/normalizers/AttachParentNodes'
import { AttachValidationBlockCodeNormalizer } from '@form-engine/core/ast/normalizers/AttachValidationBlockCode'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import RegistrationTraverser from '@form-engine/core/ast/registration/RegistrationTraverser'
import PseudoNodeTraverser from '@form-engine/core/ast/registration/PseudoNodeTraverser'
import { PseudoNodeFactory } from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import ScopeIndex from '@form-engine/core/ast/dependencies/ScopeIndex'
import DependencyWiringTraverser from '@form-engine/core/ast/dependencies/DependencyWiringTraverser'
import type Logger from 'bunyan'

export const createCompileStageContainer = (
  logger: Logger | Console,
  functionRegistry: FunctionRegistry,
  componentRegistry: ComponentRegistry,
) => {
  const nodeIdGenerator = new NodeIDGenerator()

  const nodeFactory = new NodeFactory(nodeIdGenerator)
  const pseudoNodeFactory = new PseudoNodeFactory(nodeIdGenerator)

  const astNodeRegistry = new NodeRegistry()
  const pseudoNodeRegistry = new NodeRegistry()

  const dependencyGraph = new DependencyGraph()
  const scopeIndex = new ScopeIndex(astNodeRegistry)

  return {
    logger,
    functionRegistry,
    componentRegistry,
    astNodeRegistry,
    pseudoNodeRegistry,
    nodeIdGenerator,
    nodeFactory,
    pseudoNodeFactory,
    normalizers: {
      addSelfValue: new AddSelfValueToFieldsNormalizer(nodeFactory),
      resolveSelfReferences: new ResolveSelfReferencesNormalizer(),
      attachValidationBlockCode: new AttachValidationBlockCodeNormalizer(),
      convertFormatters: new ConvertFormattersToPipelineNormalizer(nodeIdGenerator),
      attachParentNodes: new AttachParentNodesNormalizer(),
    },
    registers: {
      configurationNodes: new RegistrationTraverser(astNodeRegistry),
      pseudoNodes: new PseudoNodeTraverser(pseudoNodeRegistry, pseudoNodeFactory),
    },
    dependency: {
      dependencyGraph,
      scopeIndex,
      wiring: new DependencyWiringTraverser(astNodeRegistry, pseudoNodeRegistry, dependencyGraph, scopeIndex),
    },
  }
}

export type CompileStageDependencies = ReturnType<typeof createCompileStageContainer>
