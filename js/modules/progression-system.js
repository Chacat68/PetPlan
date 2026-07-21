import {
  FIRST_SESSION_STEPS,
  GROWTH_PATHS,
  ONBOARDING_VERSION,
  PATH_RECOMMENDATION_BOOST,
} from "./progression-config.js?v=growth-onboarding-20260720a";

let instance = null;

export class ProgressionSystem {
  constructor() {
    this.claimedAchievementIds = new Set();
    this.onboardingVersion = ONBOARDING_VERSION;
    this.onboardingStatus = "new";
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
    const activeStepIndex = FIRST_SESSION_STEPS.indexOf(activeStep);
    return {
      ...activeStep,
      complete: false,
      current: activeStepIndex + 1,
      completedCount: completedSteps,
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

  getOnboardingState() {
    return {
      version: this.onboardingVersion,
      status: this.onboardingStatus,
      active: this.onboardingStatus === "active",
    };
  }

  startOnboarding() {
    this.onboardingVersion = ONBOARDING_VERSION;
    this.onboardingStatus = "active";
    return this.getOnboardingState();
  }

  dismissOnboarding() {
    this.onboardingVersion = ONBOARDING_VERSION;
    this.onboardingStatus = "dismissed";
    return this.getOnboardingState();
  }

  completeOnboarding() {
    this.onboardingVersion = ONBOARDING_VERSION;
    this.onboardingStatus = "completed";
    return this.getOnboardingState();
  }

  getSaveData() {
    return {
      claimedAchievementIds: Array.from(this.claimedAchievementIds),
      onboardingVersion: this.onboardingVersion,
      onboardingStatus: this.onboardingStatus,
    };
  }

  loadSaveData(data) {
    const ids = Array.isArray(data?.claimedAchievementIds)
      ? data.claimedAchievementIds
      : [];
    this.claimedAchievementIds = new Set(ids.filter((id) => typeof id === "string"));
    const validStatuses = new Set(["new", "active", "dismissed", "completed"]);
    const savedVersion = Number(data?.onboardingVersion) || 0;
    const savedStatus = validStatuses.has(data?.onboardingStatus)
      ? data.onboardingStatus
      : "new";
    this.onboardingVersion = ONBOARDING_VERSION;
    this.onboardingStatus =
      savedVersion === ONBOARDING_VERSION ? savedStatus : "new";
  }
}

export function getProgressionSystemInstance() {
  if (!instance) {
    instance = new ProgressionSystem();
  }
  return instance;
}
