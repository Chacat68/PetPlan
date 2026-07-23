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

test("BattleSceneController 撤离预估使用当前威胁和规则参数", () => {
  const controller = Object.create(BattleSceneController.prototype);
  const estimate = controller.getExtractionEstimate({
    minDurationMs: 8000,
    baseDurationMs: 9000,
    threatDurationStepMs: 1500,
    overpressureDurationStepMs: 90,
    baseEnemyCount: 5,
    threatPerEnemy: 12,
    overpressurePerEnemy: 10,
  }, { depth: 5, threat: 50, overpressure: 0 });
  assert.deepEqual(estimate, { durationSeconds: 12, enemyCount: 14 });
});

test("BattleSceneController 通过 Q 使用唯一队伍技且不再绑定切枪键", () => {
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
  assert.doesNotMatch(keyboardBinding, /KeyR|Digit\[123\]/);
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
  assert.match(riskSource, /dangerousExit \? "战败" : "保底"/);
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

test("BattleSceneController 只在进入远征或阶段变化时重置终端滚动", () => {
  const originalDocument = globalThis.document;
  const panel = { scrollTop: 371, dataset: {} };
  const status = { textContent: "" };
  globalThis.document = {
    getElementById(id) {
      if (id === "upgrade-panel") return panel;
      if (id === "battle-terminal-status") return status;
      return null;
    },
  };

  try {
    const controller = Object.create(BattleSceneController.prototype);
    controller.isSceneActive = true;
    controller.shouldFocusTerminal = true;
    controller.lastTerminalPhase = "route";
    controller.lastTerminalAttentionKey = null;
    controller.compactTerminalOpen = true;

    controller.syncTerminalContext({
      phase: "route",
      phaseLabel: "大地图探索",
      actions: { canAbandon: true },
    });
    assert.equal(panel.scrollTop, 0);
    assert.equal(panel.dataset.compactOpen, "false", "行动阶段应默认收起终端");

    panel.scrollTop = 144;
    controller.syncTerminalContext({
      phase: "route",
      phaseLabel: "大地图探索",
      actions: { canAbandon: true },
    });
    assert.equal(panel.scrollTop, 144, "同一阶段刷新不应抢夺滚动位置");

    controller.syncTerminalContext({
      phase: "combat",
      phaseLabel: "遭遇战斗",
      actions: { canAbandon: true },
    });
    assert.equal(panel.scrollTop, 0);
    assert.match(status.textContent, /遭遇战斗/);

    controller.syncTerminalContext({
      phase: "combat",
      phaseLabel: "遭遇战斗",
      actions: { canAbandon: true },
      pendingLootChoice: { incoming: { id: "rare-loot" } },
    });
    assert.equal(panel.dataset.compactOpen, "true", "强制取舍应自动展开终端");
  } finally {
    globalThis.document = originalDocument;
  }
});
