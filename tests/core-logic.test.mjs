import assert from "node:assert/strict";
import test from "node:test";

import { AchievementController } from "../js/controllers/achievement-controller.js";
import { AchievementSystem } from "../js/modules/achievement-system.js";
import { FateSceneController } from "../js/controllers/fate-scene-controller.js";
import { PlayerModalController } from "../js/controllers/player-modal-controller.js";
import { SettingsController } from "../js/controllers/settings-controller.js";
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
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    assert.deepEqual(fate.update(1), {
      flips: 1,
      heads: 1,
      tails: 0,
      source: "assistant",
      cycles: 1,
      assistants: 1,
    });
    assert.equal(fate.totalFlips, 1, "自动收益必须在系统层立即结算");
    assert.deepEqual(requests[0], {
      flips: 1,
      heads: 1,
      tails: 0,
      source: "assistant",
      cycles: 1,
      assistants: 1,
    });

    assert.deepEqual(fate.assistantBatchFlip(2), {
      flips: 2,
      heads: 2,
      tails: 0,
      source: "assistant",
      cycles: 2,
      assistants: 1,
    });

    fate.autoInterval = 750;
    assert.deepEqual(fate.update(2250), {
      flips: 3,
      heads: 3,
      tails: 0,
      source: "assistant",
      cycles: 3,
      assistants: 1,
    });
  } finally {
    Math.random = originalRandom;
  }

  fate.autoInterval = 3000;
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

test("命运购买与跨系统训练都只刷新一次最终状态", () => {
  const fate = new FateCoinSystem();
  const notifications = [];
  fate.heads = 100;
  fate.tails = 100;
  fate.setOnChange((data) => notifications.push(data));

  assert.equal(fate.spend({ heads: 3, tails: 2 }, { notify: false }), true);
  assert.equal(notifications.length, 0);
  assert.deepEqual(
    { heads: fate.heads, tails: fate.tails },
    { heads: 97, tails: 98 }
  );

  assert.equal(fate.spend({ heads: 2 }), true);
  assert.equal(notifications.length, 1);

  const shopCalls = { request: 0, cancel: 0 };
  const changed = [];
  const controller = new FateSceneController({
    fateCoinSystem: fate,
    playerSystem: {
      applyFateTraining: () => ({ success: true, message: "主角训练" }),
    },
    shopController: {
      requestRecommendationCommit: () => (shopCalls.request += 1),
      cancelRecommendationCommit: () => (shopCalls.cancel += 1),
      getFateHeroTrainingCost: () => ({ heads: 5, tails: 5 }),
    },
    onChanged: (event) => changed.push(event),
  });
  const refreshes = [];
  controller.updateDisplay = () => refreshes.push("refresh");
  fate.setOnChange(() => controller.updateDisplay());

  assert.equal(controller.handleUpgrade("manual").success, true);
  assert.deepEqual(shopCalls, { request: 1, cancel: 0 });
  assert.equal(refreshes.length, 1, "纯命运购买应只响应一次系统通知");
  assert.equal(changed.length, 0, "纯命运购买由系统通知完成唯一一次刷新");

  controller.onChanged = (event) => {
    changed.push(event);
    controller.updateDisplay();
  };
  assert.equal(controller.handleUpgrade("hero").success, true);
  assert.equal(refreshes.length, 2, "跨系统训练应只刷新一次最终状态");
  assert.equal(changed.length, 1);

  fate.heads = 0;
  assert.equal(controller.handleUpgrade("manual").success, false);
  assert.deepEqual(shopCalls, { request: 3, cancel: 1 });
  assert.equal(refreshes.length, 2, "失败购买不应触发无意义刷新");
});

test("命运存档字段会规范化，异常间隔不会制造 Infinity 或海量状态", () => {
  const fate = new FateCoinSystem();
  fate.loadSaveData({
    fateCoins: 10000,
    pendingGoldCoins: 10000,
    heads: -5,
    tails: "17.9",
    assistants: "bad",
    manualPower: 0,
    assistantPower: Infinity,
    autoInterval: 0,
    totalFlips: NaN,
  });

  assert.deepEqual(
    {
      fateCoins: fate.fateCoins,
      heads: fate.heads,
      tails: fate.tails,
      assistants: fate.assistants,
      manualPower: fate.manualPower,
      assistantPower: fate.assistantPower,
      autoInterval: fate.autoInterval,
      totalFlips: fate.totalFlips,
    },
    {
      fateCoins: 256,
      heads: 0,
      tails: 17,
      assistants: 0,
      manualPower: 1,
      assistantPower: 1,
      autoInterval: 750,
      totalFlips: 0,
    }
  );
  assert.equal(fate.update(1000), null);
});

test("每枚桌面硬币每个面值周期只能手动结算一次", () => {
  const fate = new FateCoinSystem();
  const controller = new FateSceneController({ fateCoinSystem: fate });
  controller.addFateCoinDrops = () => {};
  controller.addFateResult = () => {};
  controller.playFateTableCoinClickFeedback = () => {};
  const attributes = new Map();
  const coin = {
    dataset: { face: "heads", settled: "false", coinIndex: "1" },
    classList: { add() {}, remove() {} },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };

  controller.handleFateFlip(coin);
  controller.handleFateFlip(coin);
  assert.equal(fate.heads, 1);
  assert.equal(fate.totalFlips, 1);
  assert.equal(coin.dataset.settled, "true");

  controller.setFateTableCoinFace(coin, "tails");
  assert.equal(coin.dataset.settled, "false");
  controller.handleFateFlip(coin);
  assert.equal(fate.tails, 1);
  assert.equal(fate.totalFlips, 2);
  assert.match(attributes.get("aria-label"), /硬币 1/);
  assert.equal(controller.getFateTableCoinRenderLimit({ clientWidth: 400 }), 8);
  assert.equal(controller.getFateTableCoinRenderLimit({ clientWidth: 600 }), 12);
  assert.equal(controller.getFateTableCoinRenderLimit({ clientWidth: 900 }), 18);
});

test("快速读档会先清理临时运行态，再应用存档并刷新界面", async () => {
  const order = [];
  const controller = new SettingsController({
    saveSystem: {
      async loadGame(slot) {
        assert.equal(slot, 1);
        order.push("load");
        return true;
      },
      getSaveInfo: () => null,
    },
    onBeforeGameLoad() {
      order.push("reset");
    },
    onGameLoaded() {
      order.push("refresh");
    },
  });
  controller.updateStatus = () => {};

  assert.equal(await controller.quickLoad(), true);
  assert.deepEqual(order, ["reset", "load", "refresh"]);
});

test("主角与设置控制台会同步新的概览状态", () => {
  const originalDocument = globalThis.document;
  const elementIds = [
    "player-modal-level",
    "player-modal-power",
    "player-modal-coins",
    "player-modal-exp",
    "player-modal-exp-bar",
    "settings-scene-label",
    "settings-system-scene",
    "settings-save-state",
    "settings-save-time",
    "settings-save-level",
    "settings-save-version",
  ];
  const elements = new Map(
    elementIds.map((id) => [id, { id, style: {}, textContent: "" }])
  );
  globalThis.document = {
    getElementById: (id) => elements.get(id) || null,
  };

  try {
    const playerController = new PlayerModalController({
      playerSystem: {
        player: { level: 7, exp: 25, expToNext: 100 },
        calculateTotalPower: () => 4321,
      },
      resourceSystem: {
        coins: 9876,
        formatNumber: (value) => Number(value).toLocaleString("en-US"),
      },
    });
    playerController.updateSummary();

    assert.equal(elements.get("player-modal-level").textContent, "Lv.7");
    assert.equal(elements.get("player-modal-power").textContent, "4,321");
    assert.equal(elements.get("player-modal-coins").textContent, "9,876");
    assert.equal(elements.get("player-modal-exp").textContent, "25 / 100");
    assert.equal(elements.get("player-modal-exp-bar").style.width, "25%");

    const settingsController = new SettingsController({
      getCurrentScene: () => "territory",
      saveSystem: {
        getSaveInfo: () => ({
          timestamp: new Date("2026-07-14T03:00:00Z").getTime(),
          level: 7,
          version: "v3",
        }),
      },
    });
    settingsController.updateStatus();

    assert.equal(elements.get("settings-scene-label").textContent, "领地");
    assert.equal(elements.get("settings-system-scene").textContent, "领地");
    assert.equal(elements.get("settings-save-state").textContent, "存档同步完成");
    assert.equal(elements.get("settings-save-level").textContent, "Lv.7");
    assert.equal(elements.get("settings-save-version").textContent, "v3");
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
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
    "expedition"
  );
  assert.equal(
    progression.getFirstSessionGuide({
      totalFlips: 8,
      fateCoins: 2,
      assistants: 1,
      expeditionDepth: 1,
    }).id,
    "extraction"
  );
  assert.equal(
    progression.getFirstSessionGuide({
      totalFlips: 8,
      fateCoins: 2,
      assistants: 1,
      expeditionDepth: 1,
      extractions: 1,
    }).id,
    "territory"
  );
  assert.equal(
    progression.getFirstSessionGuide({
      totalFlips: 8,
      fateCoins: 2,
      assistants: 1,
      expeditionDepth: 1,
      extractions: 1,
      buildings: 1,
    }).complete,
    true
  );

  const outOfOrder = progression.getFirstSessionGuide({
    fateCoins: 2,
    assistants: 1,
    expeditionDepth: 1,
    extractions: 1,
    buildings: 1,
  });
  assert.equal(outOfOrder.id, "flip");
  assert.equal(outOfOrder.completedCount, 5);

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

  assert.equal(progression.getOnboardingState().status, "new");
  progression.startOnboarding();
  assert.equal(progression.getOnboardingState().active, true);
  const onboardingSave = progression.getSaveData();
  const restoredProgression = new ProgressionSystem();
  restoredProgression.loadSaveData(onboardingSave);
  assert.equal(restoredProgression.getOnboardingState().status, "active");
  restoredProgression.dismissOnboarding();
  assert.equal(restoredProgression.getOnboardingState().status, "dismissed");
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

  const flipGuide = progressionSystem.getFirstSessionGuide({});
  const flipGoal = shop.getFirstSessionGoal(
    flipGuide,
    fateCoinSystem.getDisplayData(),
    initialRecommendation
  );
  assert.equal(flipGoal.title, "熟悉命运翻转");
  assert.match(flipGoal.detail, /每个面值周期可结算一次/);

  const territoryGoal = shop.getFateNextGoal(
    fateCoinSystem.getDisplayData(),
    {
      nextGoal: {
        title: "成功撤离 1 次",
        detail: "当前撤离次数 0 / 1",
        route: "远征目标",
        routeType: "combat",
        scene: "dungeon",
        action: "progress",
        status: "in_progress",
        blockers: [{ metric: "extractions", gap: 1 }],
        ctaLabel: "前往远征",
      },
    },
    initialRecommendation,
    { complete: true }
  );
  assert.deepEqual(territoryGoal, {
    title: "成功撤离 1 次",
    detail: "当前撤离次数 0 / 1",
    route: "远征目标",
    routeType: "combat",
    scene: "dungeon",
    action: "progress",
    status: "in_progress",
    blockers: [{ metric: "extractions", gap: 1 }],
    ctaLabel: "前往远征",
    alt: "购买第 1 个助手",
  });
  assert.doesNotMatch(territoryGoal.detail, /循环脉冲/);

  const tableGuide = progressionSystem.getFirstSessionGuide({ totalFlips: 8 });
  const guidedRecommendation = shop.applyFirstSessionRecommendation(
    initialRecommendation,
    tableGuide
  );
  assert.equal(guidedRecommendation.primary?.action, "gold");

  shop.commitRecommendation(guidedRecommendation);
  const changedScores = {
    ...guidedRecommendation,
    primary: guidedRecommendation.secondary,
    secondary: guidedRecommendation.primary,
  };
  const stableRecommendation = shop.getCommittedRecommendation(changedScores);
  assert.equal(stableRecommendation.primary?.action, "gold");
  assert.equal(stableRecommendation.secondary?.action, "assistant");

  shop.playerSystem.player.attack = 999;
  assert.deepEqual(shop.getFateHeroTrainingCost(), { heads: 14, tails: 6 });
  shop.playerSystem.fateTrainingLevel = 5;
  assert.deepEqual(shop.getFateHeroTrainingCost(), { heads: 56, tails: 17 });

});

test("领地共鸣纳入远征功绩，但地块只由永久领地等级开放", () => {
  const territory = new TerritorySystem(createResourceStub(), null);
  territory.setOnPersist(() => {});
  const breakdown = territory.getLoopPulseBreakdown({
    totalFlips: 999,
    fateCoins: 2,
    assistants: 1,
    heroTrainingLevel: 1,
    equippedPets: 3,
    petLevelTotal: 7,
    bestDepth: 5,
    extractions: 2,
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
      ["expedition", 64],
    ]
  );
  assert.equal(
    breakdown.reduce((total, contribution) => total + contribution.value, 0),
    206
  );

  territory.setProgressContext({ totalFlips: 999, fateCoins: 8, assistants: 8 });
  assert.equal(territory.getLoopUnlockedSlotCount(), 1);
  assert.equal(territory.getProgressSummary().rank, 0);
  assert.equal(territory.buildBuilding("main_base", 0).success, true);
  assert.equal(territory.getProgressSummary().rank, 1);
  assert.equal(territory.getLoopUnlockedSlotCount(), 4);
});

test("领地主建筑唯一、使用固定施工点并受蓝图条件保护", () => {
  const territory = new TerritorySystem(createResourceStub(), null);
  territory.setOnPersist(() => {});

  assert.equal(territory.canBuild("training_ground", 0).success, false);
  assert.equal(territory.buildBuilding("main_base", 0).success, true);
  assert.equal(territory.canBuild("training_ground", 1).success, true);
  assert.equal(territory.buildBuilding("training_ground", 1).success, true);
  assert.equal(territory.canBuild("training_ground", 1).reason, "训练场只能建造一座");
  assert.equal(territory.canBuild("main_base", 0).reason, "主基地只能建造一座");
  assert.equal(territory.canUpgrade(1).success, true);
  assert.equal(territory.upgradeBuilding(1).success, true);
  assert.equal(territory.getBuildingLevel("training_ground"), 2);
});

test("里程碑完成会锁存，奖励只可领取一次且支持批量领取", async () => {
  const totals = { coins: 0, rubies: 0, crystals: 0 };
  const calls = {
    fateDisplay: 0,
    territoryDisplay: 0,
    saves: 0,
  };
  const toasts = [];
  const resourceSystem = {
    addCoins: (amount) => (totals.coins += amount),
    addRubies: (amount) => (totals.rubies += amount),
    addCrystals: (amount) => (totals.crystals += amount),
  };
  const achievementSystem = new AchievementSystem({
    resourceSystem,
    now: () => 12345,
  });
  const initialUpdate = achievementSystem.updateProgress(
    { totalFlips: 10, equippedPets: 3 },
    { notify: false }
  );
  assert.deepEqual(
    initialUpdate.newCompletions.map((item) => item.id),
    ["fate_10", "pet_team"]
  );

  achievementSystem.updateProgress(
    { totalFlips: 0, equippedPets: 0 },
    { notify: false }
  );
  assert.equal(achievementSystem.getItem("fate_10").current, 10);
  assert.equal(achievementSystem.getItem("pet_team").current, 3);
  assert.equal(achievementSystem.getItem("pet_team").completedAt, 12345);

  const controller = new AchievementController({
    achievementSystem,
    getContext: () => ({ totalFlips: 0, equippedPets: 0 }),
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
    escapeHTML: (value) => String(value),
    formatNumber: (value) => String(value),
    onRewardClaimed() {
      calls.fateDisplay += 1;
      calls.territoryDisplay += 1;
    },
  });

  const claimableMarkup = controller.renderItem(
    achievementSystem.getItem("fate_10"),
    0,
  );
  assert.match(claimableMarkup, /achievement-state-claimable/);
  assert.match(claimableMarkup, /achievement-medallion/);
  assert.match(claimableMarkup, /achievement-reward-token is-coins/);
  assert.match(claimableMarkup, />领取奖励<\/button>/);

  await controller.claimReward("fate_10");
  assert.equal(totals.coins, 80);
  assert.equal(achievementSystem.isClaimed("fate_10"), true);
  assert.match(
    controller.renderItem(achievementSystem.getItem("fate_10"), 0),
    /achievement-state-claimed/,
  );
  assert.deepEqual(calls, {
    fateDisplay: 1,
    territoryDisplay: 1,
    saves: 1,
  });

  await controller.claimReward("fate_10");
  assert.equal(totals.coins, 80);
  assert.equal(calls.saves, 1);
  assert.deepEqual(toasts.at(-1), { message: "奖励已领取", type: "info" });

  await controller.claimReward("fate_100");
  assert.equal(achievementSystem.isClaimed("fate_100"), false);
  assert.deepEqual(toasts.at(-1), { message: "里程碑尚未达成", type: "info" });

  const claimAll = achievementSystem.claimAllRewards();
  assert.equal(claimAll.success, true);
  assert.deepEqual(claimAll.claimedItems.map((item) => item.id), ["pet_team"]);
  assert.equal(totals.rubies, 30);
  assert.equal(achievementSystem.getSummary().claimable, 0);

  const savedState = achievementSystem.getSaveData();
  const restored = new AchievementSystem({ resourceSystem });
  restored.loadSaveData(savedState);
  assert.equal(restored.isClaimed("fate_10"), true);
  assert.equal(restored.getItem("pet_team").completed, true);
  assert.equal(restored.getItem("pet_team").current, 3);

  const legacy = new AchievementSystem({ resourceSystem });
  legacy.loadSaveData({
    claimedAchievementIds: ["fate_10", "task_coins_1000"],
  });
  assert.equal(legacy.isClaimed("fate_10"), true);
  assert.equal(legacy.getItem("fate_10").completed, true);
  assert.deepEqual(legacy.getSaveData().claimedIds, ["fate_10"]);
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
      achievement: createStateSystem({
        schemaVersion: 1,
        claimedIds: ["pet_first"],
        completedAtById: { pet_first: 10 },
        highWaterMarks: { unlockedPets: 1 },
      }),
    };
    const save = new SaveSystem();
    save.setGameSystems(systems);

    assert.equal(await save.saveGame(1), true);
    const serialized = JSON.parse(storage.getItem("petplan_save_1"));
    assert.equal(serialized.version, "1.5.0");
    assert.equal(serialized.level, 7);
    assert.deepEqual(serialized.data.fate, { fateCoins: 2, totalFlips: 9 });
    assert.deepEqual(serialized.data.progression, {
      claimedAchievementIds: ["fate_10"],
    });
    assert.deepEqual(serialized.data.achievement, {
      schemaVersion: 1,
      claimedIds: ["pet_first"],
      completedAtById: { pet_first: 10 },
      highWaterMarks: { unlockedPets: 1 },
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
    assert.deepEqual(systems.achievement.loaded, {
      schemaVersion: 1,
      claimedIds: ["pet_first"],
      completedAtById: { pet_first: 10 },
      highWaterMarks: { unlockedPets: 1 },
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
    assert.deepEqual(systems.achievement.loaded, { claimedAchievementIds: [] });
    assert.equal(JSON.parse(storage.getItem("petplan_save_2")).version, "1.5.0");

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
