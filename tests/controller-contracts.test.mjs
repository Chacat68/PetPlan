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
    ["open", "close", "render", "claimReward"],
  ],
  [
    "BattleSceneController",
    BattleSceneController,
    ["bind", "destroy", "handleBattleActionResult", "updateBattleDisplay"],
  ],
  [
    "FateSceneController",
    FateSceneController,
    ["bind", "destroy", "handleFateFlip", "handleAutoFlip", "handleUpgrade", "updateDisplay"],
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
    ["bind", "destroy", "update", "getFateUpgradeRecommendation", "setFateShopFilter"],
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
