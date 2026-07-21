import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_DEFINITIONS,
} from "./achievement-config.js?v=achievement-ui-v3-20260714a";

const SAVE_SCHEMA_VERSION = 2;
const REWARD_KEYS = Object.freeze(["coins", "rubies", "crystals"]);

const normalizeCount = (value) => Math.max(0, Math.floor(Number(value) || 0));
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const normalizeProgressContext = (context = {}) => {
  const normalized = { ...context };
  normalized.bestExtractedDepth = context.bestExtractedDepth
    ?? context.deepestExtraction
    ?? (normalizeCount(context.extractions) > 0 && hasOwn(context, "bestDepth")
      ? context.bestDepth
      : 0);
  normalized.bossKills = context.bossKills ?? context.bossesDefeated ?? 0;
  normalized.flawlessExtractions = context.flawlessExtractions
    ?? context.noDamageExtractions
    ?? 0;
  normalized.bestValue = context.bestValue
    ?? context.bestExtractionValue
    ?? context.highestLootValue
    ?? 0;
  normalized.maxExpeditionPetCount = context.maxExpeditionPetCount
    ?? context.expeditionPetCount
    ?? 0;
  return normalized;
};

let instance = null;

export class AchievementSystem {
  constructor({
    resourceSystem = null,
    definitions = ACHIEVEMENT_DEFINITIONS,
    now = () => Date.now(),
  } = {}) {
    this.resourceSystem = resourceSystem;
    this.definitions = Array.from(definitions || []);
    this.definitionMap = new Map(
      this.definitions.map((definition) => [definition.id, definition])
    );
    this.definitionOrder = new Map(
      this.definitions.map((definition, index) => [definition.id, index])
    );
    this.metricKeys = Array.from(
      new Set(this.definitions.map((definition) => definition.metric))
    );
    this.now = typeof now === "function" ? now : () => Date.now();
    this.onChange = null;
    this.resetState();
  }

  resetState() {
    this.claimedIds = new Set();
    this.completedAtById = {};
    this.highWaterMarks = {};
  }

  setResourceSystem(resourceSystem) {
    this.resourceSystem = resourceSystem;
  }

  setOnChange(callback) {
    this.onChange = typeof callback === "function" ? callback : null;
  }

  hasCompleted(id) {
    return Object.prototype.hasOwnProperty.call(this.completedAtById, id);
  }

  isClaimed(id) {
    return this.claimedIds.has(id);
  }

  getCurrentValue(definitionOrId) {
    const definition =
      typeof definitionOrId === "string"
        ? this.definitionMap.get(definitionOrId)
        : definitionOrId;
    return definition ? normalizeCount(this.highWaterMarks[definition.metric]) : 0;
  }

  updateProgress(context = {}, { notify = true, announce = true } = {}) {
    let changed = false;
    const newCompletions = [];
    const normalizedContext = normalizeProgressContext(context);

    for (const metric of this.metricKeys) {
      const previous = normalizeCount(this.highWaterMarks[metric]);
      const next = Math.max(previous, normalizeCount(normalizedContext[metric]));
      if (next !== previous) {
        this.highWaterMarks[metric] = next;
        changed = true;
      }
    }

    for (const definition of this.definitions) {
      if (
        !this.hasCompleted(definition.id) &&
        this.getCurrentValue(definition) >= definition.target
      ) {
        this.completedAtById[definition.id] = Math.max(1, normalizeCount(this.now()));
        newCompletions.push(definition);
        changed = true;
      }
    }

    const result = {
      changed,
      announce: Boolean(announce),
      newCompletions,
      summary: this.getSummary(),
    };
    if (changed && notify) this.onChange?.({ type: "progress", ...result });
    return result;
  }

  getItem(id) {
    const definition = this.definitionMap.get(id);
    if (!definition) return null;
    const current = this.getCurrentValue(definition);
    const completed = this.hasCompleted(id);
    const claimed = this.isClaimed(id);
    return {
      ...definition,
      current,
      completed,
      claimed,
      claimable: completed && !claimed,
      completedAt: this.completedAtById[id] || null,
    };
  }

  getItems(category = "all") {
    const categoryOrder = new Map(
      ACHIEVEMENT_CATEGORIES.map((entry, index) => [entry.id, index])
    );
    return this.definitions
      .filter(
        (definition) => category === "all" || definition.category === category
      )
      .map((definition) => this.getItem(definition.id))
      .sort((left, right) => {
        const stateRank = (item) => (item.claimable ? 0 : item.claimed ? 2 : 1);
        return (
          stateRank(left) - stateRank(right) ||
          (categoryOrder.get(left.category) || 0) -
            (categoryOrder.get(right.category) || 0) ||
          (this.definitionOrder.get(left.id) || 0) -
            (this.definitionOrder.get(right.id) || 0)
        );
      });
  }

  getSummary() {
    const items = this.definitions.map((definition) => this.getItem(definition.id));
    return {
      total: items.length,
      completed: items.filter((item) => item.completed).length,
      claimed: items.filter((item) => item.claimed).length,
      claimable: items.filter((item) => item.claimable).length,
    };
  }

  claimReward(id) {
    const item = this.getItem(id);
    if (!item) return { success: false, reason: "not_found" };
    if (item.claimed) return { success: false, reason: "claimed", item };
    if (!item.completed) return { success: false, reason: "incomplete", item };

    this.claimedIds.add(id);
    this.applyReward(item.reward);
    const result = { success: true, item: this.getItem(id), reward: item.reward };
    this.onChange?.({
      type: "claimed",
      claimedItems: [result.item],
      reward: { ...item.reward },
      summary: this.getSummary(),
    });
    return result;
  }

  claimAllRewards() {
    const claimableItems = this.getItems("all").filter((item) => item.claimable);
    if (claimableItems.length === 0) {
      return { success: false, reason: "none", claimedItems: [], reward: {} };
    }

    const reward = {};
    for (const item of claimableItems) {
      this.claimedIds.add(item.id);
      for (const key of REWARD_KEYS) {
        reward[key] = normalizeCount(reward[key]) + normalizeCount(item.reward[key]);
      }
    }
    this.applyReward(reward);

    const claimedItems = claimableItems.map((item) => this.getItem(item.id));
    const result = { success: true, claimedItems, reward };
    this.onChange?.({
      type: "claimed-all",
      ...result,
      summary: this.getSummary(),
    });
    return result;
  }

  applyReward(reward = {}) {
    if (!this.resourceSystem) return;
    if (normalizeCount(reward.coins) > 0) {
      this.resourceSystem.addCoins(normalizeCount(reward.coins));
    }
    if (normalizeCount(reward.rubies) > 0) {
      this.resourceSystem.addRubies(normalizeCount(reward.rubies));
    }
    if (normalizeCount(reward.crystals) > 0) {
      this.resourceSystem.addCrystals(normalizeCount(reward.crystals));
    }
  }

  getSaveData() {
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      claimedIds: Array.from(this.claimedIds),
      completedAtById: { ...this.completedAtById },
      highWaterMarks: { ...this.highWaterMarks },
    };
  }

  loadSaveData(data = {}) {
    this.resetState();
    if (!data || typeof data !== "object") return this.getSummary();

    const claimedIds = Array.isArray(data.claimedIds)
      ? data.claimedIds
      : Array.isArray(data.claimedAchievementIds)
        ? data.claimedAchievementIds
        : [];
    this.claimedIds = new Set(
      claimedIds.filter((id) => this.definitionMap.has(id))
    );

    if (data.completedAtById && typeof data.completedAtById === "object") {
      for (const [id, timestamp] of Object.entries(data.completedAtById)) {
        if (!this.definitionMap.has(id)) continue;
        this.completedAtById[id] = Math.max(1, normalizeCount(timestamp));
      }
    }
    if (data.highWaterMarks && typeof data.highWaterMarks === "object") {
      const migratedMarks = normalizeProgressContext(data.highWaterMarks);
      for (const metric of this.metricKeys) {
        this.highWaterMarks[metric] = normalizeCount(migratedMarks[metric]);
      }
    }

    for (const id of this.claimedIds) {
      this.completedAtById[id] ||= 1;
    }
    return this.getSummary();
  }
}

export function getAchievementSystemInstance(resourceSystem = null) {
  if (!instance) {
    instance = new AchievementSystem({ resourceSystem });
  } else if (resourceSystem) {
    instance.setResourceSystem(resourceSystem);
  }
  return instance;
}
