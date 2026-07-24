import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import test from "node:test";

import { TerritorySceneController } from "../js/controllers/territory-scene-controller.js";
import {
  TERRITORY_BUILDING_ART_SOURCES,
  TERRITORY_SCENE_ART_SOURCES,
} from "../js/modules/territory-art-config.js";
import { TerritorySystem } from "../js/modules/territory-system.js";
import { TerritoryWorldSystem } from "../js/modules/territory-world-system.js";

const PAINTERLY_CITY_ASSETS = [
  "expedition_gate.webp",
  "main_base.webp",
  "training_ground.webp",
  "temple.webp",
  "workshop.webp",
  "barracks.webp",
  "library.webp",
  "crystal_mine.webp",
];

test("领地运行时只保留 AVIF/WebP 压缩资产", () => {
  for (const legacyDirectory of ["territory", "territory-v2", "territory-v3"]) {
    assert.equal(
      existsSync(new URL(`../images/${legacyDirectory}/`, import.meta.url)),
      false,
      `${legacyDirectory} 旧资产目录仍然存在`,
    );
  }

  for (const fileName of ["fate-aligned-sanctuary-sky.avif", "fate-aligned-sanctuary-sky.webp"]) {
    const assetUrl = new URL(`../images/territory-v4/${fileName}`, import.meta.url);
    assert.equal(existsSync(assetUrl), true, `${fileName} 不存在`);
    assert.ok(statSync(assetUrl).size > 10_000, `${fileName} 不是有效场景图片`);
  }
  assert.equal(
    existsSync(new URL("../images/territory-v4/fate-aligned-sanctuary-sky.png", import.meta.url)),
    false,
    "天空生产 PNG 仍然存在",
  );

  for (const fileName of PAINTERLY_CITY_ASSETS) {
    const assetUrl = new URL(`../images/territory-v5/${fileName}`, import.meta.url);
    assert.equal(existsSync(assetUrl), true, `${fileName} 不存在`);
    assert.ok(statSync(assetUrl).size > 40_000, `${fileName} 不是有效透明建筑素材`);
    assert.equal(
      existsSync(new URL(`../images/territory-v5/${fileName.replace(".webp", ".png")}`, import.meta.url)),
      false,
      `${fileName} 的生产 PNG 仍然存在`,
    );
  }

  assert.deepEqual(
    [...TERRITORY_SCENE_ART_SOURCES.sky].map((source) => source.match(/\.(avif|webp)\?/)?.[1]),
    ["avif", "webp"],
  );
  assert.ok(
    Object.values(TERRITORY_BUILDING_ART_SOURCES)
      .flat()
      .every((source) => /\.webp\?/.test(source)),
    "建筑运行时来源应全部使用 WebP",
  );
});

test("领地图片进入场景后才按等级加载", async () => {
  const originalImage = globalThis.Image;
  const requests = [];
  class FakeImage {
    set src(value) {
      this._src = value;
      requests.push(value);
      this.complete = true;
      this.naturalWidth = 100;
      this.naturalHeight = 100;
      queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this._src;
    }
  }
  globalThis.Image = FakeImage;

  try {
    const controller = new TerritorySceneController({
      canvas: { width: 1280, height: 720, getContext: () => null },
      territorySystem: { rank: 0 },
      resourceSystem: {},
    });
    assert.deepEqual(requests, [], "控制器初始化时不应预取领地图片");

    controller.isSceneActive = true;
    await controller.ensureAssetsForRank(0);
    assert.deepEqual(
      Object.keys(controller.sceneImages).sort(),
      ["expedition_gate", "main_base", "sky"],
      "R0 只应加载远景、探索门与主基地",
    );

    await controller.ensureAssetsForRank(2);
    assert.equal(controller.sceneImages.crystal_mine, undefined, "R3 水晶矿不应在 R2 提前加载");
    for (const type of ["training_ground", "temple", "workshop", "barracks", "library"]) {
      assert.ok(controller.sceneImages[type], `${type} 未按等级加载`);
    }
    assert.ok(requests.every((source) => /\.(avif|webp)\?/.test(source)), "懒加载不应回退到旧 PNG");
  } finally {
    if (originalImage === undefined) delete globalThis.Image;
    else globalThis.Image = originalImage;
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

test("新存档可在领地靠近次元探索门", () => {
  const world = new TerritoryWorldSystem();
  const gate = world.getSite("expedition_gate");
  assert.ok(gate, "领地缺少次元探索门");
  assert.equal(world.rank, 0);

  world.player.x = gate.x - world.player.width / 2;
  assert.equal(world.updateNearbySite()?.type, "expedition_gate");
  assert.equal(world.getNearbySite()?.name, "次元探索门");
});

test("领地等级永久开放固定分区，并由远征与建设共同升阶", () => {
  const territory = new TerritorySystem(createResourceStub(), null);
  territory.setOnPersist(() => {});

  assert.equal(territory.getProgressSummary().rank, 0);
  assert.deepEqual(
    {
      kind: territory.getProgressSummary().nextGoal.kind,
      buildingType: territory.getProgressSummary().nextGoal.buildingType,
      title: territory.getProgressSummary().nextGoal.title,
    },
    { kind: "build", buildingType: "main_base", title: "点亮星愿屋" }
  );
  assert.equal(territory.getWorldWidth(), 1680);
  assert.equal(territory.buildBuilding("main_base", 0).success, true);
  assert.equal(territory.getProgressSummary().rank, 1);
  assert.equal(territory.getProgressSummary().nextGoal.title, "建设闪耀训练馆");
  assert.equal(territory.getWorldWidth(), 2180);

  assert.equal(territory.buildBuilding("training_ground", 1).success, true);
  assert.equal(territory.buildBuilding("temple", 2).success, true);
  assert.equal(territory.buildBuilding("workshop", 3).success, true);
  assert.deepEqual(
    {
      kind: territory.getProgressSummary().nextGoal.kind,
      metric: territory.getProgressSummary().nextGoal.metric,
      scene: territory.getProgressSummary().nextGoal.scene,
    },
    { kind: "requirement", metric: "extractions", scene: "territory" }
  );
  assert.match(territory.canExpand().reason, /成功撤离/);
  territory.setProgressContext({ extractions: 1, bestDepth: 3, equippedPets: 2 });
  assert.equal(territory.getProgressSummary().nextGoal.kind, "promote");
  assert.equal(territory.expandTerritory().success, true);
  assert.equal(territory.rank, 2);
  assert.equal(territory.getLoopUnlockedSlotCount(), 6);
  assert.equal(territory.getWorldWidth(), 2660);

  assert.equal(territory.buildBuilding("barracks", 4).success, false);
  assert.match(territory.getBuildingUnlockState("barracks").reason, /闪耀训练馆达到/);
  assert.equal(territory.upgradeBuilding(1).success, true);
  assert.equal(territory.getBuildingUnlockState("barracks").unlocked, true);
  assert.equal(territory.buildBuilding("barracks", 4).success, true);
  assert.equal(territory.canBuild("barracks", 4).reason, "星光特训屋只能建造一座");
});

test("下一目标优先推荐可执行动作，并明确显示建设资源缺口", () => {
  const resource = createResourceStub({ coins: 0, crystals: 0 });
  const territory = new TerritorySystem(resource, null);
  territory.setOnPersist(() => {});
  territory.debugBuildBuilding("main_base");

  const expeditionGoal = territory.getProgressSummary().nextGoal;
  assert.equal(expeditionGoal.metric, "extractions");
  assert.equal(expeditionGoal.status, "in_progress");
  assert.equal(expeditionGoal.ctaLabel, "前往次元探索门");

  territory.setProgressContext({ extractions: 1 });
  const blockedGoal = territory.getProgressSummary().nextGoal;
  assert.equal(blockedGoal.kind, "build");
  assert.equal(blockedGoal.buildingType, "training_ground");
  assert.equal(blockedGoal.status, "blocked");
  assert.match(blockedGoal.detail, /还差 400 金币/);
  assert.match(blockedGoal.detail, /还差 30 水晶/);
  assert.equal(blockedGoal.blockers.length, 2);

  const tinyProduction = territory.getNextProgressionGoal({
    coins: 1,
    crystals: 0,
    buildings: [{ capped: false }],
  });
  assert.notEqual(tinyProduction.kind, "collect", "零散储备不应抢占被阻塞的核心目标");
});

test("旧领地槽位不会直接映射到 R5，v2 异常等级保留为资历记录", () => {
  const legacy = new TerritorySystem(createResourceStub(), null);
  legacy.setOnPersist(() => {});
  legacy.loadSaveData({
    buildings: [{ type: "main_base", level: 1 }],
    unlockedSlots: 12,
    expansionCount: 0,
  });
  assert.equal(legacy.rank, 1);
  assert.equal(legacy.getSaveData().territoryVersion, 3);

  const migratedV2 = new TerritorySystem(createResourceStub(), null);
  migratedV2.setOnPersist(() => {});
  migratedV2.loadSaveData({
    territoryVersion: 2,
    rank: 5,
    buildings: [{ type: "main_base", level: 1 }],
    preparedBonuses: { attack: 6 },
  });
  assert.equal(migratedV2.rank, 1);
  assert.equal(migratedV2.legacyVeteranRank, 5);
  assert.equal(migratedV2.getPreparedBonuses().attack, 6);

  const current = new TerritorySystem(createResourceStub(), null);
  current.setOnPersist(() => {});
  current.loadSaveData({
    territoryVersion: 3,
    rank: 5,
    legacyVeteranRank: 5,
    buildings: [{ type: "main_base", level: 1 }],
  });
  assert.equal(current.rank, 5, "当前版本的永久等级不能在正常读档时倒退");
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
  assert.equal(snapshot.coins, 54);
  assert.equal(snapshot.storageHours, 8);
  assert.deepEqual(territory.getWorkshopCapabilities(), {
    unlocked: true,
    level: 1,
    role: "expedition-crafting",
    queueSlots: 1,
    recipeTier: 1,
    passiveCoinRatePerMinute: 5.4,
    productionEfficiency: 0.12,
  });

  const before = resource.coins;
  assert.deepEqual(territory.collectResources(now), { coins: 54, crystals: 0 });
  assert.equal(resource.coins, before + 54);
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

  const supportedTerritory = new TerritorySystem(createResourceStub(), null);
  supportedTerritory.setOnPersist(() => {});
  supportedTerritory.buildBuilding("main_base", 0);
  supportedTerritory.buildBuilding("training_ground", 1);
  const supported = supportedTerritory.performActivity(
    "training_ground",
    1_000_000,
    {
      petSupport: {
        buildingType: "training_ground",
        petName: "火焰犬",
        roleLabel: "训练陪练",
        tier: 3,
        tierLabel: "挚友",
      },
    },
  );
  assert.equal(supported.success, true);
  assert.equal(supported.preparedBonuses.attack, 9);
  assert.equal(supported.petSupport.effect.detail, "攻击战备 +3");
  assert.match(supported.message, /火焰犬以训练陪练协助（攻击战备 \+3）/);
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
