import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import test from "node:test";

import { TerritorySystem } from "../js/modules/territory-system.js";
import { TerritoryWorldSystem } from "../js/modules/territory-world-system.js";

const BUILDING_ASSETS = [
  "main-base.png",
  "training-ground.png",
  "guardian-temple.png",
  "workshop.png",
  "barracks.png",
  "expedition-library.png",
  "crystal-mine.png",
];

const SCENE_ASSETS = [
  "sky-panorama.png",
  "ground-road-tile-unified.png",
  "lamp-post.png",
  "district-marker.png",
  "construction-platform.png",
  "expedition-gate.png",
  "frontier-barrier.png",
  ...BUILDING_ASSETS,
];

test("领地 v2 环境与七类建筑均提供可加载的统一图片资产", () => {
  for (const fileName of SCENE_ASSETS) {
    const assetUrl = new URL(`../images/territory-v2/${fileName}`, import.meta.url);
    assert.equal(existsSync(assetUrl), true, `${fileName} 不存在`);
    assert.ok(statSync(assetUrl).size > 10_000, `${fileName} 不是有效场景图片`);
  }
});

function createResourceStub({ coins = 100_000, crystals = 100_000 } = {}) {
  return {
    coins,
    crystals,
    hasEnoughCoins(amount) { return this.coins >= amount; },
    hasEnoughCrystals(amount) { return this.crystals >= amount; },
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
    addCoins(amount) { this.coins += amount; },
    addCrystals(amount) { this.crystals += amount; },
  };
}

test("领地等级永久开放固定分区，并由远征与建设共同升阶", () => {
  const territory = new TerritorySystem(createResourceStub(), null);
  territory.setOnPersist(() => {});

  assert.equal(territory.getProgressSummary().rank, 0);
  assert.equal(territory.getWorldWidth(), 1680);
  assert.equal(territory.buildBuilding("main_base", 0).success, true);
  assert.equal(territory.getProgressSummary().rank, 1);
  assert.equal(territory.getWorldWidth(), 2180);

  assert.equal(territory.buildBuilding("training_ground", 1).success, true);
  assert.equal(territory.buildBuilding("temple", 2).success, true);
  assert.match(territory.canExpand().reason, /成功撤离/);
  territory.setProgressContext({ extractions: 1, bestDepth: 3, equippedPets: 2 });
  assert.equal(territory.expandTerritory().success, true);
  assert.equal(territory.rank, 2);
  assert.equal(territory.getLoopUnlockedSlotCount(), 6);
  assert.equal(territory.getWorldWidth(), 2660);

  assert.equal(territory.buildBuilding("barracks", 4).success, false);
  assert.match(territory.getBuildingUnlockState("barracks").reason, /训练场达到/);
  assert.equal(territory.upgradeBuilding(1).success, true);
  assert.equal(territory.getBuildingUnlockState("barracks").unlocked, true);
  assert.equal(territory.buildBuilding("barracks", 4).success, true);
  assert.equal(territory.canBuild("barracks", 4).reason, "兵营只能建造一座");
});

test("基地生产有离线容量上限，领取后不会重复结算", () => {
  const resource = createResourceStub();
  const territory = new TerritorySystem(resource, null);
  territory.setOnPersist(() => {});
  territory.buildBuilding("main_base", 0);
  territory.buildBuilding("workshop", 3);

  const now = 2_000_000_000_000;
  territory.getBuildingByType("workshop").lastProduction = now - 10 * 60 * 1000;
  const snapshot = territory.getProductionSnapshot(now);
  assert.equal(snapshot.coins, 225);
  assert.equal(snapshot.storageHours, 8);

  const before = resource.coins;
  assert.deepEqual(territory.collectResources(now), { coins: 225, crystals: 0 });
  assert.equal(resource.coins, before + 225);
  assert.deepEqual(territory.collectResources(now), { coins: 0, crystals: 0 });
});

test("基地活动生成一次性远征战备并在出发时可被消费", () => {
  const territory = new TerritorySystem(createResourceStub(), null);
  territory.setOnPersist(() => {});
  territory.buildBuilding("main_base", 0);
  territory.buildBuilding("training_ground", 1);
  territory.buildBuilding("temple", 2);

  assert.equal(territory.performActivity("training_ground", 1_000_000).success, true);
  assert.equal(territory.performActivity("temple", 1_000_000).success, true);
  assert.deepEqual(territory.getPreparedBonuses(), {
    attack: 6,
    defense: 4,
    supplies: 0,
    expBonus: 0,
  });
  const consumed = territory.consumePreparedBonuses();
  assert.equal(consumed.attack, 6);
  assert.equal(consumed.defense, 4);
  assert.deepEqual(territory.getPreparedBonuses(), {
    attack: 0,
    defense: 0,
    supplies: 0,
    expBonus: 0,
  });
});

test("实际基地世界支持横向移动、宠物跟随、邻近交互与活动过程", () => {
  const world = new TerritoryWorldSystem();
  world.setRank(1);
  world.resetPosition();
  world.syncFollowers([
    { instanceId: "pet-1", templateId: "slime" },
    { instanceId: "pet-2", templateId: "fox" },
  ]);

  assert.equal(world.getNearbySite()?.type, "main_base");
  world.setMoveTarget(520);
  for (let index = 0; index < 28; index += 1) world.update(100);
  assert.ok(world.player.x < 600);
  assert.equal(world.getNearbySite()?.type, "training_ground");
  assert.equal(world.followers.length, 2);
  assert.ok(world.followers[0].x > world.player.x);

  assert.equal(world.startActivity("training_ground", {
    label: "实战训练",
    durationMs: 300,
  }), true);
  assert.equal(world.getState().activity?.label, "实战训练");
  world.update(100);
  world.update(100);
  world.update(100);
  assert.equal(world.getState().activity, null);
  assert.equal(world.consumeCompletedActivity()?.buildingType, "training_ground");
  assert.equal(world.consumeCompletedActivity(), null);
});
