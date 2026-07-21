/**
 * ExpeditionRunSystem - 单局搜打撤规则核心
 *
 * 只负责路线、搜索、威胁、背包和结算，不依赖 DOM / Canvas，便于独立测试。
 */

export const SEARCH_PROFILES = Object.freeze({
  quick: {
    id: "quick",
    name: "快速搜索",
    lootMin: 1,
    lootMax: 1,
    quality: 0,
    threat: 3,
    ambushChance: 0.04,
    supplyChance: 0.08,
    durationSeconds: 3,
    exposure: 1,
    supplyCost: 0,
    role: "低暴露、快速脱离",
  },
  thorough: {
    id: "thorough",
    name: "仔细搜刮",
    lootMin: 2,
    lootMax: 3,
    quality: 2,
    threat: 14,
    ambushChance: 0.3,
    supplyChance: 0.28,
    durationSeconds: 12,
    exposure: 4,
    supplyCost: 1,
    role: "消耗补给换取最大产量",
  },
  pet: {
    id: "pet",
    name: "宠物侦察",
    lootMin: 2,
    lootMax: 2,
    quality: 2,
    threat: 8,
    ambushChance: 0.1,
    supplyChance: 0.2,
    durationSeconds: 7,
    exposure: 2,
    supplyCost: 0,
    role: "稳定品质与较低伏击率",
    requiresPet: true,
  },
});

const NODE_LIBRARY = Object.freeze({
  search: {
    name: "废弃补给站",
    icon: "⌕",
    danger: "低风险",
    description: "散落的货架里还有可带走的物资，但动静可能引来巡逻者。",
  },
  cache: {
    name: "密封仓库",
    icon: "◇",
    danger: "中风险",
    description: "门锁已经损坏，里面的高价值物资也更容易招来伏击。",
  },
  combat: {
    name: "污染巡逻区",
    icon: "⚔",
    danger: "交战",
    description: "清理巡逻怪物后才能继续深入，战斗奖励会暂存在本局背包中。",
  },
  elite: {
    name: "精英巢穴",
    icon: "✦",
    danger: "高风险",
    description: "强敌守着稀有战利品，获胜会显著提高威胁值。",
  },
  camp: {
    name: "临时安全屋",
    icon: "⌂",
    danger: "安全",
    description: "短暂休整并降低威胁，随后继续规划路线。",
  },
  boss: {
    name: "核心守卫区",
    icon: "♛",
    danger: "首领",
    description: "远征最深处的守卫已经苏醒，击败它可获得最高品质战利品。",
  },
});

const LOOT_TABLE = Object.freeze({
  common: [
    { name: "破旧钱袋", icon: "¤", type: "currency", use: "撤离后兑换金币", coins: 28, crystals: 0, exp: 4, score: 28 },
    { name: "能量零件", icon: "⚙", type: "component", use: "用于远征装备维护", coins: 20, crystals: 0, exp: 10, score: 30 },
    { name: "旧城区情报", icon: "▧", type: "intel", use: "用于解锁合约线索", coins: 16, crystals: 0, exp: 16, score: 32, contractFragments: 1 },
  ],
  uncommon: [
    {
      name: "精制宠粮", icon: "●", type: "pet-supply", equipSlot: "consumable",
      supplyValue: 1, use: "装入行动补给栏，出发时转化为 1 份补给",
      coins: 42, crystals: 0, exp: 18, score: 60,
    },
    {
      name: "完整机械芯", icon: "◉", type: "component", equipSlot: "armor",
      defenseBonus: 4, use: "装入护甲槽，本局获得 4 点防御",
      coins: 55, crystals: 0, exp: 12, score: 67,
    },
  ],
  rare: [
    {
      name: "秘境水晶", icon: "◆", type: "crystal", equipSlot: "petLinker",
      guardBonus: 20, use: "装入宠物链接器槽，本局获得 20 点宠物护盾",
      coins: 72, crystals: 2, exp: 22, score: 118,
    },
    { name: "异兽铭牌", icon: "✧", type: "trophy", use: "用于精英讨伐合约", coins: 96, crystals: 1, exp: 28, score: 132, contractFragments: 2 },
  ],
  epic: [
    {
      name: "星辉核心", icon: "✹", type: "relic", equipSlot: "petLinker",
      guardBonus: 36, use: "高级宠物链接器，本局获得 36 点宠物护盾",
      coins: 160, crystals: 5, exp: 52, score: 260, contractFragments: 4,
    },
  ],
});

export const EXTRACTION_RULES = Object.freeze({
  entry: Object.freeze({
    id: "entry",
    locationId: "extraction-beacon",
    name: "入口撤离信标",
    description: "沿原路返回入口，守点压力较低且不消耗补给。",
    minDepth: 3,
    supplyCost: 0,
    threatCost: 5,
    minDurationMs: 6500,
    baseDurationMs: 8000,
    threatDurationStepMs: 1500,
    overpressureDurationStepMs: 80,
    baseEnemyCount: 4,
    threatPerEnemy: 14,
    overpressurePerEnemy: 12,
    reinforcementBaseMs: 4200,
    reinforcementDepthStepMs: 180,
    reinforcementPressureStepMs: 20,
  }),
  emergency: Object.freeze({
    id: "emergency",
    locationId: "emergency-extraction",
    name: "深区应急撤离点",
    description: "无需折返入口，但至少深入 5 层、消耗 1 份补给，并承受更久更密集的守点。",
    minDepth: 5,
    supplyCost: 1,
    threatCost: 12,
    minDurationMs: 9000,
    baseDurationMs: 11000,
    threatDurationStepMs: 1800,
    overpressureDurationStepMs: 100,
    baseEnemyCount: 6,
    threatPerEnemy: 12,
    overpressurePerEnemy: 10,
    reinforcementBaseMs: 3500,
    reinforcementDepthStepMs: 190,
    reinforcementPressureStepMs: 24,
  }),
});

const EXTRACTION_ALIASES = Object.freeze({
  entry: "entry",
  standard: "entry",
  extraction: "entry",
  "extraction-beacon": "entry",
  emergency: "emergency",
  "emergency-extraction": "emergency",
});

const DEEP_LOOT = Object.freeze([
  { name: "深层遗迹样本", icon: "◉", type: "deep-material", use: "深层远征专属升级材料", coins: 90, crystals: 2, exp: 35, score: 155, deepMaterial: 1, contractFragments: 2 },
  { name: "守卫协议残片", icon: "⌬", type: "boss-material", use: "首领科技与长期合约材料", coins: 125, crystals: 3, exp: 45, score: 205, deepMaterial: 1, contractFragments: 3 },
]);

const RARITY_LABELS = Object.freeze({
  common: "普通",
  uncommon: "优秀",
  rare: "稀有",
  epic: "史诗",
});

export function createSeededRandom(seed = 1) {
  let state = Math.max(1, Math.floor(Number(seed) || 1)) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export class ExpeditionRunSystem {
  constructor({
    random = Math.random,
    seed = null,
    maxDepth = 8,
    minExtractionDepth = 3,
    backpackCapacity = 8,
  } = {}) {
    const requestedSeed = seed !== null && seed !== undefined && Number.isFinite(Number(seed))
      ? Math.max(1, Math.floor(Number(seed)))
      : null;
    this.randomSeed = requestedSeed ?? (
      random === Math.random ? Math.max(1, Math.floor(Math.random() * 0xffffffff)) : null
    );
    this.randomDraws = 0;
    this.randomRestorable = this.randomSeed !== null;
    this.randomSource = this.randomRestorable
      ? createSeededRandom(this.randomSeed)
      : (typeof random === "function" ? random : Math.random);
    this.random = () => {
      this.randomDraws += 1;
      return this.randomSource();
    };
    this.maxDepth = Math.max(4, Math.floor(maxDepth));
    this.minExtractionDepth = Math.max(1, Math.floor(minExtractionDepth));
    this.defaultBackpackCapacity = Math.max(3, Math.floor(backpackCapacity));
    this.runSerial = 0;
    this.nodeSerial = 0;
    this.lootSerial = 0;
    this.reset();
  }

  reset() {
    this.active = false;
    this.phase = "briefing";
    this.depth = 0;
    this.threat = 0;
    this.overpressure = 0;
    this.exposure = 0;
    this.supplies = 0;
    this.backpackCapacity = this.defaultBackpackCapacity;
    this.backpack = [];
    this.lootChoiceSerial = 0;
    this.insuredSlotCount = 1;
    this.pendingLootChoice = null;
    this.lootOverflowQueue = [];
    this.stealthCharges = 0;
    this.nextEncounterAdvantage = null;
    this.worldEventState = { lootQualityBonus: 0, lootCountBonus: 0, returnPressureReduction: 0 };
    this.routeChoices = [];
    this.currentNode = null;
    this.history = [];
    this.pendingRewards = this.createEmptyRewards();
    this.bossDefeated = false;
    this.searchSerial = 0;
    this.activeSearch = null;
    this.searchedContainerIds = [];
    this.searchMetrics = { timeSeconds: 0, exposure: 0, suppliesSpent: 0 };
    this.activeExtractionType = null;
    this.lastAction = "准备好后开始远征。带回战利品的唯一方式，是活着撤离。";
    this.lastSettlement = null;
    return this.getState();
  }

  createEmptyRewards() {
    return { coins: 0, crystals: 0, exp: 0, kills: 0 };
  }

  startRun({ supplies = 2, backpackCapacity = this.defaultBackpackCapacity, seed = null } = {}) {
    if (this.active) {
      return { success: false, message: "当前远征尚未结束" };
    }

    if (seed !== null && seed !== undefined && Number.isFinite(Number(seed))) this.setRandomSeed(seed);
    this.reset();
    this.runSerial += 1;
    this.active = true;
    this.phase = "route";
    this.supplies = Math.max(0, Math.floor(supplies));
    this.backpackCapacity = Math.max(3, Math.floor(backpackCapacity));
    this.routeChoices = this.buildRouteChoices();
    this.lastAction = "远征开始。选择第一处区域，或在积累战利品后寻找撤离时机。";
    return { success: true, message: "远征已开始", state: this.getState() };
  }

  buildRouteChoices() {
    const nextDepth = this.depth + 1;
    if (nextDepth >= this.maxDepth) {
      return [this.createNode("boss", nextDepth, 0)];
    }

    const primaryType = this.depth === 0
      ? "search"
      : this.pickWeighted([
          ["search", 28],
          ["combat", 32],
          ["cache", 16],
          ["elite", Math.min(18, 5 + this.depth * 2)],
          ["camp", 12],
        ]);
    let secondaryType = this.pickWeighted([
      ["combat", 35],
      ["search", 22],
      ["cache", 18],
      ["elite", Math.min(22, 6 + this.depth * 2)],
      ["camp", 13],
    ]);
    if (secondaryType === primaryType) {
      secondaryType = primaryType === "combat" ? "search" : "combat";
    }

    return [
      this.createNode(primaryType, nextDepth, 0),
      this.createNode(secondaryType, nextDepth, 1),
    ];
  }

  createNode(type, depth, branch) {
    const template = NODE_LIBRARY[type] || NODE_LIBRARY.search;
    this.nodeSerial += 1;
    return {
      id: `run-${this.runSerial}-node-${this.nodeSerial}`,
      type,
      depth,
      branch,
      ...template,
    };
  }

  chooseNode(nodeId) {
    if (!this.active || this.phase !== "route") {
      return { success: false, message: "当前无法选择路线" };
    }

    const node = this.routeChoices.find((item) => item.id === nodeId);
    if (!node) return { success: false, message: "路线已失效，请重新选择" };

    this.currentNode = { ...node };
    this.routeChoices = [];
    if (node.type === "search" || node.type === "cache") this.phase = "search";
    else if (node.type === "camp") this.phase = "camp";
    else this.phase = "combat";

    this.lastAction = `进入${node.name}。${node.description}`;
    return {
      success: true,
      message: `已进入${node.name}`,
      node: { ...this.currentNode },
      encounter: this.phase === "combat" ? this.getEncounterSpec(node.type) : null,
    };
  }

  normalizeSearchBonuses(searchBonuses = {}) {
    return {
      qualityBonus: Math.max(0, Math.min(2, Math.floor(Number(searchBonuses.qualityBonus) || 0))),
      lootCountBonus: Math.max(0, Math.min(1, Math.floor(Number(searchBonuses.lootCountBonus) || 0))),
      threatReduction: Math.max(0, Math.min(6, Math.floor(Number(searchBonuses.threatReduction) || 0))),
      supplyChanceBonus: Math.max(0, Math.min(0.25, Number(searchBonuses.supplyChanceBonus) || 0)),
      ambushChanceReduction: Math.max(0, Math.min(0.2, Number(searchBonuses.ambushChanceReduction) || 0)),
      contributors: Array.isArray(searchBonuses.contributors)
        ? searchBonuses.contributors.slice(0, 3).map(item => ({
          petName: String(item?.petName || "宠物"),
          label: String(item?.label || "探索天赋"),
        }))
        : [],
    };
  }

  getSearchState() {
    if (!this.activeSearch) return null;
    const durationMs = Math.max(1, this.activeSearch.durationMs);
    return {
      ...JSON.parse(JSON.stringify(this.activeSearch)),
      progress: Math.min(1, this.activeSearch.elapsedMs / durationMs),
      remainingMs: Math.max(0, durationMs - this.activeSearch.elapsedMs),
    };
  }

  beginSearch(mode, {
    hasPet = false,
    searchBonuses = {},
    containerId = null,
    completeNode = undefined,
    isLastContainer = undefined,
  } = {}) {
    const profile = SEARCH_PROFILES[mode];
    if (!this.active || this.phase !== "search" || !this.currentNode) {
      return { success: false, message: "这里没有可搜索的区域" };
    }
    if (this.activeSearch) return { success: false, message: "已有搜索正在进行" };
    if (this.pendingLootChoice) return { success: false, message: "请先处理背包中的待选战利品" };
    if (!profile) return { success: false, message: "未知的搜索方式" };
    if (profile.requiresPet && !hasPet) {
      return { success: false, message: "需要至少上阵一只宠物才能侦察" };
    }
    if (profile.supplyCost > this.supplies) {
      return { success: false, message: `${profile.name}需要 ${profile.supplyCost} 份补给` };
    }
    const normalizedContainerId = containerId == null ? null : String(containerId);
    if (normalizedContainerId && this.searchedContainerIds.includes(normalizedContainerId)) {
      return { success: false, message: "这个容器已经搜索过了" };
    }

    this.searchSerial += 1;
    const completeNodeOnFinish = normalizedContainerId
      ? Boolean(isLastContainer ?? completeNode ?? false)
      : true;
    this.activeSearch = {
      id: `search-${this.runSerial}-${this.searchSerial}`,
      mode,
      profileId: profile.id,
      nodeId: this.currentNode.id,
      containerId: normalizedContainerId,
      completeNodeOnFinish,
      elapsedMs: 0,
      durationMs: profile.durationSeconds * 1000,
      searchBonuses: this.normalizeSearchBonuses(searchBonuses),
    };
    this.lastAction = `${profile.name}进行中，保持警戒，受击会中断搜索。`;
    return {
      success: true,
      started: true,
      completed: false,
      message: this.lastAction,
      search: this.getSearchState(),
    };
  }

  updateSearch(deltaMs, { interrupted = false, tookDamage = false, reason = null } = {}) {
    if (!this.activeSearch) return { success: false, message: "当前没有进行中的搜索" };
    if (interrupted || tookDamage) {
      return this.cancelSearch(reason || (tookDamage ? "damage" : "interrupted"));
    }
    if (
      !this.active ||
      this.phase !== "search" ||
      !this.currentNode ||
      this.currentNode.id !== this.activeSearch.nodeId
    ) {
      return this.cancelSearch("invalid-location");
    }

    this.activeSearch.elapsedMs = Math.min(
      this.activeSearch.durationMs,
      this.activeSearch.elapsedMs + Math.max(0, Number(deltaMs) || 0),
    );
    if (this.activeSearch.elapsedMs < this.activeSearch.durationMs) {
      return {
        success: true,
        started: false,
        completed: false,
        message: this.lastAction,
        search: this.getSearchState(),
      };
    }

    const completedSearch = this.activeSearch;
    this.activeSearch = null;
    return this.completeSearch(completedSearch);
  }

  cancelSearch(reason = "cancelled") {
    if (!this.activeSearch) return { success: false, message: "当前没有进行中的搜索" };
    const cancelledSearch = this.getSearchState();
    this.activeSearch = null;
    const reasonLabels = {
      damage: "受到攻击",
      interrupted: "搜索被打断",
      "invalid-location": "已离开搜索地点",
      cancelled: "主动取消",
    };
    this.lastAction = `${reasonLabels[reason] || String(reason || "搜索中断")}，本次搜索没有产生任何结算。`;
    return {
      success: true,
      cancelled: true,
      completed: false,
      reason,
      message: this.lastAction,
      search: cancelledSearch,
    };
  }

  interruptSearch(reason = "damage") {
    return this.cancelSearch(reason);
  }

  completeSearch(search) {
    const profile = SEARCH_PROFILES[search?.profileId || search?.mode];
    if (!profile || !this.currentNode || this.currentNode.id !== search?.nodeId) {
      return { success: false, completed: false, message: "搜索目标已经失效" };
    }
    if (profile.supplyCost > this.supplies) {
      this.lastAction = `${profile.name}因补给不足而中断，本次没有产生结算。`;
      return { success: false, cancelled: true, completed: false, reason: "insufficient-supplies", message: this.lastAction };
    }

    const appliedBonuses = this.normalizeSearchBonuses(search.searchBonuses);
    const cacheBonus = this.currentNode.type === "cache" ? 1 : 0;
    const lootCount = this.randomInt(profile.lootMin, profile.lootMax)
      + cacheBonus
      + appliedBonuses.lootCountBonus;
    this.supplies -= profile.supplyCost;
    this.searchMetrics.timeSeconds += profile.durationSeconds;
    this.searchMetrics.exposure += profile.exposure;
    this.searchMetrics.suppliesSpent += profile.supplyCost;
    this.exposure += profile.exposure;
    const gainedLoot = [];
    const foundLoot = [];
    const discardedLoot = [];
    for (let index = 0; index < lootCount; index += 1) {
      const item = this.generateLoot(profile.quality + cacheBonus + appliedBonuses.qualityBonus);
      foundLoot.push(item);
      const result = this.addLoot(item, { requireDecision: true, source: `search:${search.mode}` });
      if (result.kept) gainedLoot.push(item);
      if (result.discarded) discardedLoot.push(result.discarded);
    }

    this.addThreat(Math.max(0, profile.threat + cacheBonus * 3 - appliedBonuses.threatReduction));
    const supplyChance = Math.min(
      0.95,
      profile.supplyChance + cacheBonus * 0.08 + appliedBonuses.supplyChanceBonus,
    );
    const supplyFound = this.random() < supplyChance;
    if (supplyFound) this.supplies += 1;

    const ambushChance = Math.max(
      0,
      profile.ambushChance + cacheBonus * 0.08 - appliedBonuses.ambushChanceReduction,
    );
    const ambushed = this.random() < ambushChance;
    if (search.containerId && !this.searchedContainerIds.includes(search.containerId)) {
      this.searchedContainerIds.push(search.containerId);
    }
    const talentSummary = appliedBonuses.contributors.length > 0
      ? `，${appliedBonuses.contributors.map(item => `${item.petName}·${item.label}`).join("、")}生效`
      : "";
    const summary = `${profile.name}发现 ${foundLoot.length} 件战利品，耗时 ${profile.durationSeconds} 秒、暴露 ${profile.exposure}${supplyFound ? "，并找到 1 份补给" : ""}${talentSummary}`;
    if (ambushed) {
      this.phase = "combat";
      this.currentNode.ambushed = true;
      this.lastAction = `${summary}，但搜索动静引来了伏击！`;
      return {
        success: true,
        completed: true,
        message: this.lastAction,
        ambushed: true,
        containerId: search.containerId,
        nodeCompleted: false,
        gainedLoot,
        foundLoot,
        discardedLoot,
        supplyFound,
        searchBonuses: appliedBonuses,
        searchProfile: { ...profile },
        pendingLootChoice: this.pendingLootChoice ? { ...this.pendingLootChoice } : null,
        encounter: this.getEncounterSpec("ambush"),
      };
    }

    this.lastAction = `${summary}。`;
    if (search.completeNodeOnFinish) {
      this.completeCurrentNode({ result: "searched", searchMode: search.mode });
    }
    return {
      success: true,
      completed: true,
      message: this.lastAction,
      ambushed: false,
      containerId: search.containerId,
      nodeCompleted: Boolean(search.completeNodeOnFinish),
      gainedLoot,
      foundLoot,
      discardedLoot,
      supplyFound,
      searchBonuses: appliedBonuses,
      searchProfile: { ...profile },
      pendingLootChoice: this.pendingLootChoice ? { ...this.pendingLootChoice } : null,
    };
  }

  // 兼容旧控制器与测试：同步入口仍可用，但权威流程为 beginSearch -> updateSearch。
  resolveSearch(mode, options = {}) {
    const started = this.beginSearch(mode, options);
    if (!started.success) return started;
    return this.updateSearch(started.search.durationMs);
  }

  restAtCamp() {
    if (!this.active || this.phase !== "camp" || !this.currentNode) {
      return { success: false, message: "当前不在安全屋" };
    }
    if (this.supplies <= 0) {
      return { success: false, message: "休整需要消耗 1 份补给；也可以直接离开以保持隐蔽" };
    }
    this.supplies -= 1;
    const threatReduced = Math.min(this.threat, 18);
    this.threat -= threatReduced;
    const pressureReduced = Math.min(this.overpressure, 8);
    this.overpressure -= pressureReduced;
    this.lastAction = `消耗 1 份补给完成休整：恢复生命、威胁 -${threatReduced}${pressureReduced ? `、超限压力 -${pressureReduced}` : ""}。`;
    this.completeCurrentNode({ result: "rested" });
    return {
      success: true,
      message: this.lastAction,
      healRatio: 0.42,
      threatReduced,
      pressureReduced,
      supplyCost: 1,
      supplyFound: false,
    };
  }

  leaveCamp() {
    if (!this.active || this.phase !== "camp" || !this.currentNode) {
      return { success: false, message: "当前不在安全屋" };
    }
    this.stealthCharges += 1;
    this.nextEncounterAdvantage = {
      type: "concealed-approach",
      threatOffset: 8,
      firstStrikeBonus: 0.18,
      label: "隐蔽先手",
    };
    this.lastAction = "没有停留：保留补给，并获得下一场战斗的隐蔽先手。";
    this.completeCurrentNode({ result: "skipped-camp" });
    return { success: true, message: this.lastAction, stealthGained: 1, advantage: { ...this.nextEncounterAdvantage } };
  }

  completeCombat(rewards = {}, { lootQuality = 0, lootCount = 1 } = {}) {
    if (!this.active || this.phase !== "combat" || !this.currentNode) {
      return { success: false, message: "当前没有需要结算的战斗" };
    }

    const rewardMultiplier = this.getThreatRewardMultiplier();
    const scaledRewards = {
      coins: Math.floor((rewards.coins || 0) * rewardMultiplier),
      crystals: Math.floor((rewards.crystals || 0) * rewardMultiplier),
      exp: Math.floor((rewards.exp || 0) * rewardMultiplier),
      kills: rewards.kills || 0,
    };
    this.addPendingRewards(scaledRewards);

    const gainedLoot = [];
    const foundLoot = [];
    const discardedLoot = [];
    const eventLootCount = Math.max(0, this.worldEventState.lootCountBonus || 0);
    const finalLootCount = Math.max(0, lootCount + eventLootCount);
    for (let index = 0; index < finalLootCount; index += 1) {
      const item = this.generateLoot(lootQuality + (this.worldEventState.lootQualityBonus || 0));
      foundLoot.push(item);
      const result = this.addLoot(item, { requireDecision: true, source: "combat" });
      if (result.kept) gainedLoot.push(item);
      if (result.discarded) discardedLoot.push(result.discarded);
    }

    const nodeType = this.currentNode.type;
    if (nodeType === "boss") this.bossDefeated = true;
    if (this.depth >= 4 && (nodeType === "elite" || nodeType === "boss")) {
      const deepLoot = this.generateDeepLoot(nodeType === "boss");
      foundLoot.push(deepLoot);
      const deepResult = this.addLoot(deepLoot, { requireDecision: true, source: nodeType });
      if (deepResult.kept) gainedLoot.push(deepLoot);
    }
    this.worldEventState.lootQualityBonus = 0;
    this.worldEventState.lootCountBonus = 0;
    this.addThreat(nodeType === "boss" ? 20 : nodeType === "elite" ? 14 : 9);
    this.lastAction = `区域已清理，发现 ${foundLoot.length} 件战利品（威胁收益 ×${rewardMultiplier.toFixed(2)}）。`;
    this.completeCurrentNode({ result: "cleared", rewards: { ...scaledRewards }, rewardMultiplier });
    return {
      success: true,
      message: this.lastAction,
      gainedLoot,
      foundLoot,
      discardedLoot,
      rewardMultiplier,
      pendingLootChoice: this.pendingLootChoice ? { ...this.pendingLootChoice } : null,
    };
  }

  completeCurrentNode(summary = {}) {
    if (!this.currentNode) return;
    this.depth = Math.min(this.maxDepth, this.depth + 1);
    this.history.push({ ...this.currentNode, ...summary });
    this.currentNode = null;
    if (this.depth >= this.maxDepth) {
      this.phase = "extraction-ready";
      this.routeChoices = [];
      this.lastAction = "核心区域已清理。撤离信标已锁定，准备守住最后一段时间。";
    } else {
      this.phase = "route";
      this.routeChoices = this.buildRouteChoices();
    }
  }

  normalizeExtractionType(extraction = "entry") {
    const candidate = typeof extraction === "object" && extraction
      ? extraction.extractionType || extraction.type || extraction.locationId || extraction.id
      : extraction;
    return EXTRACTION_ALIASES[String(candidate || "entry")] || null;
  }

  getExtractionRule(extraction = "entry") {
    const extractionType = this.normalizeExtractionType(extraction);
    if (!extractionType) return null;
    const baseRule = EXTRACTION_RULES[extractionType];
    const minDepth = extractionType === "entry"
      ? this.minExtractionDepth
      : Math.max(baseRule.minDepth, this.minExtractionDepth + 2);
    return { ...baseRule, minDepth };
  }

  getExtractionAvailability(extraction = "entry") {
    const rule = this.getExtractionRule(extraction);
    if (!rule) {
      return { canExtract: false, reason: "unknown-extraction", message: "未知的撤离点", rule: null };
    }
    if (!this.active) {
      return { canExtract: false, reason: "inactive", message: "当前不在远征中", rule };
    }
    if (!['route', 'extraction-ready'].includes(this.phase)) {
      return { canExtract: false, reason: "invalid-phase", message: "当前无法启动撤离", rule };
    }
    if (this.pendingLootChoice) {
      return { canExtract: false, reason: "pending-loot", message: "请先处理待选战利品", rule };
    }
    if (this.depth < rule.minDepth) {
      return {
        canExtract: false,
        reason: "depth",
        message: `至少清理 ${rule.minDepth} 个区域后才能使用${rule.name}`,
        rule,
      };
    }
    if (this.supplies < rule.supplyCost) {
      return {
        canExtract: false,
        reason: "supplies",
        message: `${rule.name}需要 ${rule.supplyCost} 份补给`,
        rule,
      };
    }
    return { canExtract: true, reason: null, message: `${rule.name}可以启动`, rule };
  }

  canExtractAt(extraction = "entry") {
    return this.getExtractionAvailability(extraction).canExtract;
  }

  canExtract() {
    return this.canExtractAt("entry");
  }

  startExtraction(options = {}) {
    const extractionType = this.normalizeExtractionType(options);
    if (!extractionType) {
      return {
        success: false,
        message: "未知的撤离点",
        reason: "unknown-extraction",
        extractionType: null,
        rule: null,
      };
    }
    const availability = this.getExtractionAvailability(extractionType);
    if (!availability.canExtract) {
      return {
        success: false,
        message: availability.message,
        reason: availability.reason,
        extractionType,
        rule: availability.rule,
      };
    }

    const rule = availability.rule;
    this.supplies = Math.max(0, this.supplies - rule.supplyCost);
    this.activeExtractionType = extractionType;
    this.phase = "extracting";
    this.routeChoices = [];
    this.currentNode = this.createNode("combat", this.depth, 0);
    this.currentNode.name = rule.name;
    this.currentNode.description = `${rule.description}守住倒计时后即可带走全部战利品。`;
    const returnRelief = Math.max(0, this.worldEventState.returnPressureReduction || 0);
    const durationMs = Math.max(
      rule.minDurationMs,
      rule.baseDurationMs
        + Math.floor(this.threat / 25) * rule.threatDurationStepMs
        + this.overpressure * rule.overpressureDurationStepMs
        - returnRelief * 120,
    );
    const enemyCount = Math.max(
      3,
      rule.baseEnemyCount
        + this.depth
        + Math.floor(this.threat / rule.threatPerEnemy)
        + Math.floor(this.overpressure / rule.overpressurePerEnemy)
        - Math.floor(returnRelief / 4),
    );
    this.addThreat(rule.threatCost);
    this.lastAction = `${rule.name}已启动，敌人正在向信标聚集！`;
    return {
      success: true,
      message: this.lastAction,
      extractionType,
      locationId: rule.locationId,
      rule,
      supplyCost: rule.supplyCost,
      durationMs,
      encounter: {
        type: "extraction",
        extractionType,
        locationId: rule.locationId,
        depth: Math.max(1, this.depth),
        threat: this.threat,
        overpressure: this.overpressure,
        enemyCount,
        eliteCount: Math.floor(this.threat / 35)
          + Math.floor(this.overpressure / 25)
          + (extractionType === "emergency" ? 1 : 0),
        reinforcementIntervalMs: Math.max(
          1200,
          rule.reinforcementBaseMs
            - this.depth * rule.reinforcementDepthStepMs
            - this.overpressure * rule.reinforcementPressureStepMs,
        ),
        returnPressureReduction: returnRelief,
      },
    };
  }

  finishRun({ extracted, reason = extracted ? "extracted" : "defeated" } = {}) {
    if (this.lastSettlement) return { ...this.lastSettlement };

    const lootRewards = this.getBackpackRewards();
    const successful = Boolean(extracted);
    const abandoned = !successful && ["abandoned", "retreated", "manual-abandon"].includes(reason);
    const protectedLoot = successful ? [] : this.getProtectedLoot();
    const protectedRewards = this.getBackpackRewards(protectedLoot);
    const pendingRate = abandoned ? { coins: 0.12, exp: 0.2 } : { coins: 0.3, exp: 0.4 };
    const extractedContractFragments = successful
      ? this.backpack.reduce((sum, item) => sum + (item.contractFragments || 0), 0)
      : protectedLoot.reduce((sum, item) => sum + (item.contractFragments || 0), 0);
    const deepMaterials = (successful ? this.backpack : protectedLoot)
      .reduce((sum, item) => sum + (item.deepMaterial || 0), 0);
    const rubyReward = successful
      ? Math.max(0, Math.floor(this.depth / 3) + (this.bossDefeated ? 3 : 0) + (this.threat >= 75 ? 1 : 0))
      : 0;
    const settlement = {
      runId: this.runSerial,
      extracted: successful,
      reason,
      depth: this.depth,
      reachedDepth: this.depth,
      extractedDepth: successful ? this.depth : 0,
      threat: this.threat,
      overpressure: this.overpressure,
      kills: this.pendingRewards.kills,
      // 背包物品进入局外仓库，不再同时自动折现；只有战斗现金奖励直接结算。
      coins: successful
        ? this.pendingRewards.coins
        : Math.floor(this.pendingRewards.coins * pendingRate.coins),
      crystals: successful ? this.pendingRewards.crystals : 0,
      exp: successful
        ? this.pendingRewards.exp
        : Math.floor(this.pendingRewards.exp * pendingRate.exp),
      lootValue: successful ? lootRewards.score : protectedRewards.score,
      lootCurrencyPreview: successful
        ? { coins: lootRewards.coins, crystals: lootRewards.crystals, exp: lootRewards.exp }
        : { coins: protectedRewards.coins, crystals: protectedRewards.crystals, exp: protectedRewards.exp },
      lootExtracted: successful ? this.backpack.length : 0,
      insuredLootRecovered: successful ? 0 : protectedLoot.length,
      lootLost: successful ? 0 : Math.max(0, this.backpack.length - protectedLoot.length),
      bossDefeated: this.bossDefeated,
      boss: this.bossDefeated,
      contractFragments: extractedContractFragments,
      deepMaterials,
      rubyReward,
      abandonmentPenalty: abandoned,
      extractionType: successful ? this.activeExtractionType || "entry" : null,
    };
    settlement.value = settlement.coins
      + settlement.crystals * 35
      + settlement.exp * 2
      + settlement.lootValue
      + settlement.contractFragments * 45
      + settlement.deepMaterials * 120
      + settlement.rubyReward * 100;

    this.active = false;
    this.phase = successful ? "extracted" : "defeat";
    this.routeChoices = [];
    this.currentNode = null;
    this.lastSettlement = settlement;
    this.lastAction = successful
      ? `撤离成功，带回 ${settlement.lootExtracted} 件战利品。`
      : `${abandoned ? "主动撤退" : "远征失败"}，遗失 ${settlement.lootLost} 件战利品${protectedLoot.length ? `，保险格带回 ${protectedLoot.length} 件` : ""}。`;
    return { ...settlement };
  }

  addThreat(amount) {
    const delta = Math.floor(amount || 0);
    if (delta < 0) {
      let reduction = Math.abs(delta);
      const pressureReduction = Math.min(this.overpressure, reduction);
      this.overpressure -= pressureReduction;
      reduction -= pressureReduction;
      this.threat = Math.max(0, this.threat - reduction);
      return this.threat;
    }
    const total = this.threat + delta;
    this.threat = Math.max(0, Math.min(100, total));
    if (total > 100) this.overpressure += total - 100;
    return this.threat;
  }

  addPendingRewards(rewards = {}) {
    this.pendingRewards.coins += Math.max(0, Math.floor(rewards.coins || 0));
    this.pendingRewards.crystals += Math.max(0, Math.floor(rewards.crystals || 0));
    this.pendingRewards.exp += Math.max(0, Math.floor(rewards.exp || 0));
    this.pendingRewards.kills += Math.max(0, Math.floor(rewards.kills || 0));
    return { ...this.pendingRewards };
  }

  spendSupply() {
    if (!this.active) return { success: false, message: "当前不在远征中" };
    if (this.supplies <= 0) return { success: false, message: "补给已经用完" };
    this.supplies -= 1;
    this.lastAction = "使用补给恢复生命。";
    return { success: true, message: this.lastAction, healRatio: 0.32 };
  }

  addLoot(item, { requireDecision = false, source = "legacy" } = {}) {
    if (this.backpack.length < this.backpackCapacity) {
      this.backpack.push(item);
      return { kept: true, discarded: null };
    }

    if (requireDecision) {
      this.lootChoiceSerial += 1;
      const choice = {
        id: `loot-choice-${this.runSerial}-${this.lootChoiceSerial}`,
        incoming: { ...item },
        source,
        replaceOptions: this.backpack.map(existing => ({ ...existing })),
      };
      if (this.pendingLootChoice) this.lootOverflowQueue.push(choice);
      else this.pendingLootChoice = choice;
      return { kept: false, discarded: null, pending: true, choice: { ...choice } };
    }

    // 兼容旧调用：显式未要求决策时，保留历史的自动择优语义。
    const lowestIndex = this.backpack.reduce((bestIndex, current, index, list) => (
      current.score < list[bestIndex].score ? index : bestIndex
    ), 0);
    const lowest = this.backpack[lowestIndex];
    if (item.score <= lowest.score) return { kept: false, discarded: item };
    this.backpack.splice(lowestIndex, 1, item);
    return { kept: true, discarded: lowest };
  }

  resolveLootChoice(actionOrOptions, replaceItemId = null) {
    if (!this.pendingLootChoice) return { success: false, message: "当前没有待处理的战利品" };
    const options = typeof actionOrOptions === "string"
      ? { action: actionOrOptions, replaceItemId }
      : (actionOrOptions || {});
    const action = options.action || "discard";
    const incoming = this.pendingLootChoice.incoming;
    let discarded = null;
    let kept = false;

    if (action === "replace" || action === "swap" || action === "keep") {
      const requestedId = options.replaceItemId || options.itemId;
      const index = this.backpack.findIndex(item => item.id === requestedId);
      if (index < 0) return { success: false, message: "请选择背包中要替换的物品" };
      if (this.backpack[index].insured) return { success: false, message: "保险格物品需先解除保护才能替换" };
      discarded = this.backpack[index];
      this.backpack.splice(index, 1, incoming);
      kept = true;
    } else if (action !== "discard" && action !== "leave") {
      return { success: false, message: "未知的战利品处理方式" };
    } else {
      discarded = incoming;
    }

    const resolvedChoice = this.pendingLootChoice;
    this.pendingLootChoice = this.lootOverflowQueue.shift() || null;
    if (this.pendingLootChoice) {
      this.pendingLootChoice.replaceOptions = this.backpack.map(existing => ({ ...existing }));
    }
    return {
      success: true,
      kept,
      discarded,
      resolvedChoiceId: resolvedChoice.id,
      pendingLootChoice: this.pendingLootChoice ? { ...this.pendingLootChoice } : null,
      message: kept ? `已收纳 ${incoming.name}` : `已放弃 ${incoming.name}`,
    };
  }

  protectLoot(itemId) {
    const item = this.backpack.find(entry => entry.id === itemId);
    if (!item) return { success: false, message: "未找到该战利品" };
    const protectedCount = this.backpack.filter(entry => entry.insured).length;
    if (!item.insured && protectedCount >= this.insuredSlotCount) {
      return { success: false, message: "保险格已满" };
    }
    item.insured = true;
    return { success: true, message: `${item.name} 已放入保险格`, item: { ...item } };
  }

  unprotectLoot(itemId) {
    const item = this.backpack.find(entry => entry.id === itemId);
    if (!item) return { success: false, message: "未找到该战利品" };
    item.insured = false;
    return { success: true, item: { ...item } };
  }

  getProtectedLoot() {
    return this.backpack.filter(item => item.insured).slice(0, this.insuredSlotCount);
  }

  generateLoot(qualityBonus = 0) {
    const threatQuality = Math.floor(this.threat / 25) * 0.018 + Math.min(0.08, this.overpressure * 0.002);
    const roll = this.random() + Math.max(0, qualityBonus) * 0.055 + this.depth * 0.016 + threatQuality;
    const rarity = roll >= 1.02
      ? "epic"
      : roll >= 0.78
        ? "rare"
        : roll >= 0.45
          ? "uncommon"
          : "common";
    const pool = LOOT_TABLE[rarity];
    const template = pool[this.randomInt(0, pool.length - 1)];
    this.lootSerial += 1;
    const valueMultiplier = 1 + Math.max(0, this.depth - 1) * 0.045 + (this.getThreatRewardMultiplier() - 1) * 0.5;
    return {
      id: `loot-${this.runSerial}-${this.lootSerial}`,
      rarity,
      rarityLabel: RARITY_LABELS[rarity],
      ...template,
      coins: Math.floor((template.coins || 0) * valueMultiplier),
      exp: Math.floor((template.exp || 0) * valueMultiplier),
      score: Math.floor((template.score || 0) * valueMultiplier),
      depthFound: this.depth + 1,
      threatFound: this.threat,
    };
  }

  generateDeepLoot(boss = false) {
    const template = DEEP_LOOT[boss ? 1 : 0];
    this.lootSerial += 1;
    const multiplier = 1 + Math.max(0, this.depth - 4) * 0.1 + (this.getThreatRewardMultiplier() - 1) * 0.5;
    return {
      id: `loot-${this.runSerial}-${this.lootSerial}`,
      rarity: boss ? "epic" : "rare",
      rarityLabel: boss ? RARITY_LABELS.epic : RARITY_LABELS.rare,
      ...template,
      coins: Math.floor(template.coins * multiplier),
      exp: Math.floor(template.exp * multiplier),
      score: Math.floor(template.score * multiplier),
      depthFound: this.depth + 1,
      threatFound: this.threat,
    };
  }

  getBackpackRewards(items = this.backpack) {
    return items.reduce((total, item) => ({
      coins: total.coins + (item.coins || 0),
      crystals: total.crystals + (item.crystals || 0),
      exp: total.exp + (item.exp || 0),
      score: total.score + (item.score || 0),
      contractFragments: total.contractFragments + (item.contractFragments || 0),
      deepMaterials: total.deepMaterials + (item.deepMaterial || 0),
    }), { coins: 0, crystals: 0, exp: 0, score: 0, contractFragments: 0, deepMaterials: 0 });
  }

  getEncounterSpec(type = this.currentNode?.type || "combat") {
    const depth = Math.max(1, this.currentNode?.depth || this.depth + 1);
    const elite = type === "elite";
    const boss = type === "boss";
    const ambush = type === "ambush";
    const advantage = type === "extraction" ? null : this.nextEncounterAdvantage;
    const effectiveThreat = Math.max(0, this.threat - (advantage?.threatOffset || 0));
    const spec = {
      type,
      depth,
      threat: effectiveThreat,
      rawThreat: this.threat,
      overpressure: this.overpressure,
      enemyCount: boss ? 4 : elite ? 4 + Math.floor(depth / 2) : ambush ? 3 + Math.floor(depth / 3) : 3 + depth,
      eliteCount: boss ? 1 : elite ? 2 : Math.floor(effectiveThreat / 45) + Math.floor(this.overpressure / 30),
      boss,
      playerAdvantage: advantage ? { ...advantage } : null,
      rewardMultiplier: this.getThreatRewardMultiplier(),
    };
    if (advantage) {
      this.nextEncounterAdvantage = null;
      this.stealthCharges = Math.max(0, this.stealthCharges - 1);
    }
    return spec;
  }

  getThreatTier() {
    const tier = Math.min(4, Math.floor(this.threat / 25));
    const thresholds = [0, 25, 50, 75, 100];
    return {
      tier,
      label: ["警戒", "追踪", "围猎", "封锁", "极限通缉"][tier],
      threshold: thresholds[tier],
      nextThreshold: tier < 4 ? thresholds[tier + 1] : null,
    };
  }

  getThreatRewardMultiplier() {
    return Number((1 + Math.floor(this.threat / 25) * 0.12 + Math.min(0.6, this.overpressure * 0.01)).toFixed(2));
  }

  getThreatPreview() {
    const tier = this.getThreatTier();
    const nextThreat = tier.nextThreshold;
    const currentMultiplier = this.getThreatRewardMultiplier();
    const nextMultiplier = nextThreat === null
      ? Number((currentMultiplier + 0.1).toFixed(2))
      : Number((1 + Math.floor(nextThreat / 25) * 0.12).toFixed(2));
    return {
      ...tier,
      currentRewardMultiplier: currentMultiplier,
      nextRewardMultiplier: nextMultiplier,
      threatToNext: nextThreat === null ? 10 : Math.max(0, nextThreat - this.threat),
      overpressure: this.overpressure,
      overpressureRule: "威胁 100 后继续累积超限压力：提高精英数量、撤离压力与奖励倍率",
    };
  }

  resolveWorldEvent(effect = {}) {
    if (!this.active) return { success: false, message: "当前不在远征中", gainedLoot: [] };
    const supply = Math.max(0, Math.floor(effect.supply ?? effect.supplies ?? 0));
    const threatDelta = Math.floor(effect.threatDelta || 0);
    const insurance = Math.max(0, Math.floor(effect.insurance ?? effect.protectedSlots ?? 0));
    const stealth = Math.max(0, Math.floor(effect.stealth || 0));
    const returnPressureReduction = Math.max(0, Math.floor(effect.returnPressureReduction ?? effect.returnPressureRelief ?? 0));
    const lootCount = Math.max(0, Math.min(4, Math.floor(effect.lootCount || 0)));
    const lootQuality = Math.max(0, Math.min(6, Math.floor(effect.lootQuality || 0)));

    this.supplies += supply;
    this.addThreat(threatDelta);
    this.insuredSlotCount += insurance;
    this.stealthCharges += stealth;
    if (stealth > 0) {
      this.nextEncounterAdvantage = {
        type: "world-event-stealth",
        threatOffset: Math.min(16, 6 + stealth * 2),
        firstStrikeBonus: Math.min(0.3, 0.12 + stealth * 0.04),
        label: "事件掩护",
      };
    }
    this.worldEventState.returnPressureReduction += returnPressureReduction;
    if (effect.nextLootQuality) this.worldEventState.lootQualityBonus += Math.max(0, Math.floor(effect.nextLootQuality));
    if (effect.nextLootCount) this.worldEventState.lootCountBonus += Math.max(0, Math.floor(effect.nextLootCount));

    const gainedLoot = [];
    for (let index = 0; index < lootCount; index += 1) {
      const item = this.generateLoot(lootQuality);
      const result = this.addLoot(item, { requireDecision: true, source: effect.source || "world-event" });
      if (result.kept) gainedLoot.push(item);
    }
    const parts = [];
    if (supply) parts.push(`补给 +${supply}`);
    if (threatDelta) parts.push(`威胁 ${threatDelta > 0 ? "+" : ""}${threatDelta}`);
    if (insurance) parts.push(`保险格 +${insurance}`);
    if (stealth) parts.push(`隐蔽 +${stealth}`);
    if (returnPressureReduction) parts.push(`返程压力缓和 ${returnPressureReduction}`);
    if (lootCount) parts.push(`发现战利品 ${lootCount} 件`);
    const message = parts.length ? `世界事件：${parts.join("，")}` : "世界事件没有产生变化";
    this.lastAction = message;
    return {
      success: true,
      message,
      gainedLoot,
      pendingLootChoice: this.pendingLootChoice ? { ...this.pendingLootChoice } : null,
      state: this.getState(),
    };
  }

  setRandomSeed(seed) {
    this.randomSeed = Math.max(1, Math.floor(Number(seed) || 1));
    this.randomDraws = 0;
    this.randomRestorable = true;
    this.randomSource = createSeededRandom(this.randomSeed);
    return this.randomSeed;
  }

  getRunSaveData() {
    return {
      version: 3,
      config: {
        maxDepth: this.maxDepth,
        minExtractionDepth: this.minExtractionDepth,
        defaultBackpackCapacity: this.defaultBackpackCapacity,
      },
      rng: {
        seed: this.randomSeed,
        draws: this.randomDraws,
        restorable: this.randomRestorable,
      },
      state: {
        runSerial: this.runSerial,
        nodeSerial: this.nodeSerial,
        lootSerial: this.lootSerial,
        lootChoiceSerial: this.lootChoiceSerial,
        active: this.active,
        phase: this.phase,
        depth: this.depth,
        threat: this.threat,
        overpressure: this.overpressure,
        exposure: this.exposure,
        supplies: this.supplies,
        backpackCapacity: this.backpackCapacity,
        backpack: this.backpack,
        insuredSlotCount: this.insuredSlotCount,
        pendingLootChoice: this.pendingLootChoice,
        lootOverflowQueue: this.lootOverflowQueue,
        stealthCharges: this.stealthCharges,
        nextEncounterAdvantage: this.nextEncounterAdvantage,
        worldEventState: this.worldEventState,
        routeChoices: this.routeChoices,
        currentNode: this.currentNode,
        history: this.history,
        pendingRewards: this.pendingRewards,
        bossDefeated: this.bossDefeated,
        searchSerial: this.searchSerial,
        activeSearch: this.activeSearch,
        searchedContainerIds: this.searchedContainerIds,
        searchMetrics: this.searchMetrics,
        activeExtractionType: this.activeExtractionType,
        lastAction: this.lastAction,
        lastSettlement: this.lastSettlement,
      },
    };
  }

  loadRunSaveData(saveData = {}) {
    const saved = saveData?.state;
    if (!saved || typeof saved !== "object") return { success: false, message: "远征存档无效" };
    if (saveData.rng?.restorable && Number.isFinite(Number(saveData.rng.seed))) {
      this.setRandomSeed(saveData.rng.seed);
      const draws = Math.max(0, Math.floor(saveData.rng.draws || 0));
      for (let index = 0; index < draws; index += 1) this.random();
    }
    const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
    const scalarKeys = [
      "runSerial", "nodeSerial", "lootSerial", "lootChoiceSerial", "active", "phase", "depth", "threat",
      "overpressure", "exposure", "supplies", "backpackCapacity", "insuredSlotCount",
      "stealthCharges", "bossDefeated", "searchSerial", "activeExtractionType", "lastAction",
    ];
    for (const key of scalarKeys) if (Object.hasOwn(saved, key)) this[key] = saved[key];
    const objectKeys = [
      "backpack", "pendingLootChoice", "lootOverflowQueue", "nextEncounterAdvantage",
      "worldEventState", "routeChoices", "currentNode", "history", "pendingRewards",
      "activeSearch", "searchedContainerIds", "searchMetrics", "lastSettlement",
    ];
    for (const key of objectKeys) if (Object.hasOwn(saved, key)) this[key] = clone(saved[key]);
    this.overpressure = Math.max(0, Math.floor(this.overpressure || 0));
    this.exposure = Math.max(0, Math.floor(this.exposure || 0));
    this.insuredSlotCount = Math.max(0, Math.floor(this.insuredSlotCount ?? 1));
    this.lootOverflowQueue ||= [];
    this.worldEventState ||= { lootQualityBonus: 0, lootCountBonus: 0, returnPressureReduction: 0 };
    this.searchSerial = Math.max(0, Math.floor(this.searchSerial || 0));
    this.searchedContainerIds = Array.isArray(this.searchedContainerIds)
      ? [...new Set(this.searchedContainerIds.map(String))]
      : [];
    if (this.activeSearch) {
      const profile = SEARCH_PROFILES[this.activeSearch.profileId || this.activeSearch.mode];
      const validNode = this.currentNode && this.currentNode.id === this.activeSearch.nodeId;
      if (!profile || !validNode || this.phase !== "search") {
        this.activeSearch = null;
      } else {
        this.activeSearch.profileId = profile.id;
        this.activeSearch.mode = profile.id;
        this.activeSearch.durationMs = profile.durationSeconds * 1000;
        this.activeSearch.elapsedMs = Math.max(
          0,
          Math.min(this.activeSearch.durationMs, Number(this.activeSearch.elapsedMs) || 0),
        );
        this.activeSearch.searchBonuses = this.normalizeSearchBonuses(this.activeSearch.searchBonuses);
      }
    }
    this.searchMetrics ||= { timeSeconds: 0, exposure: 0, suppliesSpent: 0 };
    if (!EXTRACTION_RULES[this.activeExtractionType]) this.activeExtractionType = null;
    return { success: true, message: "远征进度已恢复", state: this.getState() };
  }

  getState() {
    const backpackRewards = this.getBackpackRewards();
    return {
      runId: this.runSerial,
      active: this.active,
      phase: this.phase,
      depth: this.depth,
      maxDepth: this.maxDepth,
      minExtractionDepth: this.minExtractionDepth,
      threat: this.threat,
      overpressure: this.overpressure,
      exposure: this.exposure,
      threatPreview: this.getThreatPreview(),
      supplies: this.supplies,
      backpackCapacity: this.backpackCapacity,
      backpack: this.backpack.map((item) => ({ ...item })),
      insuredSlotCount: this.insuredSlotCount,
      pendingLootChoice: this.pendingLootChoice ? JSON.parse(JSON.stringify(this.pendingLootChoice)) : null,
      lootOverflowQueue: this.lootOverflowQueue.map(choice => JSON.parse(JSON.stringify(choice))),
      decisionState: this.pendingLootChoice ? "loot-overflow" : null,
      hasPendingLootDecision: Boolean(this.pendingLootChoice),
      backpackRewards,
      routeChoices: this.routeChoices.map((node) => ({ ...node })),
      currentNode: this.currentNode ? { ...this.currentNode } : null,
      pendingRewards: { ...this.pendingRewards },
      stealthCharges: this.stealthCharges,
      nextEncounterAdvantage: this.nextEncounterAdvantage ? { ...this.nextEncounterAdvantage } : null,
      worldEventState: { ...this.worldEventState },
      activeSearch: this.getSearchState(),
      searchState: this.getSearchState(),
      isSearching: Boolean(this.activeSearch),
      searchedContainerIds: [...this.searchedContainerIds],
      searchMetrics: { ...this.searchMetrics },
      searchProfiles: Object.fromEntries(
        Object.entries(SEARCH_PROFILES).map(([id, profile]) => [id, { ...profile }]),
      ),
      bossDefeated: this.bossDefeated,
      canExtract: this.canExtract(),
      activeExtractionType: this.activeExtractionType,
      extractionRules: Object.fromEntries(
        Object.keys(EXTRACTION_RULES).map(id => [id, this.getExtractionRule(id)]),
      ),
      extractionAvailability: Object.fromEntries(
        Object.keys(EXTRACTION_RULES).map(id => [id, this.getExtractionAvailability(id)]),
      ),
      lastAction: this.lastAction,
      settlement: this.lastSettlement ? { ...this.lastSettlement } : null,
    };
  }

  pickWeighted(entries) {
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    let roll = this.random() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries.at(-1)[0];
  }

  randomInt(min, max) {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return low + Math.floor(this.random() * (high - low + 1));
  }
}
