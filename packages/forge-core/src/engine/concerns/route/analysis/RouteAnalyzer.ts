import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type AuthoredValueClassifier from '../../../compilation/analysis/shared/AuthoredValueClassifier'
import type {
  JourneyAnalysisContext,
  JourneyModelAnalyzer,
  StepAnalysisContext,
  StepModelAnalyzer,
} from '../../../compilation/analysis/concernAnalyzers.type'
import type { RouteMetadataModel } from '../contracts/routeMetadataModel.type'

/**
 * Collects the authored route metadata (title/description/metadata) from a step
 * or journey node. Steps and journeys carry the same metadata shape, so both
 * family entry points delegate to one builder — the package-level
 * route-metadata function later lowers every collected entry into one compiled
 * function.
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
