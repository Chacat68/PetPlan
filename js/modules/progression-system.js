import {
  GROWTH_PATHS,
  PATH_RECOMMENDATION_BOOST,
} from "./progression-config.js?v=tutorial-removal-20260724a";

let instance = null;

export class ProgressionSystem {
  constructor() {
    this.claimedAchievementIds = new Set();
  }

  getPathSummary(context = {}) {
    const paths = Object.entries(GROWTH_PATHS).map(([id, path]) => {
      const score = path.signals.reduce((total, signal) => {
        const value = Math.max(0, Number(context[signal.metric]) || 0);
        return total + Math.max(0, value - signal.offset) * signal.weight;
      }, 0);

      return { id, ...path, score };
    });
    const highestScore = Math.max(0, ...paths.map((path) => path.score));
    const leadingPath =
      highestScore > 0
        ? paths.find((path) => path.score === highestScore) || null
        : null;

    return { paths, leadingPath, highestScore };
  }

  getRecommendationBoost(action, pathSummary) {
    const leadingPath = pathSummary?.leadingPath;
    if (!leadingPath || !leadingPath.actions.includes(action)) return 0;
    return PATH_RECOMMENDATION_BOOST;
  }

  isAchievementClaimed(id) {
    return this.claimedAchievementIds.has(id);
  }

  claimAchievement(id) {
    if (!id || this.isAchievementClaimed(id)) return false;
    this.claimedAchievementIds.add(id);
    return true;
  }

  getSaveData() {
    return {
      claimedAchievementIds: Array.from(this.claimedAchievementIds),
    };
  }

  loadSaveData(data) {
    const ids = Array.isArray(data?.claimedAchievementIds)
      ? data.claimedAchievementIds
      : [];
    this.claimedAchievementIds = new Set(ids.filter((id) => typeof id === "string"));
  }
}

export function getProgressionSystemInstance() {
  if (!instance) {
    instance = new ProgressionSystem();
  }
  return instance;
}
