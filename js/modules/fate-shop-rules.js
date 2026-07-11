/**
 * Pure scoring and ordering rules for fate-shop recommendations.
 *
 * Keeping these rules independent from DOM rendering lets numerical changes be
 * regression-tested without booting the whole game.
 */

export function getFateRecommendationScore(candidate = {}) {
  const gap = candidate.gap || {};
  const progress = Math.max(0, Math.min(1, Number(gap.progress) || 0));
  const availabilityScore = gap.affordable ? 28 : Math.round(progress * 18);

  return Math.max(
    0,
    Math.round(
      (Number(candidate.baseScore) || 0) +
        (Number(candidate.benefitScore) || 0) +
        (Number(candidate.territoryScore) || 0) +
        (Number(candidate.pathBoost) || 0) +
        availabilityScore -
        (Number(gap.missingPenalty) || 0)
    )
  );
}

export function rankFateRecommendationCandidates(candidates = []) {
  const ranked = candidates
    .map((candidate, index) => ({
      ...candidate,
      score: getFateRecommendationScore(candidate),
      order: index,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (Boolean(a.gap?.affordable) !== Boolean(b.gap?.affordable)) {
        return a.gap?.affordable ? -1 : 1;
      }
      return a.order - b.order;
    });

  return {
    primary: ranked[0] || null,
    secondary: ranked[1] || null,
    candidates: ranked,
  };
}

export function getFateShopDisplayOrder(
  recommendation = "none",
  originalOrder = 0,
  filter = "recommended"
) {
  const safeOriginalOrder = Number(originalOrder) || 0;
  if (filter !== "recommended") return safeOriginalOrder;

  const recommendationRank = {
    primary: 0,
    secondary: 1,
    none: 2,
  };

  return (recommendationRank[recommendation] ?? 2) * 100 + safeOriginalOrder;
}
