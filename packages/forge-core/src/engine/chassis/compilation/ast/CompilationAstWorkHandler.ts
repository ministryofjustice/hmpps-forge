import type { WorkContextContract, WorkHandler } from '../../contracts/work/work.type'
import { createWorkTask } from '../../work/workTask'
import type { JourneyASTNode } from '../../contracts/ast/structures.type'
import type CompilationState from '../pipeline/CompilationState'
import { NodeIDGenerator } from './ast-state/NodeIDGenerator'
import { NodeFactory } from './nodes/NodeFactory'
import ASTNodeIndex from './ast-state/ASTNodeIndex'
import TemplateNodeIndex from './ast-state/TemplateNodeIndex'
import NodeRegistrationWalker from './ast-state/NodeRegistrationWalker'

export const COMPILATION_AST_WORK_HANDLER: WorkHandler<'compilation.ast', undefined> = {
  kind: 'compilation.ast',

  begin(ctx: WorkContextContract<CompilationState, undefined>) {
    const state = ctx.state
    const nodeIdGenerator = new NodeIDGenerator()
    const nodeFactory = new NodeFactory(nodeIdGenerator)
    const nodeIndex = new ASTNodeIndex()
    const templateNodeIndex = new TemplateNodeIndex()

    const rootNode = nodeFactory.createNode(state.journeyDefinition) as JourneyASTNode

    const walker = new NodeRegistrationWalker(nodeIdGenerator, nodeIndex, templateNodeIndex)

    walker.register(rootNode)

    state.recordAst({ rootNode, nodeIndex, templateNodeIndex })

    return { output: undefined }
  },
}

export function createCompilationAstTask() {
  return createWorkTask('ast', COMPILATION_AST_WORK_HANDLER, undefined)
}
