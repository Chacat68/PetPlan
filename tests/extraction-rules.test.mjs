import assert from "node:assert/strict";
import test from "node:test";

import {
  ExpeditionRunSystem,
  EXTRACTION_RULES,
} from "../js/modules/expedition-run-system.js";
import {
  ExpeditionWorldSystem,
  WORLD_EXTRACTION_RULES,
} from "../js/modules/expedition-world-system.js";

function createLoot(id, score, { insured = false } = {}) {
  return {
    id,
    name: id,
    rarity: "common",
    rarityLabel: "普通",
    coins: score,
    crystals: 0,
    exp: 0,
    score,
    insured,
  };
}

function prepareExtractionRun({ depth, supplies }) {
  const run = new ExpeditionRunSystem({ random: () => 0.5 });
  assert.equal(run.startRun({ supplies }).success, true);
  run.depth = depth;
  run.phase = "route";
  return run;
}

test("失败结算只回收显式放入保险格的战利品", () => {
  const uninsuredRun = prepareExtractionRun({ depth: 3, supplies: 2 });
  uninsuredRun.backpack = [createLoot("low", 10), createLoot("valuable", 500)];

  assert.deepEqual(uninsuredRun.getProtectedLoot(), []);
  const uninsuredSettlement = uninsuredRun.finishRun({ extracted: false, reason: "defeated" });
  assert.equal(uninsuredSettlement.insuredLootRecovered, 0);
  assert.equal(uninsuredSettlement.lootLost, 2);
  assert.equal(uninsuredSettlement.coins, 0, "最高价值物品不应再被系统自动保险");

  const insuredRun = prepareExtractionRun({ depth: 3, supplies: 2 });
  insuredRun.backpack = [createLoot("low", 10), createLoot("valuable", 500)];
  assert.equal(insuredRun.protectLoot("low").success, true);

  const insuredSettlement = insuredRun.finishRun({ extracted: false, reason: "defeated" });
  assert.equal(insuredSettlement.insuredLootRecovered, 1);
  assert.equal(insuredSettlement.lootLost, 1);
  assert.equal(insuredSettlement.coins, 0, "保险物进入仓库，不应同时自动折现");
  assert.equal(insuredSettlement.lootValue, 10);
});

test("旧入口撤离保持兼容，应急撤离要求更深进度和一份补给", () => {
  const entryRun = prepareExtractionRun({ depth: 3, supplies: 0 });
  assert.equal(entryRun.canExtract(), true, "旧 canExtract() 仍检查入口撤离");
  assert.equal(entryRun.canExtractAt("extraction-beacon"), true);
  assert.equal(entryRun.getExtractionRule("standard").id, "entry");

  const entryResult = entryRun.startExtraction();
  assert.equal(entryResult.success, true);
  assert.equal(entryResult.extractionType, "entry");
  assert.equal(entryResult.locationId, EXTRACTION_RULES.entry.locationId);
  assert.equal(entryRun.supplies, 0);
  assert.equal(EXTRACTION_RULES.entry.baseDurationMs, 6000);
  assert.equal(EXTRACTION_RULES.entry.baseEnemyCount, 2);

  const shallowRun = prepareExtractionRun({ depth: 4, supplies: 2 });
  const shallowAvailability = shallowRun.getExtractionAvailability("emergency");
  assert.equal(shallowAvailability.canExtract, false);
  assert.equal(shallowAvailability.reason, "depth");

  const noSupplyRun = prepareExtractionRun({ depth: 5, supplies: 0 });
  const noSupplyAvailability = noSupplyRun.getExtractionAvailability("emergency-extraction");
  assert.equal(noSupplyAvailability.canExtract, false);
  assert.equal(noSupplyAvailability.reason, "supplies");

  const emergencyRun = prepareExtractionRun({ depth: 5, supplies: 1 });
  assert.equal(emergencyRun.canExtractAt({ locationId: "emergency-extraction" }), true);
  const emergencyResult = emergencyRun.startExtraction({ extractionType: "emergency" });
  assert.equal(emergencyResult.success, true);
  assert.equal(emergencyResult.extractionType, "emergency");
  assert.equal(emergencyResult.locationId, EXTRACTION_RULES.emergency.locationId);
  assert.equal(emergencyRun.supplies, 0, "应急撤离应在启动时消耗补给");
  assert.equal(EXTRACTION_RULES.emergency.baseDurationMs, 9000);
  assert.equal(EXTRACTION_RULES.emergency.baseEnemyCount, 5);
  assert.equal(emergencyResult.encounter.eliteCount, 0, "应急撤离不应无条件追加精英");
  assert.ok(emergencyResult.durationMs > entryResult.durationMs);
  assert.ok(emergencyResult.encounter.enemyCount > entryResult.encounter.enemyCount);
  assert.ok(emergencyResult.encounter.reinforcementIntervalMs < entryResult.encounter.reinforcementIntervalMs);
  assert.ok(
    emergencyResult.encounter.enemyCount - entryResult.encounter.enemyCount >= 4,
    "应急撤离应形成明显高于入口撤离的首波压力",
  );

  const state = emergencyRun.getState();
  assert.equal(state.activeExtractionType, "emergency");
  assert.equal(state.extractionRules.emergency.minDepth, 5);
  assert.equal(state.extractionAvailability.emergency.reason, "invalid-phase");

  const restored = new ExpeditionRunSystem({ random: () => 0.5 });
  assert.equal(restored.loadRunSaveData(emergencyRun.getRunSaveData()).success, true);
  assert.equal(restored.getState().activeExtractionType, "emergency");
});

test("旧超限压力不会再提高撤离时长、敌人数或增援速度", () => {
  const normal = prepareExtractionRun({ depth: 5, supplies: 1 });
  normal.threat = 75;
  const normalResult = normal.startExtraction({ extractionType: "emergency" });

  const legacy = prepareExtractionRun({ depth: 5, supplies: 1 });
  legacy.threat = 75;
  legacy.overpressure = 80;
  const legacyResult = legacy.startExtraction({ extractionType: "emergency" });

  assert.equal(legacyResult.durationMs, normalResult.durationMs);
  assert.equal(legacyResult.encounter.enemyCount, normalResult.encounter.enemyCount);
  assert.equal(legacyResult.encounter.reinforcementIntervalMs, normalResult.encounter.reinforcementIntervalMs);
  assert.equal(legacyResult.encounter.overpressure, 0);
});

test("大地图同时保存入口与深区撤离点，并可按地点单独追踪和激活", () => {
  const world = new ExpeditionWorldSystem();
  world.startRun([], { seed: 42 });

  const emergency = world.getLocation("emergency-extraction");
  assert.ok(emergency);
  assert.equal(emergency.extractionType, "emergency");
  assert.equal(emergency.state, "locked");
  assert.equal(world.trackLocation(emergency.id).success, false);
  assert.equal(world.canExtractAt(emergency, { depth: 5, supplies: 1, phase: "route" }), true);
  assert.equal(world.canExtractAt(emergency, { depth: 5, supplies: 0, phase: "route" }), false);

  assert.equal(world.setExtractionUnlocked(true, "emergency"), true);
  assert.equal(world.trackLocation("emergency-extraction").success, true);
  const activated = world.activateExtraction("emergency-extraction");
  assert.equal(activated?.id, "emergency-extraction");

  const state = world.getState({ x: emergency.x, y: emergency.y });
  assert.equal(state.extractionLocations.length, 2);
  assert.equal(state.activeExtractionLocationId, "emergency-extraction");
  assert.equal(state.extractionAvailability.emergency, true);
  assert.deepEqual(state.extractionRules.emergency, { ...WORLD_EXTRACTION_RULES.emergency });

  const saveData = world.getRunSaveData();
  const restored = new ExpeditionWorldSystem();
  assert.equal(restored.loadRunSaveData(saveData).success, true);
  assert.equal(restored.getLocation("emergency-extraction")?.state, "engaged");
  assert.equal(restored.getState().activeExtractionLocationId, "emergency-extraction");
});

test("旧版仅含入口信标的世界存档会补建锁定的应急撤离点", () => {
  const original = new ExpeditionWorldSystem();
  original.startRun([], { seed: 7 });
  original.setExtractionUnlocked(true);
  const legacySave = original.getRunSaveData();
  legacySave.locations = legacySave.locations.filter(location => location.id !== "emergency-extraction");
  delete legacySave.extractionAvailability;
  delete legacySave.activeExtractionLocationId;

  const restored = new ExpeditionWorldSystem();
  assert.equal(restored.loadRunSaveData(legacySave).success, true);
  assert.equal(restored.getLocation("extraction-beacon")?.state, "unlocked");
  assert.equal(restored.getLocation("emergency-extraction")?.state, "locked");
  assert.equal(restored.getState().extractionLocations.length, 2);
});
