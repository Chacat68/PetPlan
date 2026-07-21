import assert from "node:assert/strict";
import test from "node:test";

import { AchievementController } from "../js/controllers/achievement-controller.js";
import { BattleSceneController } from "../js/controllers/battle-scene-controller.js";
import { FateSceneController } from "../js/controllers/fate-scene-controller.js";
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
    ["bind", "destroy", "handleBattleActionResult", "updateBattleDisplay"],
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
