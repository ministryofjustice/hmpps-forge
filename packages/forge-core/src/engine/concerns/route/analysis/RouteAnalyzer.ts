import type { JourneyASTNode, StepASTNode } from '../../../chassis/contracts/ast/structures.type'
import type AuthoredValueClassifier from '../../../chassis/compilation/analysis/shared/AuthoredValueClassifier'
import type {
  JourneyAnalysisContext,
  JourneyModelAnalyzer,
  StepAnalysisContext,
  StepModelAnalyzer,
} from '../../../chassis/compilation/analysis/concernAnalyzers.type'
import type { RouteMetadataModel } from '../contracts/routeMetadataModel.type'

/**
 * Collects the authored route metadata (title/description/metadata) from a step
 * or journey node. Steps and journeys share the same metadata shape, so both
 * `analyzeStep` and `analyzeJourney` delegate to one builder. The package-level
 * route-metadata function later compiles every collected entry into one
 * generated function.
 */
export default class RouteAnalyzer
  implements StepModelAnalyzer<RouteMetadataModel>, JourneyModelAnalyzer<RouteMetadataModel>
{
  analyzeStep(context: StepAnalysisContext): RouteMetadataModel {
    return this.buildForNode(context.stepNode, context.classifier)
  }

  analyzeJourney(context: JourneyAnalysisContext): RouteMetadataModel {
    return this.buildForNode(context.journeyNode, context.classifier)
  }

  private buildForNode(node: StepASTNode | JourneyASTNode, classifier: AuthoredValueClassifier): RouteMetadataModel {
    return {
      nodeId: node.id,
      title: classifier.classify(node.properties.title),
      description:
        node.properties.description === undefined ? undefined : classifier.classify(node.properties.description),
      metadata: node.properties.metadata === undefined ? undefined : classifier.classify(node.properties.metadata),
    }
  }
}
