/**
 * TerritorySystem - persistent territory progression and economy.
 *
 * Territory v2 separates permanent base rank from the legacy growth pulse.
 * Pulse is still exposed as an explanatory signal for recommendations, while
 * rank, building sites, production and preparation buffs are authoritative.
 */

import {
  TERRITORY_BUILDING_SITES,
  TERRITORY_PROGRESSION_CONFIG,
  TERRITORY_RANK_CONFIG,
} from "./progression-config.js?v=r1-r2-bridge-20260724a";

let instance = null;

const TERRITORY_VERSION = 3;
const PRODUCTION_EFFICIENCY = 0.5;
// 工坊金币只保留为低强度离线补贴；其主要定位转为处理远征材料。
const WORKSHOP_PRODUCTION_EFFICIENCY = 0.12;
const ACTIVITY_COOLDOWN_MS = 5 * 60 * 1000;
const MEANINGFUL_COLLECTION = { coins: 100, crystals: 10 };

const clampInt = (value, min, max) => Math.max(
  min,
  Math.min(max, Math.floor(Number(value) || 0))
);

export class TerritorySystem {
  constructor(resourceSystem = null, playerSystem = null) {
    this.resourceSystem = resourceSystem;
    this.playerSystem = playerSystem;
    this.buildingData = {
      main_base: {
        name: "星愿屋",
        icon: "🏡",
        description: "少女与宠物们的温馨之家，启用后开放整座梦幻庭院。",
        baseCost: { coins: 0, crystals: 0 },
        costMultiplier: 1,
        maxLevel: 1,
        productionInterval: 0,
        effects: { type: "base" },
      },
      training_ground: {
        name: "闪耀训练馆",
        icon: "🎀",
        description: "在星光障碍赛中练习配合，并永久提升主角攻击。",
        baseCost: { coins: 400, crystals: 30 },
        costMultiplier: 1.45,
        maxLevel: 5,
        productionInterval: 0,
        effects: { type: "attackBonus", value: 4 },
        activity: "training",
      },
      temple: {
        name: "萌宠疗愈庭",
        icon: "💗",
        description: "让宠物泡泡浴、休息和恢复元气，提升远征防御。",
        baseCost: { coins: 400, crystals: 30 },
        costMultiplier: 1.45,
        maxLevel: 5,
        productionInterval: 0,
        effects: { type: "defenseBonus", value: 3 },
        activity: "blessing",
      },
      workshop: {
        name: "魔法工坊",
        icon: "🪄",
        description: "处理远征材料、制作可爱实用的行动物资，并少量储备金币。",
        baseCost: { coins: 450, crystals: 35 },
        costMultiplier: 1.5,
        maxLevel: 5,
        productionInterval: 60000,
        effects: { type: "production", resource: "coins", value: 45, crafting: true },
        activity: "supply",
      },
      barracks: {
        name: "星光特训屋",
        icon: "🌟",
        description: "进阶默契课程与体能挑战，提供攻防与补给加成。",
        baseCost: { coins: 1200, crystals: 100 },
        costMultiplier: 1.5,
        maxLevel: 5,
        productionInterval: 0,
        effects: { type: "combatBonus", attack: 3, defense: 3 },
        activity: "drill",
      },
      library: {
        name: "星图资料馆",
        icon: "🔭",
        description: "阅读旅行绘本、研究星图路线，提高远征经验结算。",
        baseCost: { coins: 1200, crystals: 100 },
        costMultiplier: 1.5,
        maxLevel: 5,
        productionInterval: 0,
        effects: { type: "expBonus", value: 4 },
        activity: "research",
      },
      crystal_mine: {
        name: "水晶花园",
        icon: "💎",
        description: "悉心培育会发光的魔法水晶花，缓慢获得水晶。",
        baseCost: { coins: 1500, crystals: 150 },
        costMultiplier: 1.55,
        maxLevel: 5,
        productionInterval: 120000,
        effects: { type: "production", resource: "crystals", value: 4 },
        activity: "mining",
      },
    };

    Object.entries(this.buildingData).forEach(([type, data]) => {
      data.site = TERRITORY_BUILDING_SITES[type];
      data.unlock = {
        stage: data.site?.requiredRank || 0,
        pulse: 0,
        label: `领地等级 ${data.site?.requiredRank || 0}`,
      };
    });

    this.slotConfig = {
      initialSlots: 1,
      maxSlots: 12,
      unlockPulses: TERRITORY_PROGRESSION_CONFIG.slotUnlockPulses,
    };
    this.expansionCosts = TERRITORY_RANK_CONFIG.slice(2).map((entry) => ({
      ...entry.cost,
      requiredMainBaseLevel: 1,
    }));
    this.storageKey = "petplan_territory";
    this.onPersist = null;
    this.resetState();
    console.log("[TerritorySystem] v3 初始化完成");
  }

  resetState() {
    this.territoryVersion = TERRITORY_VERSION;
    this.rank = 0;
    this.legacyVeteranRank = 0;
    this.buildings = [];
    this.slots = [];
    this.unlockedSlots = 1;
    this.expansionCount = 0;
    this.lastProductionTime = Date.now();
    this.progressContext = this.createDefaultProgressContext();
    this.preparedBonuses = this.createEmptyPreparedBonuses();
    this.lastActivityAt = {};
    this.initSlots();
  }

  initSlots() {
    this.slots = [];
    for (let index = 0; index < this.slotConfig.maxSlots; index += 1) {
      this.slots.push({ index, unlockPulse: 0, building: null });
    }
    for (const building of this.buildings || []) {
      if (this.slots[building.slotIndex]) this.slots[building.slotIndex].building = building;
    }
  }

  setResourceSystem(resourceSystem) {
    this.resourceSystem = resourceSystem;
  }

  setPlayerSystem(playerSystem) {
    this.playerSystem = playerSystem;
  }

  setOnPersist(callback) {
    this.onPersist = typeof callback === "function" ? callback : null;
  }

  persist() {
    if (this.onPersist) {
      this.onPersist(this.getSaveData());
      return;
    }
    this.saveToLocalStorage();
  }

  createDefaultProgressContext() {
    return {
      totalFlips: 0,
      fateCoins: 1,
      assistants: 0,
      heroTrainingLevel: 0,
      playerLevel: 1,
      equippedPets: 0,
      petLevelTotal: 0,
      buildings: this.buildings?.length || 0,
      expansionCount: this.expansionCount || 0,
      unlockedSlots: this.unlockedSlots || 1,
      bestDepth: 0,
      bestExtractedDepth: 0,
      extractions: 0,
      losses: 0,
    };
  }

  createEmptyPreparedBonuses() {
    return { attack: 0, defense: 0, supplies: 0, expBonus: 0 };
  }

  setProgressContext(context = {}) {
    const previousExtractions = Math.max(0, Number(this.progressContext?.extractions) || 0);
    const hasSuccessfulDepth = Object.prototype.hasOwnProperty.call(context, "bestExtractedDepth");
    const legacySuccessfulDepth = !hasSuccessfulDepth
      && previousExtractions === 0
      && Math.max(0, Number(context.extractions) || 0) > 0
      ? Math.max(0, Number(context.bestDepth) || 0)
      : null;
    const successfulDepth = hasSuccessfulDepth
      ? Math.max(0, Number(context.bestExtractedDepth) || 0)
      : legacySuccessfulDepth;
    this.progressContext = {
      ...this.createDefaultProgressContext(),
      ...this.progressContext,
      ...context,
      ...(successfulDepth !== null ? {
        bestExtractedDepth: Math.max(
          Math.max(0, Number(this.progressContext?.bestExtractedDepth) || 0),
          successfulDepth
        )
      } : {}),
      buildings: this.buildings.length,
      expansionCount: this.expansionCount,
      unlockedSlots: this.getEffectiveUnlockedSlots(),
    };
    return this.getProgressSummary();
  }

  getRankConfig(rank = this.rank) {
    return TERRITORY_RANK_CONFIG[clampInt(rank, 0, TERRITORY_RANK_CONFIG.length - 1)];
  }

  getNextRankConfig() {
    return TERRITORY_RANK_CONFIG[this.rank + 1] || null;
  }

  getWorldWidth() {
    const occupiedX = this.buildings.reduce((max, building) => (
      Math.max(max, this.buildingData[building.type]?.site?.x || 0)
    ), 0);
    return Math.max(this.getRankConfig().worldWidth, occupiedX + 420);
  }

  getBuildingEntries() {
    return Object.entries(this.buildingData).sort(([, a], [, b]) => (
      (a.site?.slotIndex || 0) - (b.site?.slotIndex || 0)
    ));
  }

  getBuildingByType(type) {
    return this.buildings.find((building) => building.type === type) || null;
  }

  getBuildingAt(slotIndex) {
    return this.buildings.find((building) => building.slotIndex === slotIndex) || null;
  }

  getBuildings() {
    return this.buildings.slice();
  }

  getBuildingLevel(type) {
    return this.getBuildingByType(type)?.level || 0;
  }

  getConstructionScore() {
    return this.buildings.reduce((score, building) => (
      score + (building.type === "main_base" ? 0 : building.level)
    ), 0);
  }

  getLoopPulseBreakdown(context = this.progressContext) {
    const safe = { ...this.createDefaultProgressContext(), ...context };
    const weights = TERRITORY_PROGRESSION_CONFIG.pulseWeights;
    const extraPetLevels = Math.max(0, safe.petLevelTotal - safe.equippedPets);
    const additionalEquippedPets = Math.max(0, safe.equippedPets - 1);
    return [
      { id: "flips", label: "翻转", value: Math.min(Math.max(0, safe.totalFlips), weights.totalFlipsCap) * weights.totalFlips },
      { id: "table", label: "硬币", value: Math.max(0, safe.fateCoins - 1) * weights.fateCoins },
      { id: "assistants", label: "助手", value: safe.assistants * weights.assistants },
      { id: "hero", label: "训练", value: safe.heroTrainingLevel * weights.heroTrainingLevel },
      { id: "pets", label: "额外上阵", value: additionalEquippedPets * weights.equippedPets },
      { id: "petLevels", label: "宠物成长", value: extraPetLevels * weights.extraPetLevels },
      // Resonance records exploration effort; only rank gates below require a
      // successful extraction depth.
      { id: "expedition", label: "远征", value: safe.bestDepth * 8 + safe.extractions * 12 },
    ];
  }

  getLoopPulse(context = this.progressContext) {
    return Math.floor(this.getLoopPulseBreakdown(context).reduce(
      (total, contribution) => total + contribution.value,
      0
    ));
  }

  getSlotUnlockPulse(slotIndex) {
    return this.slotConfig.unlockPulses[slotIndex] ?? 0;
  }

  getLoopUnlockedSlotCount() {
    return this.getRankConfig().slots;
  }

  getHighestOccupiedSlot() {
    return this.buildings.reduce((highest, building) => Math.max(highest, building.slotIndex), -1);
  }

  getEffectiveUnlockedSlots() {
    return Math.min(
      this.slotConfig.maxSlots,
      Math.max(this.getRankConfig().slots, this.getHighestOccupiedSlot() + 1)
    );
  }

  isSlotUnlocked(slotIndex) {
    return slotIndex >= 0 && slotIndex < this.getEffectiveUnlockedSlots();
  }

  getSlotState(slotIndex) {
    const building = this.getBuildingAt(slotIndex);
    if (building) return "built";
    if (!this.isSlotUnlocked(slotIndex)) return "locked";
    return "empty";
  }

  getBlueprintRequirements(type) {
    if (type === "barracks") {
      return [
        { id: "rank", label: "领地达到 R2", met: this.rank >= 2 },
        { id: "training", label: "闪耀训练馆达到 Lv.2", met: this.getBuildingLevel("training_ground") >= 2 },
        { id: "depth", label: "从区域 3 成功撤离", met: this.progressContext.bestExtractedDepth >= 3 },
      ];
    }
    if (type === "library") {
      return [
        { id: "rank", label: "领地达到 R2", met: this.rank >= 2 },
        { id: "temple", label: "萌宠疗愈庭达到 Lv.2", met: this.getBuildingLevel("temple") >= 2 },
        { id: "pets", label: "至少上阵 2 只宠物", met: this.progressContext.equippedPets >= 2 },
      ];
    }
    if (type === "crystal_mine") {
      return [
        { id: "rank", label: "领地达到 R3", met: this.rank >= 3 },
        { id: "workshop", label: "工坊达到 Lv.2", met: this.getBuildingLevel("workshop") >= 2 },
        { id: "extraction", label: "至少成功撤离 1 次", met: this.progressContext.extractions >= 1 },
      ];
    }
    const requiredRank = this.buildingData[type]?.site?.requiredRank || 0;
    return [{ id: "rank", label: `领地达到 R${requiredRank}`, met: this.rank >= requiredRank }];
  }

  getBuildingUnlockState(type) {
    const data = this.buildingData[type];
    if (!data) return { unlocked: false, reason: "无效建筑", requirements: [] };
    const requirements = this.getBlueprintRequirements(type);
    const unmet = requirements.filter((requirement) => !requirement.met);
    return {
      unlocked: unmet.length === 0,
      reason: unmet.length === 0 ? "蓝图已开放" : unmet[0].label,
      requirements,
      requiredRank: data.site?.requiredRank || 0,
      stage: data.site?.requiredRank || 0,
      requiredPulse: 0,
      pulse: this.getLoopPulse(),
      label: unmet.length === 0 ? "蓝图已开放" : unmet.map((item) => item.label).join(" · "),
    };
  }

  isBuildingTypeUnlocked(type) {
    return this.getBuildingUnlockState(type).unlocked;
  }

  getUnlockedBuildingTypes() {
    return this.getBuildingEntries()
      .filter(([type]) => this.isBuildingTypeUnlocked(type))
      .map(([type]) => type);
  }

  getNextBuildingUnlock() {
    return this.getBuildingEntries()
      .map(([type, data]) => ({ type, data, state: this.getBuildingUnlockState(type) }))
      .find((entry) => !entry.state.unlocked) || null;
  }

  getNextSlotUnlock() {
    const next = this.getNextRankConfig();
    if (!next) return null;
    return { index: this.getEffectiveUnlockedSlots(), requiredRank: next.rank, pulse: this.getLoopPulse() };
  }

  getRankRequirementState(targetRank = this.rank + 1) {
    const config = TERRITORY_RANK_CONFIG[targetRank];
    if (!config) return { complete: true, checks: [], progress: 1, config: null };
    const values = {
      mainBase: this.getBuildingLevel("main_base"),
      bestExtractedDepth: this.progressContext.bestExtractedDepth || 0,
      extractions: this.progressContext.extractions || 0,
      constructionScore: this.getConstructionScore(),
    };
    const labels = {
      mainBase: "启用星愿屋",
      bestExtractedDepth: "成功撤离深度",
      extractions: "成功撤离",
      constructionScore: "建设度",
    };
    const checks = Object.entries(config.requirements).map(([metric, target]) => ({
      metric,
      label: labels[metric] || metric,
      value: values[metric] || 0,
      target,
      met: (values[metric] || 0) >= target,
    }));
    const cost = config.cost || { coins: 0, crystals: 0 };
    const resourceChecks = [
      { metric: "coins", label: "金币", value: this.resourceSystem?.coins || 0, target: cost.coins, met: (this.resourceSystem?.coins || 0) >= cost.coins },
      { metric: "crystals", label: "水晶", value: this.resourceSystem?.crystals || 0, target: cost.crystals, met: (this.resourceSystem?.crystals || 0) >= cost.crystals },
    ].filter((check) => check.target > 0);
    const allChecks = [...checks, ...resourceChecks];
    return {
      complete: allChecks.every((check) => check.met),
      checks: allChecks,
      progress: allChecks.length === 0 ? 1 : allChecks.filter((check) => check.met).length / allChecks.length,
      config,
    };
  }

  getRankRequirementOverview(targetRank = this.rank + 1) {
    const state = this.getRankRequirementState(targetRank);
    if (!state.config) return null;
    const checks = state.checks.map((check) => ({
      ...check,
      gap: Math.max(0, check.target - check.value),
    }));
    return {
      targetRank,
      complete: state.complete,
      checks,
      text: checks.map((check) => (
        `${check.label} ${check.value}/${check.target}${check.met ? "（完成）" : `（差${check.gap}）`}`
      )).join(" · "),
    };
  }

  getDistrictLabel(path) {
    const labels = {
      core: "星愿广场",
      hero: "闪耀训练区",
      companion: "萌宠疗愈区",
      territory: "梦工坊街区",
      gate: "次元探索区",
    };
    return labels[path] || "庭院设施";
  }

  getRequirementGoal(requirement) {
    if (!requirement) return null;
    const shared = {
      kind: "requirement",
      action: "progress",
      status: "in_progress",
      metric: requirement.metric,
      value: requirement.value,
      target: requirement.target,
      requirement: { ...requirement },
      blockers: requirement.met ? [] : [{ ...requirement, gap: Math.max(0, requirement.target - requirement.value) }],
    };
    const progress = `${requirement.value} / ${requirement.target}`;
    const definitions = {
      bestExtractedDepth: {
        title: `从区域 ${requirement.target} 成功撤离`,
        detail: `当前成功撤离最深区域 ${progress}`,
        scene: "territory",
        ctaLabel: "前往次元探索门",
        route: "远征目标",
        routeType: "combat",
      },
      extractions: {
        title: `成功撤离 ${requirement.target} 次`,
        detail: `当前撤离次数 ${progress}`,
        scene: "territory",
        ctaLabel: "前往次元探索门",
        route: "远征目标",
        routeType: "combat",
      },
      constructionScore: {
        title: `提升建设度至 ${requirement.target}`,
        detail: `当前建设度 ${progress}，布置或升级庭院设施`,
        scene: "territory",
        ctaLabel: "前往领地",
        route: "领地目标",
        routeType: "territory",
      },
      coins: {
        title: `积累 ${requirement.target} 金币`,
        detail: `当前金币 ${progress}，远征或收取基地储备`,
        scene: "territory",
        ctaLabel: "返回领地",
        route: "资源目标",
        routeType: "combat",
      },
      crystals: {
        title: `积累 ${requirement.target} 水晶`,
        detail: this.rank < 3
          ? `当前水晶 ${progress}；首次成功撤离、远征战斗、合约与成就均可获得`
          : `当前水晶 ${progress}；远征、合约、成就或收取水晶花园储备`,
        scene: "territory",
        ctaLabel: "返回领地",
        route: "资源目标",
        routeType: "combat",
      },
    };
    return { ...shared, ...(definitions[requirement.metric] || {
      title: `推进${requirement.label}`,
      detail: progress,
      scene: "territory",
      ctaLabel: "前往领地",
      route: "领地目标",
      routeType: "territory",
    }) };
  }

  getResourceBlockers(cost = {}) {
    const resources = {
      coins: this.resourceSystem?.coins || 0,
      crystals: this.resourceSystem?.crystals || 0,
    };
    const labels = { coins: "金币", crystals: "水晶" };
    return Object.entries(cost)
      .filter(([metric, target]) => (target || 0) > (resources[metric] || 0))
      .map(([metric, target]) => ({
        metric,
        label: labels[metric] || metric,
        value: resources[metric] || 0,
        target,
        gap: target - (resources[metric] || 0),
      }));
  }

  getConstructionGoalOptions() {
    const options = [];
    this.getBuildingEntries().forEach(([type, data]) => {
      if (type === "main_base" || this.getBuildingByType(type)) return;
      if (data.site.slotIndex >= this.getEffectiveUnlockedSlots()) return;
      if (!this.getBuildingUnlockState(type).unlocked) return;
      const cost = this.calculateBuildCost(type);
      options.push({
        kind: "build",
        action: "build",
        buildingType: type,
        title: `建设${data.name}`,
        detail: `前往${this.getDistrictLabel(data.site.path)}分区查看施工点`,
        cost,
        blockers: this.getResourceBlockers(cost),
        ready: this.canBuild(type, data.site.slotIndex).success,
      });
    });
    this.buildings.forEach((building) => {
      if (building.type === "main_base") return;
      const data = this.buildingData[building.type];
      if (!data || building.level >= this.getBuildingLevelCap(building.type)) return;
      const cost = this.calculateUpgradeCost(building.type, building.level);
      options.push({
        kind: "upgrade",
        action: "upgrade",
        buildingType: building.type,
        slotIndex: building.slotIndex,
        title: `升级${data.name}至 Lv.${building.level + 1}`,
        detail: `升级后建设度 +1`,
        cost,
        blockers: this.getResourceBlockers(cost),
        ready: this.canUpgrade(building.slotIndex).success,
      });
    });
    return options;
  }

  createConstructionGoal(option, status = option?.ready ? "ready" : "blocked") {
    if (!option) return null;
    const costText = `${option.cost.coins || 0} 金币 / ${option.cost.crystals || 0} 水晶`;
    const gapText = option.blockers.map((item) => `还差 ${item.gap} ${item.label}`).join("、");
    const r2UnlockPayoff = this.rank === 2 && option.kind === "upgrade"
      ? {
          training_ground: "完成后推进星光特训屋蓝图解锁",
          temple: "完成后推进星图资料馆蓝图解锁",
        }[option.buildingType] || ""
      : "";
    const payoffText = r2UnlockPayoff ? ` · ${r2UnlockPayoff}` : "";
    return {
      ...option,
      status,
      detail: status === "ready"
        ? `${option.detail}${payoffText} · 费用 ${costText}`
        : `费用 ${costText}；${gapText || "当前条件不足"}${payoffText}`,
      scene: "territory",
      ctaLabel: "前往领地",
      route: "领地目标",
      routeType: "territory",
    };
  }

  shouldPrioritizeCollection(production, resourceBlockers = []) {
    if (!production) return false;
    const reachesThreshold =
      (production.coins || 0) >= MEANINGFUL_COLLECTION.coins ||
      (production.crystals || 0) >= MEANINGFUL_COLLECTION.crystals;
    const capped = production.buildings?.some((building) => building.capped) || false;
    const closesGap = resourceBlockers.some((blocker) => (
      (production[blocker.metric] || 0) >= blocker.gap
    ));
    return capped || reachesThreshold || closesGap;
  }

  createCollectionGoal(production) {
    return {
      kind: "collect",
      action: "collect",
      status: "ready",
      blockers: [],
      title: "收取庭院储备",
      detail: `工坊与矿区共储备 ${production.coins || 0} 金币、${production.crystals || 0} 水晶`,
      scene: "territory",
      ctaLabel: "前往领地",
      route: "领地目标",
      routeType: "territory",
    };
  }

  getNextProgressionGoal(production = this.getProductionSnapshot()) {
    if (!this.getBuildingByType("main_base")) {
      return {
        kind: "build",
        action: "build",
        status: "ready",
        blockers: [],
        buildingType: "main_base",
        title: "点亮星愿屋",
        detail: "前往庭院中央，与星愿屋互动并启用它",
        scene: "territory",
        ctaLabel: "前往领地",
        route: "领地目标",
        routeType: "territory",
      };
    }

    const promotion = this.canExpand();
    if (promotion.success) {
      return {
        kind: "promote",
        action: "promote",
        status: "ready",
        blockers: [],
        title: `庭院升阶为 R${promotion.next.rank}`,
        detail: "返回星愿屋完成升阶，开放新的庭院区域",
        scene: "territory",
        ctaLabel: "前往领地",
        route: "领地目标",
        routeType: "territory",
      };
    }

    const requirementState = this.getRankRequirementState();
    const missingProgress = requirementState.checks.filter((check) => (
      !check.met && check.metric !== "coins" && check.metric !== "crystals"
    ));
    const missingConstruction = missingProgress.find((check) => check.metric === "constructionScore");
    const constructionOptions = this.getConstructionGoalOptions();
    const readyConstruction = constructionOptions.find((option) => option.ready);
    if (missingConstruction && readyConstruction) {
      return this.createConstructionGoal(readyConstruction);
    }
    if (this.rank === 2 && missingConstruction) {
      const r2FacilityStep = constructionOptions.find((option) => (
        option.kind === "upgrade"
        && (option.buildingType === "training_ground" || option.buildingType === "temple")
      ));
      if (r2FacilityStep) {
        return this.createConstructionGoal(
          r2FacilityStep,
          r2FacilityStep.ready ? "ready" : "blocked"
        );
      }
    }

    const expeditionRequirement = missingProgress.find((check) => (
      check.metric === "bestExtractedDepth" || check.metric === "extractions"
    ));
    if (expeditionRequirement) return this.getRequirementGoal(expeditionRequirement);

    if (missingConstruction) {
      const blockedConstruction = constructionOptions[0];
      if (blockedConstruction) return this.createConstructionGoal(blockedConstruction, "blocked");
      return this.getRequirementGoal(missingConstruction);
    }

    const resourceRequirement = requirementState.checks.find((check) => (
      !check.met && (check.metric === "coins" || check.metric === "crystals")
    ));
    const resourceBlockers = requirementState.checks
      .filter((check) => !check.met && (check.metric === "coins" || check.metric === "crystals"))
      .map((check) => ({ ...check, gap: check.target - check.value }));
    if (this.shouldPrioritizeCollection(production, resourceBlockers)) {
      return this.createCollectionGoal(production);
    }
    if (resourceRequirement) return this.getRequirementGoal(resourceRequirement);

    if (readyConstruction) {
      return { ...this.createConstructionGoal(readyConstruction), status: "optional" };
    }

    if (this.shouldPrioritizeCollection(production)) return this.createCollectionGoal(production);

    return {
      kind: "prepare",
      action: "depart",
      status: "optional",
      blockers: [],
      title: "完成庭院准备后进入远征",
      detail: "训练、疗愈或制作补给，再前往次元探索门",
      scene: "territory",
      ctaLabel: "前往次元探索门",
      route: "远征目标",
      routeType: "combat",
    };
  }

  getProgressSummary() {
    const pulse = this.getLoopPulse();
    const nextBuilding = this.getNextBuildingUnlock();
    const nextRankState = this.getRankRequirementState();
    const production = this.getProductionSnapshot();
    const rankRequirementOverview = this.getRankRequirementOverview();
    const baseNextGoal = this.getNextProgressionGoal(production);
    const nextGoal = this.rank === 1 && rankRequirementOverview
      ? {
          ...baseNextGoal,
          detail: `${baseNextGoal.detail}｜R2总进度：${rankRequirementOverview.text}`,
          rankRequirementOverview,
        }
      : baseNextGoal;
    return {
      pulse,
      pulseBreakdown: this.getLoopPulseBreakdown(),
      stage: this.rank,
      rank: this.rank,
      rankName: this.getRankConfig().name,
      constructionScore: this.getConstructionScore(),
      unlockedSlots: this.getEffectiveUnlockedSlots(),
      maxSlots: this.slotConfig.maxSlots,
      unlockedBuildingTypes: this.getUnlockedBuildingTypes(),
      nextBuilding,
      nextSlot: this.getNextSlotUnlock(),
      nextRank: nextRankState.config,
      rankRequirements: nextRankState.checks,
      nextGoal,
      nextTargetPulse: pulse,
      progress: nextRankState.progress,
      worldWidth: this.getWorldWidth(),
      preparedBonuses: { ...this.preparedBonuses },
      production,
      workshop: this.getWorkshopCapabilities(),
      legacyVeteranRank: this.legacyVeteranRank,
    };
  }

  calculateBuildCost(type) {
    const data = this.buildingData[type];
    return data ? { ...data.baseCost } : null;
  }

  getBuildingLevelCap(type) {
    const data = this.buildingData[type];
    if (!data) return 0;
    if (type === "main_base") return 1;
    return Math.min(data.maxLevel, Math.max(2, this.rank + 1));
  }

  calculateUpgradeCost(type, currentLevel) {
    const data = this.buildingData[type];
    if (!data || type === "main_base") return { coins: 0, crystals: 0 };
    const multiplier = Math.pow(data.costMultiplier, Math.max(0, currentLevel - 1));
    return {
      coins: Math.floor(data.baseCost.coins * multiplier),
      crystals: Math.floor(data.baseCost.crystals * multiplier),
    };
  }

  canBuild(type, slotIndex = this.buildingData[type]?.site?.slotIndex) {
    const data = this.buildingData[type];
    if (!data) return { success: false, reason: "无效建筑" };
    const expectedSlot = data.site?.slotIndex;
    if (slotIndex !== expectedSlot) return { success: false, reason: "该建筑只能在对应分区建造" };
    if (!this.isSlotUnlocked(slotIndex)) return { success: false, reason: `需要领地达到 R${data.site.requiredRank}` };
    if (this.getBuildingByType(type)) return { success: false, reason: `${data.name}只能建造一座` };
    const unlockState = this.getBuildingUnlockState(type);
    if (!unlockState.unlocked) return { success: false, reason: unlockState.reason, unlockState };
    if (!this.resourceSystem) return { success: false, reason: "资源系统未初始化" };
    const cost = this.calculateBuildCost(type);
    if (!this.resourceSystem.hasEnoughCoins(cost.coins)) return { success: false, reason: "金币不足" };
    if (!this.resourceSystem.hasEnoughCrystals(cost.crystals)) return { success: false, reason: "水晶不足" };
    return { success: true, cost };
  }

  buildBuilding(type, slotIndex = this.buildingData[type]?.site?.slotIndex) {
    const result = this.canBuild(type, slotIndex);
    if (!result.success) return result;
    const cost = result.cost;
    this.resourceSystem.spendCoins(cost.coins);
    this.resourceSystem.spendCrystals(cost.crystals);
    const building = {
      id: `building_${type}_${Date.now()}`,
      type,
      slotIndex,
      level: 1,
      lastProduction: Date.now(),
      investedCoins: cost.coins,
      investedCrystals: cost.crystals,
      position: { x: this.buildingData[type].site.x, y: 0 },
    };
    this.buildings.push(building);
    this.slots[slotIndex].building = building;
    if (type === "main_base" && this.rank === 0) {
      this.rank = 1;
      this.expansionCount = 0;
      this.unlockedSlots = this.getRankConfig().slots;
    }
    this.setProgressContext(this.progressContext);
    this.persist();
    return { success: true, building, message: `${this.buildingData[type].name}建造完成` };
  }

  debugBuildBuilding(type, position = {}) {
    const data = this.buildingData[type];
    if (!data || this.getBuildingByType(type)) return false;
    while (this.rank < data.site.requiredRank) this.rank += 1;
    const building = {
      id: `building_${type}_${Date.now()}`,
      type,
      slotIndex: data.site.slotIndex,
      level: 1,
      lastProduction: Date.now(),
      investedCoins: data.baseCost.coins,
      investedCrystals: data.baseCost.crystals,
      position: { x: data.site.x, y: Number(position.y) || 0 },
    };
    this.buildings.push(building);
    this.initSlots();
    if (type === "main_base") this.rank = Math.max(1, this.rank);
    this.unlockedSlots = this.getEffectiveUnlockedSlots();
    this.persist();
    return true;
  }

  canUpgrade(slotIndex) {
    const building = this.getBuildingAt(slotIndex);
    if (!building) return { success: false, reason: "该位置没有建筑" };
    if (building.type === "main_base") return { success: false, reason: "星愿屋会随庭院升阶一同成长" };
    const cap = this.getBuildingLevelCap(building.type);
    if (building.level >= cap) return { success: false, reason: `当前领地等级上限为 Lv.${cap}` };
    const cost = this.calculateUpgradeCost(building.type, building.level);
    if (!this.resourceSystem?.hasEnoughCoins(cost.coins)) return { success: false, reason: "金币不足", cost };
    if (!this.resourceSystem?.hasEnoughCrystals(cost.crystals)) return { success: false, reason: "水晶不足", cost };
    return { success: true, cost };
  }

  upgradeBuilding(slotIndex) {
    const result = this.canUpgrade(slotIndex);
    if (!result.success) return result;
    const building = this.getBuildingAt(slotIndex);
    this.resourceSystem.spendCoins(result.cost.coins);
    this.resourceSystem.spendCrystals(result.cost.crystals);
    building.investedCoins += result.cost.coins;
    building.investedCrystals += result.cost.crystals;
    building.level += 1;
    this.setProgressContext(this.progressContext);
    this.persist();
    return { success: true, building, message: `${this.buildingData[building.type].name}升级至 Lv.${building.level}` };
  }

  demolishBuilding(slotIndex) {
    const building = this.getBuildingAt(slotIndex);
    if (!building) return { success: false, reason: "该位置没有建筑" };
    if (building.type === "main_base") return { success: false, reason: "星愿屋不能移除" };
    const refund = {
      coins: Math.floor((building.investedCoins || 0) * 0.7),
      crystals: Math.floor((building.investedCrystals || 0) * 0.7),
    };
    this.resourceSystem?.addCoins(refund.coins);
    this.resourceSystem?.addCrystals(refund.crystals);
    this.buildings = this.buildings.filter((item) => item.id !== building.id);
    this.initSlots();
    this.setProgressContext(this.progressContext);
    this.persist();
    return { success: true, refund, message: `建筑已拆除，返还70%累计投入` };
  }

  getNextExpansionCost() {
    return this.getNextRankConfig()?.cost ? { ...this.getNextRankConfig().cost } : null;
  }

  canExpand() {
    const next = this.getNextRankConfig();
    if (!next) return { success: false, reason: "领地已达到最高等级" };
    if (!this.getBuildingByType("main_base")) return { success: false, reason: "请先启用星愿屋" };
    const state = this.getRankRequirementState(next.rank);
    if (!state.complete) {
      const missing = state.checks.find((check) => !check.met);
      return { success: false, reason: missing ? `${missing.label} ${missing.value}/${missing.target}` : "升阶条件未满足", requirementState: state };
    }
    return { success: true, cost: { ...next.cost }, next, requirementState: state };
  }

  expandTerritory() {
    const result = this.canExpand();
    if (!result.success) return result;
    this.resourceSystem.spendCoins(result.cost.coins);
    this.resourceSystem.spendCrystals(result.cost.crystals);
    this.rank = result.next.rank;
    const promotionReward = {
      coins: Math.max(0, Number(result.next.promotionReward?.coins) || 0),
      crystals: Math.max(0, Number(result.next.promotionReward?.crystals) || 0),
    };
    if (promotionReward.coins > 0) this.resourceSystem?.addCoins(promotionReward.coins);
    if (promotionReward.crystals > 0) this.resourceSystem?.addCrystals(promotionReward.crystals);
    this.expansionCount = Math.max(0, this.rank - 1);
    this.unlockedSlots = this.getEffectiveUnlockedSlots();
    this.setProgressContext(this.progressContext);
    this.persist();
    return {
      success: true,
      rank: this.rank,
      rankName: result.next.name,
      unlockedSlots: this.unlockedSlots,
      promotionReward,
      message: `领地升阶为 R${this.rank} · ${result.next.name}`
        + (promotionReward.coins || promotionReward.crystals
          ? `；获赠 ${promotionReward.coins} 金币 / ${promotionReward.crystals} 水晶。下一步：升级闪耀训练馆或萌宠疗愈庭，解锁 R2 新设施`
          : ""),
    };
  }

  getWorkshopCapabilities() {
    const workshop = this.getBuildingByType("workshop");
    const level = clampInt(workshop?.level, 0, this.buildingData.workshop.maxLevel);
    const data = this.buildingData.workshop;
    return {
      unlocked: level > 0,
      level,
      role: "expedition-crafting",
      queueSlots: level > 0 ? 1 + Math.floor((level - 1) / 2) : 0,
      recipeTier: Math.min(3, level),
      passiveCoinRatePerMinute: Number((
        (data.effects?.value || 0) * level * WORKSHOP_PRODUCTION_EFFICIENCY
      ).toFixed(2)),
      productionEfficiency: WORKSHOP_PRODUCTION_EFFICIENCY,
    };
  }

  getProductionSnapshot(now = Date.now()) {
    const capMs = this.getRankConfig().storageHours * 60 * 60 * 1000;
    const totals = { coins: 0, crystals: 0 };
    const buildings = [];
    for (const building of this.buildings) {
      const data = this.buildingData[building.type];
      if (!data || data.effects?.type !== "production" || data.productionInterval <= 0) continue;
      const elapsed = Math.max(0, now - (building.lastProduction || now));
      const cappedElapsed = Math.min(elapsed, capMs);
      const cycles = Math.floor(cappedElapsed / data.productionInterval);
      const efficiency = building.type === "workshop"
        ? WORKSHOP_PRODUCTION_EFFICIENCY
        : PRODUCTION_EFFICIENCY;
      const amount = Math.floor(data.effects.value * building.level * cycles * efficiency);
      if (amount > 0) totals[data.effects.resource] += amount;
      buildings.push({
        type: building.type,
        resource: data.effects.resource,
        amount,
        cycles,
        elapsed,
        capped: elapsed > capMs,
      });
    }
    return { ...totals, buildings, storageHours: this.getRankConfig().storageHours, efficiency: PRODUCTION_EFFICIENCY };
  }

  collectResources(now = Date.now()) {
    const snapshot = this.getProductionSnapshot(now);
    if (snapshot.coins > 0) this.resourceSystem?.addCoins(snapshot.coins);
    if (snapshot.crystals > 0) this.resourceSystem?.addCrystals(snapshot.crystals);
    for (const item of snapshot.buildings) {
      const building = this.getBuildingByType(item.type);
      const data = this.buildingData[item.type];
      if (!building || !data) continue;
      building.lastProduction = item.capped
        ? now
        : now - Math.max(0, (now - building.lastProduction) % data.productionInterval);
    }
    if (snapshot.coins > 0 || snapshot.crystals > 0) this.persist();
    return { coins: snapshot.coins, crystals: snapshot.crystals };
  }

  calculateOfflineGains(durationMs) {
    const capMs = this.getRankConfig().storageHours * 60 * 60 * 1000;
    const duration = Math.min(Math.max(0, Number(durationMs) || 0), capMs);
    const gains = { coins: 0, crystals: 0 };
    for (const building of this.buildings) {
      const data = this.buildingData[building.type];
      if (!data || data.effects?.type !== "production") continue;
      const cycles = Math.floor(duration / data.productionInterval);
      const efficiency = building.type === "workshop"
        ? WORKSHOP_PRODUCTION_EFFICIENCY
        : PRODUCTION_EFFICIENCY;
      gains[data.effects.resource] += Math.floor(data.effects.value * building.level * cycles * efficiency);
    }
    return gains;
  }

  getActivityDefinition(type) {
    const definitions = {
      training: {
        label: "实战训练",
        durationMs: 2600,
        buffs: { attack: 6 },
        supportByTier: {
          1: { buffs: { attack: 1 }, detail: "攻击战备 +1" },
          2: { buffs: { attack: 2 }, detail: "攻击战备 +2" },
          3: { buffs: { attack: 3 }, detail: "攻击战备 +3" },
        },
      },
      blessing: {
        label: "守护仪式",
        durationMs: 2600,
        buffs: { defense: 4 },
        supportByTier: {
          1: { buffs: { defense: 1 }, detail: "防御战备 +1" },
          2: { buffs: { defense: 2 }, detail: "防御战备 +2" },
          3: { buffs: { defense: 3 }, detail: "防御战备 +3" },
        },
      },
      supply: {
        label: "制作补给",
        durationMs: 3000,
        buffs: { supplies: 1 },
        supportByTier: {
          1: { buffs: { supplies: 1 }, detail: "额外补给 +1" },
          2: { buffs: { supplies: 1, expBonus: 2 }, detail: "额外补给 +1，经验战备 +2%" },
          3: { buffs: { supplies: 1, expBonus: 5 }, detail: "额外补给 +1，经验战备 +5%" },
        },
      },
      drill: {
        label: "战备演练",
        durationMs: 3200,
        buffs: { attack: 3, defense: 3 },
        supportByTier: {
          1: { buffs: { attack: 1 }, detail: "攻击战备 +1" },
          2: { buffs: { attack: 1, defense: 1 }, detail: "攻防战备各 +1" },
          3: { buffs: { attack: 2, defense: 2 }, detail: "攻防战备各 +2" },
        },
      },
      research: {
        label: "路线研究",
        durationMs: 3000,
        buffs: { expBonus: 10 },
        supportByTier: {
          1: { buffs: { expBonus: 2 }, detail: "经验战备 +2%" },
          2: { buffs: { expBonus: 4 }, detail: "经验战备 +4%" },
          3: { buffs: { expBonus: 6 }, detail: "经验战备 +6%" },
        },
      },
      mining: {
        label: "主动开采",
        durationMs: 3200,
        reward: { crystals: 6 },
        supportByTier: {
          1: { reward: { crystals: 1 }, detail: "额外水晶 +1" },
          2: { reward: { crystals: 2 }, detail: "额外水晶 +2" },
          3: { reward: { crystals: 3 }, detail: "额外水晶 +3" },
        },
      },
    };
    return definitions[type] || null;
  }

  getActivitySupportBonus(buildingType, petSupport = null) {
    if (!petSupport || petSupport.buildingType !== buildingType) return null;
    const activityType = this.buildingData[buildingType]?.activity;
    const definition = this.getActivityDefinition(activityType);
    const tier = clampInt(petSupport.tier, 1, 3);
    const bonus = definition?.supportByTier?.[tier];
    if (!bonus) return null;
    return {
      tier,
      tierLabel: petSupport.tierLabel || ["", "熟悉", "默契", "挚友"][tier],
      buffs: { ...(bonus.buffs || {}) },
      reward: { ...(bonus.reward || {}) },
      detail: bonus.detail || "宠物岗位生效",
    };
  }

  canPerformActivity(buildingType, now = Date.now()) {
    const building = this.getBuildingByType(buildingType);
    const activityType = this.buildingData[buildingType]?.activity;
    const definition = this.getActivityDefinition(activityType);
    if (!building || !definition) return { success: false, reason: "该建筑没有可用活动" };
    const readyAt = (this.lastActivityAt[buildingType] || 0) + ACTIVITY_COOLDOWN_MS;
    if (now < readyAt) {
      return { success: false, reason: `活动恢复中 ${Math.ceil((readyAt - now) / 60000)} 分钟`, readyAt };
    }
    return { success: true, activityType, definition, building };
  }

  performActivity(buildingType, now = Date.now(), { petSupport = null } = {}) {
    const result = this.canPerformActivity(buildingType, now);
    if (!result.success) return result;
    const { definition } = result;
    const supportBonus = this.getActivitySupportBonus(buildingType, petSupport);
    const appliedBuffs = { ...(definition.buffs || {}) };
    Object.entries(supportBonus?.buffs || {}).forEach(([key, value]) => {
      appliedBuffs[key] = (appliedBuffs[key] || 0) + value;
    });
    const appliedReward = { ...(definition.reward || {}) };
    Object.entries(supportBonus?.reward || {}).forEach(([key, value]) => {
      appliedReward[key] = (appliedReward[key] || 0) + value;
    });
    Object.entries(appliedBuffs).forEach(([key, value]) => {
      this.preparedBonuses[key] = Math.max(this.preparedBonuses[key] || 0, value);
    });
    if (appliedReward.coins) this.resourceSystem?.addCoins(appliedReward.coins);
    if (appliedReward.crystals) this.resourceSystem?.addCrystals(appliedReward.crystals);
    this.lastActivityAt[buildingType] = now;
    this.persist();
    const supportMessage = supportBonus && petSupport?.petName
      ? `，${petSupport.petName}以${petSupport.roleLabel || "基地岗位"}协助（${supportBonus.detail}）`
      : "";
    return {
      success: true,
      message: `${definition.label}完成${supportMessage}`,
      preparedBonuses: { ...this.preparedBonuses },
      reward: appliedReward,
      petSupport: supportBonus ? { ...petSupport, effect: supportBonus } : null,
    };
  }

  getPreparedBonuses() {
    return { ...this.preparedBonuses };
  }

  consumePreparedBonuses() {
    const bonuses = { ...this.preparedBonuses };
    this.preparedBonuses = this.createEmptyPreparedBonuses();
    if (Object.values(bonuses).some((value) => value > 0)) this.persist();
    return bonuses;
  }

  calculateBonuses() {
    const bonuses = {
      attack: 0,
      defense: 0,
      expBonus: 0,
      coinBonus: 0,
      crystalBonus: 0,
      supplyBonus: 0,
      petCooldownReduction: 0,
      craftingQueueSlots: 0,
      craftingRecipeTier: 0,
    };
    for (const building of this.buildings) {
      const data = this.buildingData[building.type];
      if (!data) continue;
      if (building.type === "training_ground") bonuses.attack += data.effects.value * building.level;
      if (building.type === "temple") {
        bonuses.defense += data.effects.value * building.level;
        bonuses.petCooldownReduction += building.level * 2;
      }
      if (building.type === "barracks") {
        bonuses.attack += data.effects.attack * building.level;
        bonuses.defense += data.effects.defense * building.level;
        bonuses.supplyBonus += Math.floor(building.level / 3);
      }
      if (building.type === "library") bonuses.expBonus += data.effects.value * building.level;
      if (building.type === "workshop") {
        bonuses.coinBonus += building.level * 3;
        bonuses.craftingQueueSlots = 1 + Math.floor((building.level - 1) / 2);
        bonuses.craftingRecipeTier = Math.min(3, building.level);
      }
      if (building.type === "crystal_mine") bonuses.crystalBonus += building.level * 2;
    }
    bonuses.petCooldownReduction = Math.min(20, bonuses.petCooldownReduction);
    bonuses.expBonus = Math.min(30, bonuses.expBonus);
    return bonuses;
  }

  getSaveData() {
    return {
      territoryVersion: TERRITORY_VERSION,
      rank: this.rank,
      legacyVeteranRank: this.legacyVeteranRank,
      buildings: this.buildings.map((building) => ({
        id: building.id,
        type: building.type,
        slotIndex: building.slotIndex,
        level: building.level,
        lastProduction: building.lastProduction,
        investedCoins: building.investedCoins || 0,
        investedCrystals: building.investedCrystals || 0,
        position: building.position,
      })),
      unlockedSlots: this.getEffectiveUnlockedSlots(),
      expansionCount: this.expansionCount,
      lastProductionTime: this.lastProductionTime,
      preparedBonuses: { ...this.preparedBonuses },
      lastActivityAt: { ...this.lastActivityAt },
    };
  }

  loadSaveData(data) {
    if (!data || typeof data !== "object") return;
    const now = Date.now();
    const incoming = Array.isArray(data.buildings) ? data.buildings : [];
    const merged = new Map();
    for (const raw of incoming) {
      const definition = this.buildingData[raw?.type];
      if (!definition) continue;
      const type = raw.type;
      const level = type === "main_base"
        ? 1
        : clampInt(raw.level || 1, 1, definition.maxLevel);
      const previous = merged.get(type);
      const investedCoins = Math.max(0, Number(raw.investedCoins) || this.estimateInvestment(type, level).coins);
      const investedCrystals = Math.max(0, Number(raw.investedCrystals) || this.estimateInvestment(type, level).crystals);
      if (previous) {
        previous.level = Math.min(definition.maxLevel, previous.level + level);
        previous.investedCoins += investedCoins;
        previous.investedCrystals += investedCrystals;
        previous.lastProduction = Math.min(previous.lastProduction, Number(raw.lastProduction) || now);
        continue;
      }
      merged.set(type, {
        id: typeof raw.id === "string" ? raw.id : `building_${type}_${now}`,
        type,
        slotIndex: definition.site.slotIndex,
        level,
        lastProduction: Math.min(now, Math.max(0, Number(raw.lastProduction) || now)),
        investedCoins,
        investedCrystals,
        position: { x: definition.site.x, y: 0 },
      });
    }
    this.buildings = Array.from(merged.values());
    const incomingVersion = Math.max(0, Number(data.territoryVersion) || 0);
    const isCurrent = incomingVersion >= TERRITORY_VERSION;
    const hasV2State = incomingVersion >= 2;
    const savedRank = clampInt(data.rank, 0, TERRITORY_RANK_CONFIG.length - 1);
    this.legacyVeteranRank = isCurrent
      ? clampInt(data.legacyVeteranRank, 0, TERRITORY_RANK_CONFIG.length - 1)
      : hasV2State
        ? savedRank
        : 0;
    this.rank = isCurrent
      ? savedRank
      : hasV2State
        ? this.deriveV2MigrationRank(savedRank)
        : this.deriveLegacyRank(data);
    if (this.getBuildingByType("main_base")) this.rank = Math.max(1, this.rank);
    while (
      this.rank < TERRITORY_RANK_CONFIG.length - 1 &&
      TERRITORY_RANK_CONFIG[this.rank].slots <= this.getHighestOccupiedSlot()
    ) this.rank += 1;
    this.expansionCount = Math.max(0, this.rank - 1);
    this.unlockedSlots = this.getEffectiveUnlockedSlots();
    this.lastProductionTime = Math.min(now, Math.max(0, Number(data.lastProductionTime) || now));
    this.preparedBonuses = {
      ...this.createEmptyPreparedBonuses(),
      ...(hasV2State && data.preparedBonuses ? data.preparedBonuses : {}),
    };
    Object.keys(this.preparedBonuses).forEach((key) => {
      this.preparedBonuses[key] = clampInt(this.preparedBonuses[key], 0, 100);
    });
    this.lastActivityAt = hasV2State && data.lastActivityAt && typeof data.lastActivityAt === "object"
      ? Object.fromEntries(Object.entries(data.lastActivityAt).map(([key, value]) => [key, Math.min(now, Math.max(0, Number(value) || 0))]))
      : {};
    this.initSlots();
    this.setProgressContext(this.progressContext);
    console.log(`[TerritorySystem] v3 存档加载完成，R${this.rank}，建筑 ${this.buildings.length}`);
  }

  deriveLegacyRank(data) {
    if (!this.getBuildingByType("main_base")) return 0;
    const expansionRank = 1 + clampInt(data.expansionCount, 0, 4);
    const siteRank = this.buildings.reduce((highest, building) => Math.max(
      highest,
      this.buildingData[building.type]?.site?.requiredRank || 0
    ), 1);
    return Math.min(TERRITORY_RANK_CONFIG.length - 1, Math.max(1, expansionRank, siteRank));
  }

  deriveV2MigrationRank(savedRank) {
    if (!this.getBuildingByType("main_base")) return 0;
    const siteRank = this.buildings.reduce((highest, building) => Math.max(
      highest,
      this.buildingData[building.type]?.site?.requiredRank || 0
    ), 1);
    const constructionScore = this.getConstructionScore();
    const constructionRank = TERRITORY_RANK_CONFIG.reduce((highest, config) => {
      const target = Number(config.requirements?.constructionScore) || 0;
      return target > 0 && constructionScore >= target ? Math.max(highest, config.rank) : highest;
    }, 1);
    return Math.min(savedRank, Math.max(1, siteRank, constructionRank));
  }

  estimateInvestment(type, level) {
    const buildCost = this.calculateBuildCost(type) || { coins: 0, crystals: 0 };
    const total = { ...buildCost };
    for (let current = 1; current < level; current += 1) {
      const cost = this.calculateUpgradeCost(type, current);
      total.coins += cost.coins;
      total.crystals += cost.crystals;
    }
    return total;
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.getSaveData()));
    } catch (error) {
      console.error("[TerritorySystem] 保存失败:", error);
    }
  }

  loadFromLocalStorage() {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      if (!serialized) return false;
      this.loadSaveData(JSON.parse(serialized));
      return true;
    } catch (error) {
      console.error("[TerritorySystem] 加载失败:", error);
      return false;
    }
  }

  clearTerritoryData() {
    this.resetState();
    this.persist();
  }
}

export function getTerritorySystemInstance(resourceSystem, playerSystem) {
  if (!instance) instance = new TerritorySystem(resourceSystem, playerSystem);
  return instance;
}
