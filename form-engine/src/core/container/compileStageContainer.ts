import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import { ResolveSelfReferencesNormalizer } from '@form-engine/core/ast/normalizers/ResolveSelfReferences'
import { AddSelfValueToFieldsNormalizer } from '@form-engine/core/ast/normalizers/AddSelfValueToFields'
import { ConvertFormattersToPipelineNormalizer } from '@form-engine/core/ast/normalizers/ConvertFormattersToPipeline'
import { AttachParentNodesNormalizer } from '@form-engine/core/ast/normalizers/AttachParentNodes'
import { AttachValidationBlockCodeNormalizer } from '@form-engine/core/ast/normalizers/AttachValidationBlockCode'

export const createCompileStageContainer = (
  functionRegistry: FunctionRegistry,
  componentRegistry: ComponentRegistry,
) => {
  const nodeIdGenerator = new NodeIDGenerator()
  const nodeFactory = new NodeFactory(nodeIdGenerator)

  return {
    functionRegistry,
    componentRegistry,
    nodeFactory,
    nodeIdGenerator,
    normalizers: {
      addSelfValue: new AddSelfValueToFieldsNormalizer(nodeFactory),
      resolveSelfReferences: new ResolveSelfReferencesNormalizer(),
      attachValidationBlockCode: new AttachValidationBlockCodeNormalizer(),
      convertFormatters: new ConvertFormattersToPipelineNormalizer(nodeIdGenerator),
      attachParentNodes: new AttachParentNodesNormalizer(),
    },
  }
}

export type CompileStageDependencies = ReturnType<typeof createCompileStageContainer>
