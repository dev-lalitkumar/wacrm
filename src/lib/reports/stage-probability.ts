/**
 * Per-stage win probability for weighted pipeline / forecasting.
 *
 * Stages interpolate linearly from 10% (first stage) to 90% (last stage),
 * e.g. New ≈ 10%, Qualified ≈ 37%, Proposal Sent ≈ 63%, Negotiation ≈ 90%.
 * Shared by the pipeline analytics strip and the Forecast report so they
 * never drift apart.
 */
export interface StageLike {
  id: string
  position: number
}

export function computeStageProbability(stageId: string, sortedStages: StageLike[]): number {
  const n = sortedStages.length
  if (n <= 1) return 0.5
  const index = sortedStages.findIndex((s) => s.id === stageId)
  if (index < 0) return 0
  const t = index / (n - 1)
  return 0.1 + t * (0.9 - 0.1)
}
