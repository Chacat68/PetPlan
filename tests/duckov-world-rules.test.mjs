import assert from "node:assert/strict";
import test from "node:test";

import {
  ExpeditionRunSystem,
  EXTRACTION_RULES,
  LOOT_TABLE,
} from "../js/modules/expedition-run-system.js";
import {
  ExpeditionWorldSystem,
  WORLD_EXTRACTION_RULES,
} from "../js/modules/expedition-world-system.js";

function loot(id, score, extra = {}) {
  return {
    id,
    name: id,
    rarity: "common",
    rarityLabel: "普通",
    type: "test",
    coins: score,
    crystals: 0,
    exp: 0,
    score,
    ...extra,
  };
}

test("新局一次生成全图热点，选择和完成一个地点不会让其他热点失效", () => {
  const run = new ExpeditionRunSystem({ random: () => 0.5 });
  assert.equal(run.startRun().success, true);
  const initial = run.getState();
  assert.equal(initial.routeChoices.length, 8);
  assert.deepEqual(initial.routeChoices, initial.hotspots);
  assert.ok(initial.routeChoices.every((node) => node.revisitable));
  assert.ok(new Set(initial.routeChoices.map((node) => node.depth)).size >= 5);
  const coreVault = initial.routeChoices.find((node) => node.id === "core-vault");
  assert.equal(coreVault?.type, "cache");
  assert.equal(coreVault?.contractLocationId, "core-vault");
  assert.equal(coreVault?.keyRoom, true);

  const search = initial.routeChoices.find((node) => node.type === "search");
  const untouchedIds = initial.routeChoices.filter((node) => node.id !== search.id).map((node) => node.id);
  assert.equal(run.chooseNode(search.id).success, true);
  assert.equal(run.getState().routeChoices.length, 8);
  const completed = run.resolveSearch("quick");
  assert.equal(completed.success, true);
  assert.equal(run.getState().phase, "route");
  assert.ok(run.getState().completedNodeIds.includes(search.id));
  assert.ok(untouchedIds.every((id) => run.getState().routeChoices.some((node) => node.id === id && !node.completed)));
  assert.equal(run.chooseNode(search.id).revisited, true);
});

test("前两危险度不随机产出史诗，彻底搜索的稀有率保持在约 5%", () => {
  const run = new ExpeditionRunSystem({ seed: 1337 });
  run.startRun();
  const shallowCombat = run.getState().routeChoices.find((node) => (
    node.type === "combat" && node.depth === 2
  ));
  run.chooseNode(shallowCombat.id);

  const rarityCounts = { common: 0, uncommon: 0, rare: 0, epic: 0 };
  const sampleCount = 5000;
  for (let index = 0; index < sampleCount; index += 1) {
    rarityCounts[run.generateLoot(2).rarity] += 1;
  }
  const rareRate = rarityCounts.rare / sampleCount;
  assert.equal(rarityCounts.epic, 0);
  assert.ok(rareRate >= 0.04 && rareRate <= 0.06, `浅层稀有率应接近 5%，实际为 ${rareRate}`);

  const bossRun = new ExpeditionRunSystem({ random: () => 0.999 });
  bossRun.startRun();
  const boss = bossRun.getState().routeChoices.find((node) => node.type === "boss");
  bossRun.chooseNode(boss.id);
  assert.equal(bossRun.generateLoot(2).rarity, "epic");
});

test("普通搜索展示 2–3 件候选，危险仓库展示 3–4 件候选", () => {
  const ordinary = new ExpeditionRunSystem({ random: () => 0.5 });
  ordinary.startRun({ backpackCapacity: 8 });
  const search = ordinary.getState().routeChoices.find((node) => node.type === "search");
  ordinary.chooseNode(search.id);
  const ordinaryResult = ordinary.resolveSearch("quick");
  assert.ok(ordinaryResult.foundLoot.length >= 2 && ordinaryResult.foundLoot.length <= 3);

  const dangerous = new ExpeditionRunSystem({ random: () => 0.5 });
  dangerous.startRun({ backpackCapacity: 8 });
  const cache = dangerous.getState().routeChoices.find((node) => node.type === "cache");
  dangerous.chooseNode(cache.id);
  const dangerousResult = dangerous.resolveSearch("quick");
  assert.ok(dangerousResult.foundLoot.length >= 3 && dangerousResult.foundLoot.length <= 4);
});

test("背包满载后所有候选都进入显式取舍队列，价值分数不触发自动替换", () => {
  const run = new ExpeditionRunSystem({ backpackCapacity: 3 });
  run.startRun({ backpackCapacity: 3 });
  run.addLoot(loot("low", 10));
  run.addLoot(loot("high", 100));
  run.addLoot(loot("locked", 30, { locked: true, marked: true }));

  const cheap = run.addLoot(loot("cheap-incoming", 1), { requireDecision: true, source: "search" });
  const expensive = run.addLoot(loot("expensive-incoming", 999), { requireDecision: true, source: "search" });
  assert.equal(cheap.pending, true);
  assert.equal(expensive.queued, true);
  assert.deepEqual(run.backpack.map((item) => item.id), ["low", "high", "locked"]);
  assert.equal(run.pendingLootChoice.incoming.id, "cheap-incoming");
  assert.equal(run.lootOverflowQueue.length, 1);

  assert.equal(run.resolveLootChoice("replace", "locked").success, false);
  assert.equal(run.setLootLocked("locked", false).success, true);
  assert.equal(run.backpack.find((item) => item.id === "locked").locked, false);
  assert.equal(run.resolveLootChoice("replace", "high").success, true);
  assert.ok(run.backpack.some((item) => item.id === "cheap-incoming"), "玩家可主动用低价值物替换高价值物");
  assert.equal(run.pendingLootChoice.incoming.id, "expensive-incoming");
  assert.equal(run.resolveLootChoice("leave").success, true);
  assert.equal(run.pendingLootChoice, null);
});

test("首批轻量掉落覆盖五类用途并保留旧掉落名与任务标记", () => {
  const catalog = Object.values(LOOT_TABLE).flat();
  assert.equal(catalog.length, 16);
  assert.ok(catalog.some((item) => item.name === "破旧钱袋"));
  assert.ok(catalog.some((item) => item.name === "星辉核心"));
  for (const category of ["ammo", "medical", "equipment", "quest", "valuable"]) {
    assert.ok(catalog.some((item) => item.category === category), `缺少 ${category} 掉落`);
  }
  const markedQuest = catalog.find((item) => item.questItem && item.locked);
  assert.equal(markedQuest.marked, true);
  assert.match(markedQuest.marker, /任务/);
});

test("入口撤离开局可用且约四秒，应急撤离仍要求深区与补给", () => {
  const run = new ExpeditionRunSystem({ random: () => 0.5 });
  run.startRun({ supplies: 0 });
  assert.equal(run.depth, 0);
  assert.equal(run.canExtractAt("entry"), true);
  const entry = run.startExtraction("entry");
  assert.equal(entry.success, true);
  assert.ok(entry.durationMs >= 3500 && entry.durationMs <= 4500);
  assert.equal(EXTRACTION_RULES.entry.minDepth, 0);

  const emergency = new ExpeditionRunSystem({ random: () => 0.5 });
  emergency.startRun({ supplies: 0 });
  emergency.depth = 5;
  assert.equal(emergency.getExtractionAvailability("emergency").reason, "supplies");
  emergency.supplies = 1;
  assert.equal(emergency.canExtractAt("emergency"), true);
  assert.equal(WORLD_EXTRACTION_RULES.entry.minDepth, 0);
});

test("主动放弃只回收保险格，不保留战斗现金、经验或普通战利品", () => {
  const run = new ExpeditionRunSystem();
  run.startRun({ safetyBagCapacity: 2 });
  assert.equal(run.getState().insuredSlotCount, 2);
  assert.equal(run.getState().safetyBagCapacity, 2);
  run.addPendingRewards({ coins: 120, exp: 80, kills: 2 });
  run.addLoot(loot("insured", 20));
  run.addLoot(loot("uninsured", 100));
  run.protectLoot("insured");
  const settlement = run.finishRun({ extracted: false, reason: "abandoned" });
  assert.equal(settlement.coins, 0);
  assert.equal(settlement.exp, 0);
  assert.equal(settlement.insuredLootRecovered, 1);
  assert.equal(settlement.lootLost, 1);
  assert.equal(settlement.lootValue, 20);
});

test("世界热点不会互相标记 missed，完成后可回访且追踪优先输出方向和区域", () => {
  const run = new ExpeditionRunSystem({ random: () => 0.5 });
  run.startRun();
  const world = new ExpeditionWorldSystem();
  world.startRun(run.getState().routeChoices, { seed: 42 });
  assert.equal(world.getLocationByNodeId("core-vault")?.type, "cache");
  const [first, second] = run.getState().routeChoices;
  const target = world.getLocationByNodeId(first.id);
  const tracked = world.trackLocation(first.id);
  assert.equal(tracked.success, true);
  assert.ok(tracked.navigationTarget.directionLabel);
  assert.ok(tracked.navigationTarget.regionLabel);
  assert.ok(tracked.navigationTarget.priorityLabel);
  assert.ok(tracked.navigationTarget.distanceBand);
  assert.equal(typeof tracked.navigationTarget.distance, "number");

  assert.equal(world.engageLocation(first.id).success, true);
  assert.equal(world.getLocationByNodeId(second.id).state, "available");
  world.completeActiveLocation();
  assert.equal(world.getLocationByNodeId(first.id).state, "visited");
  assert.equal(world.trackLocation(first.id).success, true);
  assert.equal(world.engageLocation(first.id).revisited, true);
});
