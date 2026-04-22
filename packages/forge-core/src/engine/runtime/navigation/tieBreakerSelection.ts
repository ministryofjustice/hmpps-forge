import { NavigationStepState } from './NavigationEvaluation.type'

/**
 * Picks the winning candidate from a list of navigation steps according to the
 * shared tie-breaker rules.
 *
 * Candidates must be passed in journey declaration order — this is how the
 * final tiebreaker is resolved when priorities are equal (or all candidates
 * are unmatched). The candidate with the highest `tieBreakerPriority` wins;
 * an unmatched candidate (undefined priority) always loses to any matched
 * candidate but still competes against other unmatched candidates using
 * journey order.
 */
export function pickTieBreakerWinner(candidates: NavigationStepState[]): NavigationStepState | undefined {
  if (candidates.length === 0) {
    return undefined
  }

  return candidates.reduce((best, candidate) => {
    const bestPriority = best.tieBreakerPriority ?? -Infinity
    const candidatePriority = candidate.tieBreakerPriority ?? -Infinity

    return candidatePriority > bestPriority ? candidate : best
  })
}
