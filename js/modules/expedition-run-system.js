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
    threat: 5,
    ambushChance: 0.08,
    supplyChance: 0.12,
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
  },
  pet: {
    id: "pet",
    name: "宠物侦察",
    lootMin: 2,
    lootMax: 2,
    quality: 1,
    threat: 8,
    ambushChance: 0.14,
    supplyChance: 0.22,
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
    { name: "破旧钱袋", icon: "¤", coins: 28, crystals: 0, exp: 4, score: 28 },
    { name: "能量零件", icon: "⚙", coins: 20, crystals: 0, exp: 10, score: 30 },
    { name: "旧城区情报", icon: "▧", coins: 16, crystals: 0, exp: 16, score: 32 },
  ],
  uncommon: [
    { name: "精制宠粮", icon: "●", coins: 42, crystals: 0, exp: 18, score: 60 },
    { name: "完整机械芯", icon: "◉", coins: 55, crystals: 0, exp: 12, score: 67 },
  ],
  rare: [
    { name: "秘境水晶", icon: "◆", coins: 72, crystals: 2, exp: 22, score: 118 },
    { name: "异兽铭牌", icon: "✧", coins: 96, crystals: 1, exp: 28, score: 132 },
  ],
  epic: [
    { name: "星辉核心", icon: "✹", coins: 160, crystals: 5, exp: 52, score: 260 },
  ],
});

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
    maxDepth = 8,
    minExtractionDepth = 3,
    backpackCapacity = 8,
  } = {}) {
    this.random = typeof random === "function" ? random : Math.random;
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
    this.supplies = 0;
    this.backpackCapacity = this.defaultBackpackCapacity;
    this.backpack = [];
    this.routeChoices = [];
    this.currentNode = null;
    this.history = [];
    this.pendingRewards = this.createEmptyRewards();
    this.lastAction = "准备好后开始远征。带回战利品的唯一方式，是活着撤离。";
    this.lastSettlement = null;
    return this.getState();
  }

  createEmptyRewards() {
    return { coins: 0, crystals: 0, exp: 0, kills: 0 };
  }

  startRun({ supplies = 2, backpackCapacity = this.defaultBackpackCapacity } = {}) {
    if (this.active) {
      return { success: false, message: "当前远征尚未结束" };
    }

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

  resolveSearch(mode, { hasPet = false } = {}) {
    const profile = SEARCH_PROFILES[mode];
    if (!this.active || this.phase !== "search" || !this.currentNode) {
      return { success: false, message: "这里没有可搜索的区域" };
    }
    if (!profile) return { success: false, message: "未知的搜索方式" };
    if (profile.requiresPet && !hasPet) {
      return { success: false, message: "需要至少上阵一只宠物才能侦察" };
    }

    const cacheBonus = this.currentNode.type === "cache" ? 1 : 0;
    const lootCount = this.randomInt(profile.lootMin, profile.lootMax) + cacheBonus;
    const gainedLoot = [];
    const discardedLoot = [];
    for (let index = 0; index < lootCount; index += 1) {
      const item = this.generateLoot(profile.quality + cacheBonus);
      const result = this.addLoot(item);
      if (result.kept) gainedLoot.push(item);
      if (result.discarded) discardedLoot.push(result.discarded);
    }

    this.addThreat(profile.threat + cacheBonus * 3);
    const supplyFound = this.random() < profile.supplyChance + cacheBonus * 0.08;
    if (supplyFound) this.supplies += 1;

    const ambushed = this.random() < profile.ambushChance + cacheBonus * 0.08;
    const summary = `${profile.name}获得 ${gainedLoot.length} 件战利品${supplyFound ? "和 1 份补给" : ""}`;
    if (ambushed) {
      this.phase = "combat";
      this.currentNode.ambushed = true;
      this.lastAction = `${summary}，但搜索动静引来了伏击！`;
      return {
        success: true,
        message: this.lastAction,
        ambushed: true,
        gainedLoot,
        discardedLoot,
        supplyFound,
        encounter: this.getEncounterSpec("ambush"),
      };
    }

    this.lastAction = `${summary}。`;
    this.completeCurrentNode({ result: "searched", searchMode: mode });
    return {
      success: true,
      message: this.lastAction,
      ambushed: false,
      gainedLoot,
      discardedLoot,
      supplyFound,
    };
  }

  restAtCamp() {
    if (!this.active || this.phase !== "camp" || !this.currentNode) {
      return { success: false, message: "当前不在安全屋" };
    }
    const threatReduced = Math.min(this.threat, 18);
    this.threat -= threatReduced;
    this.supplies += 1;
    this.lastAction = `休整完成：恢复生命、威胁 -${threatReduced}，获得 1 份补给。`;
    this.completeCurrentNode({ result: "rested" });
    return {
      success: true,
      message: this.lastAction,
      healRatio: 0.34,
      threatReduced,
      supplyFound: true,
    };
  }

  leaveCamp() {
    if (!this.active || this.phase !== "camp" || !this.currentNode) {
      return { success: false, message: "当前不在安全屋" };
    }
    this.lastAction = "没有停留，继续深入。";
    this.completeCurrentNode({ result: "skipped-camp" });
    return { success: true, message: this.lastAction };
  }

  completeCombat(rewards = {}, { lootQuality = 0, lootCount = 1 } = {}) {
    if (!this.active || this.phase !== "combat" || !this.currentNode) {
      return { success: false, message: "当前没有需要结算的战斗" };
    }

    this.addPendingRewards(rewards);

    const gainedLoot = [];
    const discardedLoot = [];
    for (let index = 0; index < lootCount; index += 1) {
      const item = this.generateLoot(lootQuality);
      const result = this.addLoot(item);
      if (result.kept) gainedLoot.push(item);
      if (result.discarded) discardedLoot.push(result.discarded);
    }

    const nodeType = this.currentNode.type;
    this.addThreat(nodeType === "boss" ? 20 : nodeType === "elite" ? 14 : 9);
    this.lastAction = `区域已清理，获得 ${gainedLoot.length} 件战利品。`;
    this.completeCurrentNode({ result: "cleared", rewards: { ...rewards } });
    return { success: true, message: this.lastAction, gainedLoot, discardedLoot };
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

  canExtract() {
    return Boolean(
      this.active &&
      this.depth >= this.minExtractionDepth &&
      (this.phase === "route" || this.phase === "extraction-ready")
    );
  }

  startExtraction() {
    if (!this.canExtract()) {
      return {
        success: false,
        message: this.depth < this.minExtractionDepth
          ? `至少清理 ${this.minExtractionDepth} 个区域后才能定位撤离点`
          : "当前无法启动撤离",
      };
    }

    this.phase = "extracting";
    this.routeChoices = [];
    this.currentNode = this.createNode("combat", this.depth, 0);
    this.currentNode.name = "撤离信标";
    this.currentNode.description = "守住信标倒计时，时间结束即可带走全部战利品。";
    const durationMs = 8000 + Math.floor(this.threat / 25) * 1500;
    const enemyCount = 4 + this.depth + Math.floor(this.threat / 14);
    this.addThreat(5);
    this.lastAction = "撤离信标已启动，敌人正在向信标聚集！";
    return {
      success: true,
      message: this.lastAction,
      durationMs,
      encounter: {
        type: "extraction",
        depth: Math.max(1, this.depth),
        threat: this.threat,
        enemyCount,
        eliteCount: Math.floor(this.threat / 35),
      },
    };
  }

  finishRun({ extracted, reason = extracted ? "extracted" : "defeated" } = {}) {
    if (this.lastSettlement) return { ...this.lastSettlement };

    const lootRewards = this.getBackpackRewards();
    const successful = Boolean(extracted);
    const settlement = {
      runId: this.runSerial,
      extracted: successful,
      reason,
      depth: this.depth,
      threat: this.threat,
      kills: this.pendingRewards.kills,
      coins: successful
        ? this.pendingRewards.coins + lootRewards.coins
        : Math.floor(this.pendingRewards.coins * 0.3),
      crystals: successful
        ? this.pendingRewards.crystals + lootRewards.crystals
        : 0,
      exp: successful
        ? this.pendingRewards.exp + lootRewards.exp
        : Math.floor(this.pendingRewards.exp * 0.4),
      lootExtracted: successful ? this.backpack.length : 0,
      lootLost: successful ? 0 : this.backpack.length,
    };

    this.active = false;
    this.phase = successful ? "extracted" : "defeat";
    this.routeChoices = [];
    this.currentNode = null;
    this.lastSettlement = settlement;
    this.lastAction = successful
      ? `撤离成功，带回 ${settlement.lootExtracted} 件战利品。`
      : `远征失败，遗失 ${settlement.lootLost} 件战利品，仅保留部分战斗经验。`;
    return { ...settlement };
  }

  addThreat(amount) {
    this.threat = Math.max(0, Math.min(100, this.threat + Math.floor(amount || 0)));
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

  addLoot(item) {
    if (this.backpack.length < this.backpackCapacity) {
      this.backpack.push(item);
      return { kept: true, discarded: null };
    }

    const lowestIndex = this.backpack.reduce((bestIndex, current, index, list) => (
      current.score < list[bestIndex].score ? index : bestIndex
    ), 0);
    const lowest = this.backpack[lowestIndex];
    if (item.score <= lowest.score) return { kept: false, discarded: item };
    this.backpack.splice(lowestIndex, 1, item);
    return { kept: true, discarded: lowest };
  }

  generateLoot(qualityBonus = 0) {
    const roll = this.random() + Math.max(0, qualityBonus) * 0.055 + this.depth * 0.012;
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
    return {
      id: `loot-${this.runSerial}-${this.lootSerial}`,
      rarity,
      rarityLabel: RARITY_LABELS[rarity],
      ...template,
    };
  }

  getBackpackRewards() {
    return this.backpack.reduce((total, item) => ({
      coins: total.coins + (item.coins || 0),
      crystals: total.crystals + (item.crystals || 0),
      exp: total.exp + (item.exp || 0),
      score: total.score + (item.score || 0),
    }), { coins: 0, crystals: 0, exp: 0, score: 0 });
  }

  getEncounterSpec(type = this.currentNode?.type || "combat") {
    const depth = Math.max(1, this.currentNode?.depth || this.depth + 1);
    const elite = type === "elite";
    const boss = type === "boss";
    const ambush = type === "ambush";
    return {
      type,
      depth,
      threat: this.threat,
      enemyCount: boss ? 4 : elite ? 4 + Math.floor(depth / 2) : ambush ? 3 + Math.floor(depth / 3) : 3 + depth,
      eliteCount: boss ? 1 : elite ? 2 : Math.floor(this.threat / 45),
      boss,
    };
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
      supplies: this.supplies,
      backpackCapacity: this.backpackCapacity,
      backpack: this.backpack.map((item) => ({ ...item })),
      backpackRewards,
      routeChoices: this.routeChoices.map((node) => ({ ...node })),
      currentNode: this.currentNode ? { ...this.currentNode } : null,
      pendingRewards: { ...this.pendingRewards },
      canExtract: this.canExtract(),
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
