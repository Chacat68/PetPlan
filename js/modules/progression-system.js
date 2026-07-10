import {
  FIRST_SESSION_STEPS,
  GROWTH_PATHS,
  PATH_RECOMMENDATION_BOOST,
} from "./progression-config.js";

let instance = null;

export class ProgressionSystem {
  constructor() {
    this.claimedAchievementIds = new Set();
  }

  getFirstSessionGuide(context = {}) {
    const completedSteps = FIRST_SESSION_STEPS.filter(
      (step) => (Number(context[step.metric]) || 0) >= step.target
    ).length;
    const activeStep = FIRST_SESSION_STEPS.find(
      (step) => (Number(context[step.metric]) || 0) < step.target
    );

    if (!activeStep) {
      return {
        complete: true,
        current: FIRST_SESSION_STEPS.length,
        total: FIRST_SESSION_STEPS.length,
        title: "首局目标完成",
        detail: "自由推进你的成长倾向",
        routeType: "mixed",
        progress: 1,
      };
    }

    const value = Math.max(0, Number(context[activeStep.metric]) || 0);
    return {
      ...activeStep,
      complete: false,
      current: completedSteps + 1,
      total: FIRST_SESSION_STEPS.length,
      value,
      progress: Math.min(1, value / activeStep.target),
    };
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
