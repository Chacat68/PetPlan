import assert from "node:assert/strict";
import test from "node:test";

import { AchievementController } from "../js/controllers/achievement-controller.js";
import { ShopRecommendationController } from "../js/controllers/shop-recommendation-controller.js";
import { FateCoinSystem } from "../js/modules/fate-coin-system.js";
import {
  getFateRecommendationScore,
  getFateShopDisplayOrder,
  rankFateRecommendationCandidates,
} from "../js/modules/fate-shop-rules.js";
import { ProgressionSystem } from "../js/modules/progression-system.js";
import { SaveSystem } from "../js/modules/save-system.js";
import { SceneRouter } from "../js/modules/scene-router.js";
import { TerritorySystem } from "../js/modules/territory-system.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

function createResourceStub({ coins = 100_000, crystals = 100_000 } = {}) {
  return {
    coins,
    crystals,
    hasEnoughCoins(amount) {
      return this.coins >= amount;
    },
    hasEnoughCrystals(amount) {
      return this.crystals >= amount;
    },
    spendCoins(amount) {
      if (!this.hasEnoughCoins(amount)) return false;
      this.coins -= amount;
      return true;
    },
    spendCrystals(amount) {
      if (!this.hasEnoughCrystals(amount)) return false;
      this.crystals -= amount;
      return true;
    },
    addCoins(amount) {
      this.coins += amount;
    },
    addCrystals(amount) {
      this.crystals += amount;
    },
  };
}

function createStateSystem(data = {}) {
  return {
    loaded: null,
    getSaveData() {
      return structuredClone(data);
    },
    loadSaveData(nextData) {
      this.loaded = structuredClone(nextData);
    },
  };
}

function pulseContext(pulse) {
  return {
    totalFlips: pulse % 16,
    heroTrainingLevel: Math.floor(pulse / 16),
    equippedPets: 1,
    petLevelTotal: 1,
  };
}

test("命运硬币收益和价格按统一配置增长", () => {
  const fate = new FateCoinSystem();
  const initial = fate.getDisplayData();

  assert.deepEqual(
    {
      fateCoins: initial.fateCoins,
      heads: initial.heads,
      tails: initial.tails,
      assistants: initial.assistants,
      manualPower: initial.manualPower,
      assistantPower: initial.assistantPower,
      autoInterval: initial.autoInterval,
      totalFlips: initial.totalFlips,
    },
    {
      fateCoins: 1,
      heads: 0,
      tails: 0,
      assistants: 0,
      manualPower: 1,
      assistantPower: 1,
      autoInterval: 3000,
      totalFlips: 0,
    }
  );

  assert.deepEqual(fate.manualFlip("heads"), {
    flips: 1,
    heads: 1,
    tails: 0,
    face: "heads",
    source: "manual",
  });
  fate.manualPower = 2;
  assert.deepEqual(fate.manualFlip("tails"), {
    flips: 2,
    heads: 0,
    tails: 2,
    face: "tails",
    source: "manual",
  });
  assert.equal(fate.totalFlips, 3);

  assert.deepEqual(
    [1, 2, 3, 4].map((fateCoins) => {
      fate.fateCoins = fateCoins;
      return fate.getBuyGoldCoinCost().heads;
    }),
    [5, 7, 10, 15]
  );
  assert.deepEqual(
    [0, 1, 2, 3].map((assistants) => {
      fate.assistants = assistants;
      return fate.getBuyAssistantCost().tails;
    }),
    [25, 41, 68, 112]
  );
  assert.deepEqual(
    [1, 2, 3, 4].map((assistantPower) => {
      fate.assistantPower = assistantPower;
      return fate.getUpgradeAssistantPowerCost().heads;
    }),
    [10, 15, 24, 37]
  );
  fate.manualPower = 2;
  assert.equal(fate.getUpgradeManualCost().heads, 31);

  fate.loadSaveData({ fateCoins: 2, pendingGoldCoins: 3, goldCoins: 7 });
  assert.equal(fate.fateCoins, 5);
  assert.equal(fate.totalFlips, 7);
  assert.equal(fate.autoTimer, 0);
});

test("助手购买、速度和自动结算保持独立且可预测", () => {
  const fate = new FateCoinSystem();
  const requests = [];
  fate.setOnAutoFlip((request) => requests.push(request));
  fate.tails = 25;

  assert.equal(fate.buyAssistant().success, true);
  assert.equal(fate.assistants, 1);
  assert.equal(fate.tails, 0);
  assert.equal(fate.getAutoFlipsPerSecond(), 1 / 3);
  assert.equal(fate.update(2999), null);
  assert.deepEqual(fate.update(1), {
    source: "assistant",
    cycles: 1,
    assistants: 1,
  });
  assert.equal(fate.totalFlips, 0, "调度本身不能提前结算收益");
  assert.equal(requests.length, 1);

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    assert.deepEqual(fate.assistantBatchFlip(2), {
      flips: 2,
      heads: 2,
      tails: 0,
      source: "assistant",
      cycles: 2,
      assistants: 1,
    });
  } finally {
    Math.random = originalRandom;
  }

  fate.tails = 40;
  assert.deepEqual(fate.getUpgradeAssistantSpeedCost(), {
    heads: 0,
    tails: 40,
  });
  assert.equal(fate.upgradeAssistantSpeed().success, true);
  assert.equal(fate.autoInterval, 2750);
  assert.equal(fate.getUpgradeAssistantSpeedCost().tails, 68);

  fate.autoInterval = 750;
  fate.tails = 1_000_000;
  assert.equal(fate.upgradeAssistantSpeed().success, false);
  assert.equal(fate.autoInterval, 750);
});

test("首局目标严格按顺序推进并能识别成长倾向", () => {
  const progression = new ProgressionSystem();

  assert.deepEqual(
    (({ id, current, value, progress }) => ({ id, current, value, progress }))(
      progression.getFirstSessionGuide({})
    ),
    { id: "flip", current: 1, value: 0, progress: 0 }
  );
  assert.equal(
    progression.getFirstSessionGuide({ totalFlips: 7 }).progress,
    0.875
  );
  assert.equal(
    progression.getFirstSessionGuide({ totalFlips: 8 }).id,
    "table"
  );
  assert.equal(
    progression.getFirstSessionGuide({ totalFlips: 8, fateCoins: 2 }).id,
    "assistant"
  );
  assert.equal(
    progression.getFirstSessionGuide({
      totalFlips: 8,
      fateCoins: 2,
      assistants: 1,
    }).id,
    "territory"
  );
  assert.equal(
    progression.getFirstSessionGuide({
      totalFlips: 8,
      fateCoins: 2,
      assistants: 1,
      buildings: 1,
    }).complete,
    true
  );

  const outOfOrder = progression.getFirstSessionGuide({
    fateCoins: 2,
    assistants: 1,
    buildings: 1,
  });
  assert.equal(outOfOrder.id, "flip");
  assert.equal(outOfOrder.completedCount, 3);

  assert.equal(progression.getPathSummary({}).leadingPath, null);
  const companion = progression.getPathSummary({
    assistants: 2,
    assistantPower: 3,
    assistantSpeedLevel: 2,
    petTrainingLevels: 3,
  });
  assert.equal(companion.leadingPath?.id, "companion");
  assert.equal(companion.highestScore, 11);
  assert.equal(progression.getRecommendationBoost("assistant", companion), 14);
  assert.equal(progression.getRecommendationBoost("gold", companion), 0);
});

test("命运商店评分、主次推荐和分类顺序可独立回归", () => {
  const candidates = [
    {
      action: "gold",
      baseScore: 100,
      benefitScore: 10,
      gap: { affordable: false, progress: 0.5, missingPenalty: 26 },
    },
    {
      action: "manual",
      baseScore: 60,
      benefitScore: 10,
      gap: { affordable: true, progress: 1, missingPenalty: 0 },
    },
    {
      action: "hero",
      baseScore: 70,
      benefitScore: 10,
      territoryScore: 42,
      pathBoost: 14,
      gap: { affordable: true, progress: 1, missingPenalty: 0 },
    },
  ];

  assert.equal(getFateRecommendationScore(candidates[0]), 93);
  const ranked = rankFateRecommendationCandidates(candidates);
  assert.deepEqual(
    ranked.candidates.map(({ action, score }) => ({ action, score })),
    [
      { action: "hero", score: 164 },
      { action: "manual", score: 98 },
      { action: "gold", score: 93 },
    ]
  );
  assert.equal(ranked.primary?.action, "hero");
  assert.equal(ranked.secondary?.action, "manual");
  assert.equal(candidates[0].score, undefined, "排序不能污染候选源数据");

  const tie = rankFateRecommendationCandidates([
    {
      action: "unavailable",
      baseScore: 82,
      gap: { affordable: false, progress: 1, missingPenalty: 0 },
    },
    {
      action: "available",
      baseScore: 72,
      gap: { affordable: true, progress: 1, missingPenalty: 0 },
    },
  ]);
  assert.equal(tie.primary?.action, "available");

  assert.equal(getFateShopDisplayOrder("primary", 6, "recommended"), 6);
  assert.equal(getFateShopDisplayOrder("secondary", 0, "recommended"), 100);
  assert.equal(getFateShopDisplayOrder("none", 0, "recommended"), 200);
  assert.equal(getFateShopDisplayOrder("none", 4, "fate"), 4);

  const fateCoinSystem = new FateCoinSystem();
  const progressionSystem = new ProgressionSystem();
  const shop = new ShopRecommendationController({
    fateCoinSystem,
    playerSystem: { player: { attack: 20, maxHp: 100 } },
    petSystem: {
      equippedPets: [{ level: 1 }],
      getEquippedPetLevelTotal: () => 1,
    },
    progressionSystem,
    getProgressionContext: () => ({}),
  });
  const initialRecommendation = shop.getFateUpgradeRecommendation(
    fateCoinSystem.getDisplayData(),
    {
      nextBuilding: {
        data: { name: "训练场" },
        state: { unlocked: false, pulse: 0, requiredPulse: 8 },
      },
    },
    progressionSystem.getPathSummary({})
  );
  assert.equal(initialRecommendation.primary?.action, "assistant");
  assert.equal(initialRecommendation.secondary?.action, "gold");
});

test("领地脉冲、建筑门槛和地块门槛覆盖完整配置", () => {
  const territory = new TerritorySystem(createResourceStub(), null);
  const breakdown = territory.getLoopPulseBreakdown({
    totalFlips: 999,
    fateCoins: 2,
    assistants: 1,
    heroTrainingLevel: 1,
    equippedPets: 3,
    petLevelTotal: 7,
    buildings: 1,
    expansionCount: 1,
  });

  assert.deepEqual(
    breakdown.map(({ id, value }) => [id, value]),
    [
      ["flips", 16],
      ["table", 24],
      ["assistants", 26],
      ["hero", 16],
      ["pets", 36],
      ["petLevels", 24],
      ["buildings", 14],
      ["expansion", 20],
    ]
  );
  assert.equal(
    breakdown.reduce((total, contribution) => total + contribution.value, 0),
    176
  );

  const buildingThresholds = {
    main_base: 0,
    training_ground: 8,
    workshop: 24,
    temple: 42,
    barracks: 64,
    crystal_mine: 88,
    library: 118,
  };
  for (const [type, threshold] of Object.entries(buildingThresholds)) {
    if (threshold > 0) {
      assert.equal(
        territory.getBuildingUnlockState(type, pulseContext(threshold - 1)).unlocked,
        false,
        `${type} 不应提前开放`
      );
    }
    assert.equal(
      territory.getBuildingUnlockState(type, pulseContext(threshold)).unlocked,
      true,
      `${type} 应在门槛开放`
    );
  }

  const slotThresholds = [0, 12, 28, 48, 72, 100, 132, 168, 208, 252, 300, 352];
  slotThresholds.forEach((threshold, index) => {
    if (threshold > 0) {
      assert.equal(
        territory.getLoopUnlockedSlotCount(pulseContext(threshold - 1)),
        index
      );
    }
    assert.equal(
      territory.getLoopUnlockedSlotCount(pulseContext(threshold)),
      index + 1
    );
  });

  const summary = territory.getProgressSummary(pulseContext(66));
  assert.equal(summary.stage, 5);
  assert.equal(summary.unlockedSlots, 4);
  assert.equal(summary.nextBuilding?.type, "crystal_mine");
});

test("领地建造同时执行建筑与地块解锁保护", () => {
  const territory = new TerritorySystem(createResourceStub(), null);
  territory.setOnPersist(() => {});

  assert.equal(territory.canBuild("training_ground", 0).success, false);
  territory.setProgressContext(pulseContext(8));
  assert.equal(territory.canBuild("training_ground", 0).success, true);
  assert.equal(territory.canBuild("training_ground", 1).reason, "地块未解锁");

  const secondTerritory = new TerritorySystem(createResourceStub(), null);
  secondTerritory.setOnPersist(() => {});
  secondTerritory.setProgressContext(pulseContext(12));
  assert.equal(secondTerritory.buildBuilding("main_base", 0).success, true);
  assert.equal(secondTerritory.canBuild("main_base", 1).reason, "主基地只能建造一个");
});

test("成就奖励只可领取一次，未完成目标不会发奖", () => {
  const progressionSystem = new ProgressionSystem();
  const totals = { coins: 0, rubies: 0, crystals: 0 };
  const calls = {
    resourceDisplay: 0,
    fateDisplay: 0,
    territoryDisplay: 0,
    saves: 0,
    renders: 0,
  };
  const toasts = [];
  const game = {
    fateCoinSystem: {
      getDisplayData: () => ({ totalFlips: 10, fateCoins: 1 }),
    },
    playerSystem: {
      player: { level: 1 },
      calculateTotalPower: () => 0,
    },
    petSystem: {
      unlockedPets: [],
      equippedPets: [],
      getEquippedPetLevelTotal: () => 0,
    },
    territorySystem: { buildings: [] },
    resourceSystem: {
      coins: 0,
      addCoins: (amount) => (totals.coins += amount),
      addRubies: (amount) => (totals.rubies += amount),
      addCrystals: (amount) => (totals.crystals += amount),
      updateDisplay: () => (calls.resourceDisplay += 1),
    },
    progressionSystem,
    saveSystem: {
      saveGame(slot) {
        assert.equal(slot, 1);
        calls.saves += 1;
        return Promise.resolve(true);
      },
    },
    uiSystem: {
      showToast(message, type) {
        toasts.push({ message, type });
      },
    },
    updateFateDisplay: () => (calls.fateDisplay += 1),
    updateTerritoryDisplay: () => (calls.territoryDisplay += 1),
    escapeHTML: (value) => String(value),
    formatGameNumber: (value) => String(value),
  };
  const controller = new AchievementController({
    ...game,
    escapeHTML: game.escapeHTML,
    formatNumber: game.formatGameNumber,
    onRewardClaimed() {
      game.updateFateDisplay();
      game.updateTerritoryDisplay();
    },
  });
  controller.render = () => (calls.renders += 1);

  controller.claimReward("fate_10");
  assert.equal(totals.coins, 80);
  assert.equal(progressionSystem.isAchievementClaimed("fate_10"), true);
  assert.deepEqual(calls, {
    resourceDisplay: 1,
    fateDisplay: 1,
    territoryDisplay: 1,
    saves: 1,
    renders: 1,
  });

  controller.claimReward("fate_10");
  assert.equal(totals.coins, 80);
  assert.equal(calls.saves, 1);
  assert.deepEqual(toasts.at(-1), { message: "奖励已领取", type: "info" });

  controller.claimReward("fate_100");
  assert.equal(progressionSystem.isAchievementClaimed("fate_100"), false);
  assert.deepEqual(toasts.at(-1), { message: "目标尚未完成", type: "info" });
});

test("现代存档可往返，旧版存档可迁移且不会串入会话状态", async () => {
  const previousStorage = globalThis.localStorage;
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;

  try {
    const player = createStateSystem({ player: { level: 7, attack: 45 } });
    player.player = { level: 7 };
    const systems = {
      player,
      resource: createStateSystem({ coins: 321, rubies: 4, crystals: 5 }),
      combat: createStateSystem({ currentWave: 3 }),
      pet: createStateSystem({ unlockedPets: [{ instanceId: 1 }] }),
      territory: createStateSystem({ buildings: [], unlockedSlots: 2 }),
      fate: createStateSystem({ fateCoins: 2, totalFlips: 9 }),
      progression: createStateSystem({ claimedAchievementIds: ["fate_10"] }),
    };
    const save = new SaveSystem();
    save.setGameSystems(systems);

    assert.equal(await save.saveGame(1), true);
    const serialized = JSON.parse(storage.getItem("petplan_save_1"));
    assert.equal(serialized.version, "1.1.0");
    assert.equal(serialized.level, 7);
    assert.deepEqual(serialized.data.fate, { fateCoins: 2, totalFlips: 9 });
    assert.deepEqual(serialized.data.progression, {
      claimedAchievementIds: ["fate_10"],
    });

    assert.equal(await save.loadGame(1), true);
    assert.deepEqual(systems.resource.loaded, {
      coins: 321,
      rubies: 4,
      crystals: 5,
    });
    assert.deepEqual(systems.progression.loaded, {
      claimedAchievementIds: ["fate_10"],
    });

    storage.setItem(
      "petplan_save_slot2",
      JSON.stringify({
        version: "1.0.0",
        timestamp: 100,
        player: { player: { level: 3 } },
        resources: { coins: 222 },
      })
    );
    assert.equal(await save.loadGame(2), true);
    assert.deepEqual(systems.fate.loaded, {});
    assert.deepEqual(systems.progression.loaded, {});
    assert.equal(JSON.parse(storage.getItem("petplan_save_2")).version, "1.1.0");

    storage.setItem("petplan_save_3", "{broken-json");
    const expectedErrors = [];
    const originalConsoleError = console.error;
    console.error = (...args) => expectedErrors.push(args);
    try {
      assert.equal(await save.loadGame(3), false);
      assert.equal(await save.saveGame(0), false);
    } finally {
      console.error = originalConsoleError;
    }
    assert.equal(expectedErrors.length, 2);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test("场景路由规范化 URL 并保持导航与可见场景同步", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  let currentUrl = new URL(
    "http://localhost:4174/index.html?scene=bogus&debug=1#status"
  );
  let replaceCalls = 0;
  const listeners = new Map();

  const navButtons = ["fate", "dungeon", "territory"].map((tab) => ({
    dataset: { tab },
    active: false,
    classList: {
      toggle(_name, enabled) {
        navButtons.find((button) => button.dataset.tab === tab).active = enabled;
      },
    },
  }));
  const scenes = Object.fromEntries(
    ["#fate-scene", "#battle-scene", "#territory-scene"].map((selector) => [
      selector,
      { style: { display: "none" } },
    ])
  );

  const syncLocation = () => {
    window.location.href = currentUrl.href;
    window.location.pathname = currentUrl.pathname;
    window.location.search = currentUrl.search;
    window.location.hash = currentUrl.hash;
  };

  globalThis.window = {
    location: {},
    history: {
      pushState(_state, _title, nextLocation) {
        currentUrl = new URL(nextLocation, currentUrl);
        syncLocation();
      },
      replaceState(_state, _title, nextLocation) {
        replaceCalls += 1;
        currentUrl = new URL(nextLocation, currentUrl);
        syncLocation();
      },
    },
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
  };
  globalThis.document = {
    querySelectorAll: (selector) => (selector === ".nav-btn" ? navButtons : []),
    querySelector: (selector) => scenes[selector] || null,
  };
  syncLocation();

  try {
    const router = new SceneRouter();
    assert.equal(router.getRequestedScene("fate", { normalize: true }), "fate");
    assert.equal(replaceCalls, 1);
    assert.equal(currentUrl.searchParams.has("scene"), false);
    assert.equal(currentUrl.searchParams.get("debug"), "1");
    assert.equal(currentUrl.hash, "#status");

    assert.equal(router.activate("territory", { syncHistory: true }), "territory");
    assert.equal(navButtons.find(({ active }) => active)?.dataset.tab, "territory");
    assert.equal(scenes["#territory-scene"].style.display, "flex");
    assert.equal(scenes["#fate-scene"].style.display, "none");
    assert.equal(currentUrl.searchParams.get("scene"), "territory");

    let historyScene = null;
    router.bindHistory((scene) => {
      historyScene = scene;
    });
    assert.equal(typeof listeners.get("popstate"), "function");
    listeners.get("popstate")();
    assert.equal(historyScene, "territory");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
