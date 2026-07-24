import assert from "node:assert/strict";
import test from "node:test";

import { AchievementController } from "../js/controllers/achievement-controller.js";
import { BattleSceneController } from "../js/controllers/battle-scene-controller.js";
import { FateSceneController } from "../js/controllers/fate-scene-controller.js";
import { OrientationController } from "../js/controllers/orientation-controller.js";
import { PetModalController } from "../js/controllers/pet-modal-controller.js";
import { PlayerModalController } from "../js/controllers/player-modal-controller.js";
import { SettingsController } from "../js/controllers/settings-controller.js";
import { ShopRecommendationController } from "../js/controllers/shop-recommendation-controller.js";
import { TerritorySceneController } from "../js/controllers/territory-scene-controller.js";

const controllerContracts = [
  [
    "AchievementController",
    AchievementController,
    [
      "open",
      "close",
      "render",
      "refreshProgress",
      "handleSystemChange",
      "updateBadge",
      "claimReward",
      "claimAllRewards",
    ],
  ],
  [
    "BattleSceneController",
    BattleSceneController,
    ["bind", "destroy", "handleBattleActionResult", "updateBattleDisplay", "useTeamSkill"],
  ],
  [
    "FateSceneController",
    FateSceneController,
    [
      "bind",
      "destroy",
      "resetTransientRuntime",
      "setSceneActive",
      "handleFateFlip",
      "handleAutoFlip",
      "handleUpgrade",
      "updateDisplay",
    ],
  ],
  [
    "OrientationController",
    OrientationController,
    ["bind", "destroy", "update", "isNarrowPortrait", "setActive"],
  ],
  [
    "PetModalController",
    PetModalController,
    ["open", "close", "render", "handleAction"],
  ],
  [
    "PlayerModalController",
    PlayerModalController,
    ["bindEvents", "destroy", "open", "close", "update"],
  ],
  [
    "SettingsController",
    SettingsController,
    ["bindEvents", "destroy", "open", "close", "quickSave", "quickLoad"],
  ],
  [
    "ShopRecommendationController",
    ShopRecommendationController,
    [
      "bind",
      "destroy",
      "update",
      "requestRecommendationCommit",
      "cancelRecommendationCommit",
      "getFateUpgradeRecommendation",
      "setFateShopFilter",
    ],
  ],
  [
    "TerritorySceneController",
    TerritorySceneController,
    ["bind", "destroy", "syncProgress", "renderGrid", "updateDisplay", "handleBuild"],
  ],
];

for (const [name, Controller, methods] of controllerContracts) {
  test(`${name} 暴露组合根依赖的公共接口`, () => {
    assert.equal(typeof Controller, "function");

    for (const method of methods) {
      assert.equal(
        typeof Controller.prototype[method],
        "function",
        `${name}.${method} 应保持为公共方法`
      );
    }
  });
}

test("BattleSceneController 不会通过追踪栏泄露未知地点名称", () => {
  const controller = Object.create(BattleSceneController.prototype);
  assert.equal(
    controller.getNavigationLabel({ kind: "route", name: "废弃补给站", known: false, discovered: false }),
    "未知信号"
  );
  assert.equal(
    controller.getNavigationLabel({ kind: "route", name: "废弃补给站", known: true, discovered: true }),
    "废弃补给站"
  );
});

test("BattleSceneController 没有可追踪地点时不会发出空追踪请求", () => {
  const controller = Object.create(BattleSceneController.prototype);
  controller.combatSystem = {
    getBattleState: () => ({
      actions: { canTrackMap: true },
      routeChoices: [],
      world: {
        locations: [
          { id: "hidden", kind: "world-event", state: "available", known: false },
          { id: "locked", kind: "extraction", state: "locked" },
        ],
      },
    }),
    trackLocation() {
      assert.fail("没有候选地点时不应调用 trackLocation");
    },
  };
  assert.deepEqual(controller.cycleNavigationTarget(), {
    success: false,
    message: "当前没有可追踪的地图目标",
  });
});

test("BattleSceneController 保留单队伍技并提供补给、背包和目标快捷键", () => {
  let usedSkillId = null;
  const controller = Object.create(BattleSceneController.prototype);
  controller.combatSystem = {
    getBattleState: () => ({
      petSkills: [
        { instanceId: "leader-skill", ready: true },
        { instanceId: "reserve-skill", ready: true },
      ],
    }),
    usePetSkill(skillId) {
      usedSkillId = skillId;
      return { success: true, message: "队伍技已释放" };
    },
  };

  assert.deepEqual(controller.useTeamSkill(), { success: true, message: "队伍技已释放" });
  assert.equal(usedSkillId, "leader-skill");

  const keyboardBinding = BattleSceneController.prototype.bindMovementControls.toString();
  assert.match(keyboardBinding, /event\.code === "KeyQ"[\s\S]*?this\.useTeamSkill\(\)/);
  assert.match(keyboardBinding, /event\.code === "KeyR"[\s\S]*?reloadWeapon/);
  assert.match(keyboardBinding, /event\.code === "Digit4"[\s\S]*?useSupply/);
  assert.match(keyboardBinding, /event\.code === "KeyB"[\s\S]*?setBackpackOpen/);
  assert.match(keyboardBinding, /event\.code === "KeyM"[\s\S]*?cycleNavigationTarget/);
  assert.match(keyboardBinding, /"KeyW", "ArrowUp"[\s\S]*?"KeyD", "ArrowRight"/);
  assert.doesNotMatch(keyboardBinding, /data-move-direction|pointerDirections/);
  assert.doesNotMatch(keyboardBinding, /event\.code === "Tab"|setCompactTerminalOpen|Digit\[123\]/);
});

test("BattleSceneController 以档位和数值表达警戒", () => {
  const controller = Object.create(BattleSceneController.prototype);
  assert.equal(controller.getThreatTierLabel({ threat: 12 }), "警戒");
  assert.equal(controller.getThreatTierLabel({ threat: 55 }), "围猎");
  assert.equal(
    controller.getThreatTierLabel({ threat: 55, threatPreview: { label: "追捕" } }),
    "追捕",
  );
});

test("BattleSceneController 区分整局可开火与真实交战状态", () => {
  const displaySource = BattleSceneController.prototype.updateBattleDisplay.toString();
  assert.match(displaySource, /const combatEngaged = Boolean\([^]*?state\.raidThreatActive/);
  assert.match(displaySource, /dataset\.combatActive = combatEngaged \? "true" : "false"/);
  assert.doesNotMatch(displaySource, /dataset\.combatActive = \(state\.actions\.canFire/);
});

test("BattleSceneController 合并活动局保险并跳过未变化的 Meta 重绘", () => {
  const metaSource = BattleSceneController.prototype.renderMetaState.toString();
  assert.match(metaSource, /activeRaidInsuredIds/);
  assert.match(metaSource, /metaRenderSignature === this\.lastMetaRenderSignature/);
});

test("BattleSceneController 的搜索预览与撤离提示符合精简规则", () => {
  const previewSource = BattleSceneController.prototype.renderSearchBonuses.toString();
  const tipSource = BattleSceneController.prototype.getTip.toString();
  assert.match(previewSource, /quick:\s*\{[^}]*threat:\s*2[^}]*durationSeconds:\s*2/s);
  assert.match(previewSource, /thorough:\s*\{[^}]*lootMin:\s*2[^}]*lootMax:\s*3[^}]*durationSeconds:\s*5/s);
  assert.match(tipSource, /撤离进度已暂停，返回信标后继续/);
  assert.doesNotMatch(tipSource, /进度会回退/);
});

test("BattleSceneController 的风险预览只显示单一警戒并区分退出风险", () => {
  const riskSource = BattleSceneController.prototype.renderRiskPreview.toString();
  assert.doesNotMatch(riskSource, /overpressure|returnPressure|battle-return-pressure|返程压力|超限/);
  assert.match(riskSource, /dangerousExit[^]*?battle-failure-preview-label/);
  assert.match(riskSource, /state\.raidThreatActive/);
  assert.match(riskSource, /不保留战斗收益/);
});

test("BattleSceneController 会列出失败时真正暴露的配装", () => {
  const controller = Object.create(BattleSceneController.prototype);
  const exposed = controller.getAtRiskLoadoutItems({
    activeRaid: { insuredLoadoutIds: ["insured-armor"] },
    loadout: {
      mainWeapon: { instanceId: "starter", name: "基础武器", permanent: true },
      armor: { instanceId: "insured-armor", name: "保险护甲" },
      petLinker: { instanceId: "risky-link", name: "暴露链接器" },
      consumables: [{ instanceId: "risky-med", name: "剩余补给", quantity: 1 }],
    },
  });
  assert.deepEqual(exposed.map((item) => item.instanceId), ["risky-link", "risky-med"]);
});

test("BattleSceneController 将路线、事件和撤离点合并为可轮换目标", () => {
  let trackedId = null;
  const state = {
    phase: "route",
    actions: { canTrackMap: true },
    routeChoices: [
      { id: "route-a", name: "废弃仓库" },
      { id: "route-b", name: "污染水站" },
    ],
    world: {
      navigationTarget: { nodeId: "route-a" },
      locations: [
        { id: "event-known", kind: "world-event", state: "available", known: true, name: "求救信号" },
        { id: "event-hidden", kind: "world-event", state: "available", known: false, name: "隐藏信号" },
        { id: "entry-extract", kind: "extraction", state: "unlocked", name: "入口信标" },
        { id: "locked-extract", kind: "extraction", state: "locked", name: "未解锁信标" },
      ],
    },
  };
  const controller = Object.create(BattleSceneController.prototype);
  controller.combatSystem = {
    getBattleState: () => state,
    trackLocation(id) {
      trackedId = id;
      return { success: true, message: `已追踪 ${id}` };
    },
  };

  assert.deepEqual(
    controller.getNavigationCandidates(state).map((candidate) => candidate.id),
    ["route-a", "route-b", "event-known", "entry-extract"],
  );
  assert.equal(controller.cycleNavigationTarget().success, true);
  assert.equal(trackedId, "route-b");
});

test("BattleSceneController 允许在行进与交火中整理背包，并在搜索/撤离时锁定", () => {
  const originalDocument = globalThis.document;
  const focusedChoice = { focusCalled: false, focus() { this.focusCalled = true; } };
  const drawer = {
    hidden: true,
    dataset: {},
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    querySelector() { return focusedChoice; },
    contains() { return false; },
  };
  const toggle = {
    disabled: false,
    title: "",
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const close = { hidden: false, disabled: false };
  const modalEvents = [];
  const board = {
    inert: false,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  globalThis.document = {
    activeElement: null,
    getElementById(id) {
      if (id === "battle-pack-drawer") return drawer;
      if (id === "battle-pack-toggle") return toggle;
      if (id === "battle-pack-close") return close;
      return null;
    },
    querySelector(selector) {
      return selector === ".battle-board-panel" ? board : null;
    },
  };

  try {
    const controller = Object.create(BattleSceneController.prototype);
    controller.backpackOpen = false;
    controller.clearControlInput = () => {};
    controller.modalFocusManager = {
      activate(modal) { modalEvents.push(["activate", modal]); },
      release(modal) { modalEvents.push(["release", modal]); },
    };
    const safeState = {
      phase: "route",
      actions: { canAbandon: true },
      isWaveActive: false,
    };
    assert.equal(controller.setBackpackOpen(true, safeState), true);
    assert.equal(drawer.hidden, false);
    assert.equal(toggle.attributes["aria-expanded"], "true");

    assert.equal(controller.setBackpackOpen(true, {
      phase: "combat",
      actions: { canAbandon: true },
      isWaveActive: true,
    }), true);
    assert.equal(drawer.hidden, false);

    assert.equal(controller.setBackpackOpen(true, {
      phase: "route",
      actions: { canAbandon: true },
      activeSearch: { locationId: "cache-a" },
    }), false);
    assert.equal(drawer.hidden, true);
    assert.equal(toggle.disabled, true);

    assert.equal(controller.setBackpackOpen(false, {
      phase: "combat",
      actions: { canAbandon: true },
      pendingLootChoice: { incoming: { id: "rare-loot" } },
    }), true);
    assert.equal(drawer.dataset.forced, "true");
    assert.equal(close.hidden, true);
    assert.equal(drawer.attributes.role, "dialog");
    assert.equal(board.inert, true);
    assert.deepEqual(modalEvents, [["activate", drawer]]);

    assert.equal(controller.setBackpackOpen(false, {
      phase: "route",
      actions: { canAbandon: true },
      pendingLootChoice: null,
    }, { forceClose: true }), false);
    assert.equal(board.inert, false);
    assert.deepEqual(modalEvents, [["activate", drawer], ["release", drawer]]);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("BattleSceneController 结算摘要只展示实际结算收益", () => {
  const originalDocument = globalThis.document;
  const elements = new Map([
    "battle-summary-label-a",
    "battle-summary-label-b",
    "battle-summary-label-c",
    "battle-summary-label-d",
    "battle-rooms-display",
    "battle-kills-display",
    "battle-reward-coins",
    "battle-extractions-display",
    "battle-settlement-detail",
  ].map(id => [id, { textContent: "", hidden: true }]));
  globalThis.document = {
    getElementById(id) { return elements.get(id) || null; },
  };

  try {
    const controller = Object.create(BattleSceneController.prototype);
    controller.getTip = () => "主动撤退，安全袋带回 2 件，遗失 3 件。";
    controller.renderRunSummary({
      pendingValue: 999999,
      settlement: {
        extracted: false,
        coins: 30,
        crystals: 2,
        rubyReward: 1,
        exp: 40,
        insuredLootRecovered: 2,
        lootLost: 3,
      },
    }, value => `#${value}`);

    assert.equal(elements.get("battle-rooms-display").textContent, "#30");
    assert.equal(elements.get("battle-kills-display").textContent, "#2 / #1");
    assert.equal(elements.get("battle-reward-coins").textContent, "#40");
    assert.equal(elements.get("battle-extractions-display").textContent, "2 / 3 件");
    assert.equal(elements.get("battle-settlement-detail").hidden, false);
    assert.match(elements.get("battle-settlement-detail").textContent, /遗失 3 件/);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("BattleSceneController 明确标注首次撤离资源桥接", () => {
  const controller = Object.create(BattleSceneController.prototype);
  controller.formatPetBondSummary = () => "";
  const tip = controller.getTip({
    settlement: {
      extracted: true,
      coins: 800,
      crystals: 82,
      exp: 50,
      rubyReward: 0,
      firstExtractionBonus: { coins: 700, crystals: 80 },
      metaSettlement: null,
    },
  });
  assert.match(tip, /首次撤离奖励：700 金币、80 水晶/);
});
