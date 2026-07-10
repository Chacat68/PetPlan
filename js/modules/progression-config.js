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
    id: "territory",
    metric: "buildings",
    target: 1,
    title: "建立领地",
    detail: "建造第 1 座领地建筑",
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
