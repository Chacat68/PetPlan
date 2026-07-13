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
} from "./progression-config.js?v=territory-world-20260712a";

let instance = null;

const TERRITORY_VERSION = 2;
const PRODUCTION_EFFICIENCY = 0.5;
const ACTIVITY_COOLDOWN_MS = 5 * 60 * 1000;

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
        name: "主基地",
        icon: "🏰",
        description: "领地核心。修复后开放三条基地建设路线。",
        baseCost: { coins: 0, crystals: 0 },
        costMultiplier: 1,
        maxLevel: 1,
        productionInterval: 0,
        effects: { type: "base" },
      },
      training_ground: {
        name: "训练场",
        icon: "🏋️",
        description: "进行实战训练，并永久提升主角攻击。",
        baseCost: { coins: 400, crystals: 30 },
        costMultiplier: 1.45,
        maxLevel: 5,
        productionInterval: 0,
        effects: { type: "attackBonus", value: 4 },
        activity: "training",
      },
      temple: {
        name: "守护神庙",
        icon: "🏛️",
        description: "宠物休整与守护仪式，提升远征防御。",
        baseCost: { coins: 400, crystals: 30 },
        costMultiplier: 1.45,
        maxLevel: 5,
        productionInterval: 0,
        effects: { type: "defenseBonus", value: 3 },
        activity: "blessing",
      },
      workshop: {
        name: "工坊",
        icon: "🔨",
        description: "制作远征补给并储备金币。",
        baseCost: { coins: 450, crystals: 35 },
        costMultiplier: 1.5,
        maxLevel: 5,
        productionInterval: 60000,
        effects: { type: "production", resource: "coins", value: 45 },
        activity: "supply",
      },
      barracks: {
        name: "兵营",
        icon: "⚔️",
        description: "高阶战备设施，提供攻防与补给加成。",
        baseCost: { coins: 1200, crystals: 100 },
        costMultiplier: 1.5,
        maxLevel: 5,
        productionInterval: 0,
        effects: { type: "combatBonus", attack: 3, defense: 3 },
        activity: "drill",
      },
      library: {
        name: "远征图书馆",
        icon: "📚",
        description: "研究路线情报，提高远征经验结算。",
        baseCost: { coins: 1200, crystals: 100 },
        costMultiplier: 1.5,
        maxLevel: 5,
        productionInterval: 0,
        effects: { type: "expBonus", value: 4 },
        activity: "research",
      },
      crystal_mine: {
        name: "水晶矿",
        icon: "💎",
        description: "通过主动开采与仓储缓慢获得水晶。",
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
    console.log("[TerritorySystem] v2 初始化完成");
  }

  resetState() {
    this.territoryVersion = TERRITORY_VERSION;
    this.rank = 0;
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
      extractions: 0,
      losses: 0,
    };
  }

  createEmptyPreparedBonuses() {
    return { attack: 0, defense: 0, supplies: 0, expBonus: 0 };
  }

  setProgressContext(context = {}) {
    this.progressContext = {
      ...this.createDefaultProgressContext(),
      ...this.progressContext,
      ...context,
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
        { id: "training", label: "训练场达到 Lv.2", met: this.getBuildingLevel("training_ground") >= 2 },
        { id: "depth", label: "最深远征达到区域 3", met: this.progressContext.bestDepth >= 3 },
      ];
    }
    if (type === "library") {
      return [
        { id: "rank", label: "领地达到 R2", met: this.rank >= 2 },
        { id: "temple", label: "守护神庙达到 Lv.2", met: this.getBuildingLevel("temple") >= 2 },
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
      bestDepth: this.progressContext.bestDepth || 0,
      extractions: this.progressContext.extractions || 0,
      constructionScore: this.getConstructionScore(),
    };
    const labels = {
      mainBase: "修复主基地",
      bestDepth: "最深远征",
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

  getProgressSummary() {
    const pulse = this.getLoopPulse();
    const nextBuilding = this.getNextBuildingUnlock();
    const nextRankState = this.getRankRequirementState();
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
      nextTargetPulse: pulse,
      progress: nextRankState.progress,
      worldWidth: this.getWorldWidth(),
      preparedBonuses: { ...this.preparedBonuses },
      production: this.getProductionSnapshot(),
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
    if (building.type === "main_base") return { success: false, reason: "主基地通过领地升阶强化" };
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
    if (building.type === "main_base") return { success: false, reason: "主基地不能拆除" };
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
    if (!this.getBuildingByType("main_base")) return { success: false, reason: "先修复主基地" };
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
    this.expansionCount = Math.max(0, this.rank - 1);
    this.unlockedSlots = this.getEffectiveUnlockedSlots();
    this.setProgressContext(this.progressContext);
    this.persist();
    return {
      success: true,
      rank: this.rank,
      rankName: result.next.name,
      unlockedSlots: this.unlockedSlots,
      message: `领地升阶为 R${this.rank} · ${result.next.name}`,
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
      const amount = Math.floor(data.effects.value * building.level * cycles * PRODUCTION_EFFICIENCY);
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
      gains[data.effects.resource] += Math.floor(data.effects.value * building.level * cycles * PRODUCTION_EFFICIENCY);
    }
    return gains;
  }

  getActivityDefinition(type) {
    const definitions = {
      training: { label: "实战训练", durationMs: 2600, buffs: { attack: 6 } },
      blessing: { label: "守护仪式", durationMs: 2600, buffs: { defense: 4 } },
      supply: { label: "制作补给", durationMs: 3000, buffs: { supplies: 1 } },
      drill: { label: "战备演练", durationMs: 3200, buffs: { attack: 3, defense: 3 } },
      research: { label: "路线研究", durationMs: 3000, buffs: { expBonus: 10 } },
      mining: { label: "主动开采", durationMs: 3200, reward: { crystals: 6 } },
    };
    return definitions[type] || null;
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

  performActivity(buildingType, now = Date.now()) {
    const result = this.canPerformActivity(buildingType, now);
    if (!result.success) return result;
    const { definition } = result;
    Object.entries(definition.buffs || {}).forEach(([key, value]) => {
      this.preparedBonuses[key] = Math.max(this.preparedBonuses[key] || 0, value);
    });
    if (definition.reward?.crystals) this.resourceSystem?.addCrystals(definition.reward.crystals);
    this.lastActivityAt[buildingType] = now;
    this.persist();
    return {
      success: true,
      message: `${definition.label}完成`,
      preparedBonuses: { ...this.preparedBonuses },
      reward: { ...(definition.reward || {}) },
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
      if (building.type === "workshop") bonuses.coinBonus += building.level * 3;
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
    const isV2 = Number(data.territoryVersion) >= TERRITORY_VERSION;
    this.rank = isV2
      ? clampInt(data.rank, 0, TERRITORY_RANK_CONFIG.length - 1)
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
      ...(isV2 && data.preparedBonuses ? data.preparedBonuses : {}),
    };
    Object.keys(this.preparedBonuses).forEach((key) => {
      this.preparedBonuses[key] = clampInt(this.preparedBonuses[key], 0, 100);
    });
    this.lastActivityAt = isV2 && data.lastActivityAt && typeof data.lastActivityAt === "object"
      ? Object.fromEntries(Object.entries(data.lastActivityAt).map(([key, value]) => [key, Math.min(now, Math.max(0, Number(value) || 0))]))
      : {};
    this.initSlots();
    this.setProgressContext(this.progressContext);
    console.log(`[TerritorySystem] v2 存档加载完成，R${this.rank}，建筑 ${this.buildings.length}`);
  }

  deriveLegacyRank(data) {
    if (!this.getBuildingByType("main_base")) return 0;
    const expansionRank = 1 + clampInt(data.expansionCount, 0, 4);
    const legacySlots = clampInt(data.unlockedSlots, 1, 12);
    const slotRank = TERRITORY_RANK_CONFIG.find((entry) => entry.slots >= legacySlots)?.rank || 5;
    return Math.max(1, expansionRank, Math.min(slotRank, 5));
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
