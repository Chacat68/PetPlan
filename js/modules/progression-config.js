export const FATE_COST_CONFIG = Object.freeze({
  assistantPower: { heads: 10, tails: 10, multiplier: 1.55 },
  assistant: { tails: 25, multiplier: 1.65 },
  goldCoin: { heads: 5, multiplier: 1.45 },
  manual: { heads: 20, multiplier: 1.55 },
  assistantSpeed: { tails: 40, multiplier: 1.7, intervalStep: 250 },
});

export const TERRITORY_PROGRESSION_CONFIG = Object.freeze({
  pulseWeights: Object.freeze({
    totalFlips: 1,
    totalFlipsCap: 16,
    fateCoins: 24,
    assistants: 26,
    heroTrainingLevel: 16,
    equippedPets: 18,
    extraPetLevels: 6,
    buildings: 14,
    expansionCount: 20,
  }),
  slotUnlockPulses: Object.freeze([0, 12, 28, 48, 72, 100, 132, 168, 208, 252, 300, 352]),
  buildingUnlocks: Object.freeze({
    main_base: { stage: 1, pulse: 0, label: "初始开放" },
    training_ground: { stage: 2, pulse: 8, label: "循环脉冲 8" },
    workshop: { stage: 3, pulse: 24, label: "循环脉冲 24" },
    temple: { stage: 4, pulse: 42, label: "循环脉冲 42" },
    barracks: { stage: 5, pulse: 64, label: "循环脉冲 64" },
    crystal_mine: { stage: 6, pulse: 88, label: "循环脉冲 88" },
    library: { stage: 7, pulse: 118, label: "循环脉冲 118" },
  }),
  expansionCosts: Object.freeze([
    { coins: 10000, crystals: 500, requiredMainBaseLevel: 1 },
    { coins: 25000, crystals: 1500, requiredMainBaseLevel: 1 },
    { coins: 50000, crystals: 3000, requiredMainBaseLevel: 2 },
  ]),
});

// Ruby rewards are deliberately split across increasingly demanding expedition
// contracts. The full route funds the collectible roster, while early rewards
// only open the next companion instead of dumping the endgame currency at once.
export const EXPEDITION_MILESTONE_REWARD_CONFIG = Object.freeze([
  Object.freeze({ id: "extracted_depth_3", metric: "bestExtractedDepth", target: 3, title: "带回浅层情报", desc: "从区域 3 或更深处成功撤离", icon: "↩", rubies: 40 }),
  Object.freeze({ id: "extracted_depth_5", metric: "bestExtractedDepth", target: 5, title: "穿越危险腹地", desc: "从区域 5 或更深处成功撤离", icon: "↩", rubies: 80 }),
  Object.freeze({ id: "extracted_depth_8", metric: "bestExtractedDepth", target: 8, title: "核心区归还者", desc: "从区域 8 或更深处成功撤离", icon: "◆", rubies: 160 }),
  Object.freeze({ id: "extraction_25", metric: "extractions", target: 25, title: "边境常客", desc: "累计成功撤离 25 次", icon: "↩", rubies: 180 }),
  Object.freeze({ id: "extraction_50", metric: "extractions", target: 50, title: "可靠的领航员", desc: "累计成功撤离 50 次", icon: "↩", rubies: 300 }),
  Object.freeze({ id: "extraction_100", metric: "extractions", target: 100, title: "百战归乡", desc: "累计成功撤离 100 次", icon: "↩", rubies: 450 }),
  Object.freeze({ id: "boss_1", metric: "bossKills", target: 1, title: "首领猎手", desc: "击败 1 名远征首领", icon: "B", rubies: 60 }),
  Object.freeze({ id: "boss_5", metric: "bossKills", target: 5, title: "破阵者", desc: "累计击败 5 名远征首领", icon: "B", rubies: 120 }),
  Object.freeze({ id: "boss_15", metric: "bossKills", target: 15, title: "核心克星", desc: "累计击败 15 名远征首领", icon: "B", rubies: 220 }),
  Object.freeze({ id: "boss_30", metric: "bossKills", target: 30, title: "荒野传说", desc: "累计击败 30 名远征首领", icon: "B", rubies: 350 }),
  Object.freeze({ id: "flawless_1", metric: "flawlessExtractions", target: 1, title: "毫发无伤", desc: "首次完成无伤撤离", icon: "◇", rubies: 60 }),
  Object.freeze({ id: "flawless_5", metric: "flawlessExtractions", target: 5, title: "完美行动", desc: "累计完成 5 次无伤撤离", icon: "◇", rubies: 140 }),
  Object.freeze({ id: "flawless_15", metric: "flawlessExtractions", target: 15, title: "幽灵小队", desc: "累计完成 15 次无伤撤离", icon: "◇", rubies: 260 }),
  Object.freeze({ id: "value_500", metric: "bestValue", target: 500, title: "满载而归", desc: "单次成功带回价值 500 的战利品", icon: "¤", rubies: 40 }),
  Object.freeze({ id: "value_1500", metric: "bestValue", target: 1500, title: "珍宝路线", desc: "单次成功带回价值 1500 的战利品", icon: "¤", rubies: 90 }),
  Object.freeze({ id: "value_4000", metric: "bestValue", target: 4000, title: "高价值目标", desc: "单次成功带回价值 4000 的战利品", icon: "¤", rubies: 180 }),
  Object.freeze({ id: "value_8000", metric: "bestValue", target: 8000, title: "移动宝库", desc: "单次成功带回价值 8000 的战利品", icon: "¤", rubies: 300 }),
]);

// Territory v2 promotes the base through permanent milestones. The old pulse
// configuration remains available for growth-direction hints and old-save
// migration, but no longer controls whether a built district can disappear.
export const TERRITORY_RANK_CONFIG = Object.freeze([
  Object.freeze({
    rank: 0,
    name: "未建营地",
    slots: 1,
    worldWidth: 1680,
    storageHours: 4,
    cost: Object.freeze({ coins: 0, crystals: 0 }),
    requirements: Object.freeze({}),
  }),
  Object.freeze({
    rank: 1,
    name: "营地",
    slots: 4,
    worldWidth: 2180,
    storageHours: 8,
    cost: Object.freeze({ coins: 0, crystals: 0 }),
    requirements: Object.freeze({ mainBase: 1 }),
  }),
  Object.freeze({
    rank: 2,
    name: "远征前哨",
    slots: 6,
    worldWidth: 2660,
    storageHours: 12,
    cost: Object.freeze({ coins: 1200, crystals: 120 }),
    requirements: Object.freeze({ extractions: 1, constructionScore: 2 }),
  }),
  Object.freeze({
    rank: 3,
    name: "协同聚落",
    slots: 7,
    worldWidth: 3040,
    storageHours: 18,
    cost: Object.freeze({ coins: 3000, crystals: 280 }),
    requirements: Object.freeze({ bestExtractedDepth: 5, extractions: 1, constructionScore: 6 }),
  }),
  Object.freeze({
    rank: 4,
    name: "边境要塞",
    slots: 9,
    worldWidth: 3340,
    storageHours: 24,
    cost: Object.freeze({ coins: 6500, crystals: 600 }),
    requirements: Object.freeze({ bestExtractedDepth: 6, extractions: 3, constructionScore: 12 }),
  }),
  Object.freeze({
    rank: 5,
    name: "核心领地",
    slots: 12,
    worldWidth: 3660,
    storageHours: 24,
    cost: Object.freeze({ coins: 12000, crystals: 1000 }),
    requirements: Object.freeze({ bestExtractedDepth: 8, extractions: 5, constructionScore: 20 }),
  }),
]);

export const TERRITORY_BUILDING_SITES = Object.freeze({
  main_base: Object.freeze({ slotIndex: 0, x: 1080, requiredRank: 0, path: "core" }),
  training_ground: Object.freeze({ slotIndex: 1, x: 520, requiredRank: 1, path: "hero" }),
  temple: Object.freeze({ slotIndex: 2, x: 1450, requiredRank: 1, path: "companion" }),
  workshop: Object.freeze({ slotIndex: 3, x: 1900, requiredRank: 1, path: "territory" }),
  barracks: Object.freeze({ slotIndex: 4, x: 760, requiredRank: 2, path: "hero" }),
  library: Object.freeze({ slotIndex: 5, x: 2390, requiredRank: 2, path: "companion" }),
  crystal_mine: Object.freeze({ slotIndex: 6, x: 2820, requiredRank: 3, path: "territory" }),
});

export const ONBOARDING_VERSION = 2;

export const FIRST_SESSION_STEPS = Object.freeze([
  {
    id: "flip",
    metric: "totalFlips",
    target: 8,
    title: "熟悉翻转",
    detail: "累计翻转 8 次",
    routeType: "mixed",
  },
  {
    id: "table",
    metric: "fateCoins",
    target: 2,
    title: "扩充桌面",
    detail: "将桌面硬币扩充到 2 枚",
    routeType: "heads",
  },
  {
    id: "assistant",
    metric: "assistants",
    target: 1,
    title: "招募助手",
    detail: "招募第 1 个小助手",
    routeType: "tails",
  },
  {
    id: "expedition",
    metric: "expeditionDepth",
    target: 1,
    title: "完成首次探索",
    detail: "进入远征并完成第 1 个区域",
    routeType: "combat",
  },
  {
    id: "extraction",
    metric: "extractions",
    target: 1,
    title: "带回首次收益",
    detail: "探索至少 3 个区域并成功撤离 1 次",
    routeType: "combat",
  },
  {
    id: "territory",
    metric: "buildings",
    target: 1,
    title: "修复主基地",
    detail: "前往领地，在实际基地世界中修复主基地",
    routeType: "territory",
  },
]);

export const GROWTH_PATHS = Object.freeze({
  hero: Object.freeze({
    label: "先攻",
    detail: "主角训练与手动收益领先",
    actions: Object.freeze(["manual", "hero"]),
    signals: Object.freeze([
      { metric: "manualPower", offset: 1, weight: 1 },
      { metric: "heroTrainingLevel", offset: 0, weight: 1 },
    ]),
  }),
  companion: Object.freeze({
    label: "协同",
    detail: "助手、自动结算与宠物成长领先",
    actions: Object.freeze(["assistant", "assistantPower", "speed", "pet"]),
    signals: Object.freeze([
      { metric: "assistants", offset: 0, weight: 2 },
      { metric: "assistantPower", offset: 1, weight: 1 },
      { metric: "assistantSpeedLevel", offset: 0, weight: 1 },
      { metric: "petTrainingLevels", offset: 0, weight: 1 },
    ]),
  }),
  territory: Object.freeze({
    label: "拓域",
    detail: "桌面规模与领地进度领先",
    actions: Object.freeze(["gold"]),
    signals: Object.freeze([
      { metric: "fateCoins", offset: 1, weight: 1 },
      { metric: "buildings", offset: 0, weight: 1 },
      { metric: "expansionCount", offset: 0, weight: 2 },
    ]),
  }),
});

export const PATH_RECOMMENDATION_BOOST = 14;
