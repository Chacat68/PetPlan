import assert from "node:assert/strict";
import test from "node:test";

import {
  ExpeditionRunSystem,
  SEARCH_PROFILES,
} from "../js/modules/expedition-run-system.js";

function loot(id, score) {
  return {
    id,
    name: id,
    rarity: "common",
    rarityLabel: "普通",
    type: "test",
    use: "测试",
    coins: score,
    crystals: 0,
    exp: 0,
    score,
  };
}

function forceNode(run, type, depth = 1) {
  run.active = true;
  run.phase = type === "camp" ? "camp" : ["search", "cache"].includes(type) ? "search" : "combat";
  run.currentNode = run.createNode(type, depth, 0);
  run.routeChoices = [];
}

test("搜索只保留快速与彻底两种策略，旧宠物模式映射为彻底搜刮", () => {
  const { quick, thorough } = SEARCH_PROFILES;
  assert.deepEqual(Object.keys(SEARCH_PROFILES), ["quick", "thorough"]);
  assert.equal(quick.durationSeconds, 2);
  assert.equal(quick.lootMin, 1);
  assert.equal(quick.lootMax, 1);
  assert.equal(quick.supplyCost, 0);
  assert.equal(thorough.lootMin, 2);
  assert.equal(thorough.lootMax, 3);
  assert.equal(thorough.supplyCost, 0);
  assert.equal(thorough.durationSeconds, 5);
  assert.equal(thorough.threat, 10);
  assert.equal(thorough.ambushChance, 0.2);
  assert.ok(thorough.threat > quick.threat);
  assert.ok(thorough.quality > quick.quality);

  const run = new ExpeditionRunSystem({ random: () => 0.99 });
  run.startRun({ supplies: 0 });
  const node = run.getState().routeChoices.find(entry => entry.type === "search");
  run.chooseNode(node.id);
  const legacyPet = run.resolveSearch("pet", { hasPet: false });
  assert.equal(legacyPet.success, true);
  assert.equal(legacyPet.searchProfile.id, "thorough");
  assert.equal(legacyPet.foundLoot.length, 3);
  assert.equal(run.getState().threat, 10);
  assert.deepEqual(Object.keys(run.getState().searchProfiles), ["quick", "thorough"]);
});

test("每个搜索地点只结算一次，彻底搜刮的产量高于快速搜索", () => {
  function searchPoi(type, mode, random = () => 0.99) {
    const run = new ExpeditionRunSystem({ random, backpackCapacity: 8 });
    run.startRun({ supplies: 8, backpackCapacity: 8 });
    forceNode(run, type, 1);
    const started = run.beginSearch(mode, {
      hasPet: true,
      containerId: `${type}-poi`,
      isLastContainer: false,
    });
    assert.equal(started.success, true);
    const completed = run.updateSearch(started.search.durationMs);
    assert.equal(completed.success, true);
    assert.equal(completed.ambushed, false);
    assert.equal(completed.nodeCompleted, true);
    assert.equal(run.getState().phase, "route");
    assert.equal(run.beginSearch(mode, { containerId: `${type}-legacy-second` }).success, false);
    return run;
  }

  const quickSearch = searchPoi("search", "quick");
  const thoroughSearch = searchPoi("search", "thorough");
  const thoroughCache = searchPoi("cache", "thorough");

  assert.equal(quickSearch.backpack.length, 1);
  assert.equal(thoroughSearch.backpack.length, 3);
  assert.equal(thoroughCache.backpack.length, 3);
  assert.ok(
    thoroughSearch.getBackpackRewards().score > quickSearch.getBackpackRewards().score,
    "仔细搜刮应以更久读条和更高警戒换取更多价值",
  );
});

test("营地休整支付补给，直接离开保留资源并给予先手", () => {
  const restRun = new ExpeditionRunSystem({ random: () => 0.2 });
  restRun.startRun({ supplies: 2 });
  restRun.threat = 60;
  forceNode(restRun, "camp", 2);
  const rest = restRun.restAtCamp();
  assert.equal(rest.success, true);
  assert.equal(rest.supplyCost, 1);
  assert.equal(restRun.supplies, 1);
  assert.ok(rest.healRatio >= 0.4);
  assert.ok(restRun.threat < 60);

  const leaveRun = new ExpeditionRunSystem({ random: () => 0.2 });
  leaveRun.startRun({ supplies: 2 });
  forceNode(leaveRun, "camp", 2);
  const leave = leaveRun.leaveCamp();
  assert.equal(leave.success, true);
  assert.equal(leaveRun.supplies, 2);
  assert.equal(leaveRun.getState().stealthCharges, 1);
  forceNode(leaveRun, "combat", 3);
  const encounter = leaveRun.getEncounterSpec("combat");
  assert.equal(encounter.playerAdvantage.label, "隐蔽先手");
});

test("警戒严格封顶 100，不再生成独立超限压力", () => {
  const low = new ExpeditionRunSystem({ random: () => 0.1 });
  low.startRun();
  forceNode(low, "combat", 2);
  const lowResult = low.completeCombat({ coins: 100, exp: 100, kills: 2 }, { lootCount: 0 });

  const high = new ExpeditionRunSystem({ random: () => 0.1 });
  high.startRun();
  high.addThreat(130);
  forceNode(high, "combat", 2);
  const highSpec = high.getEncounterSpec("combat");
  const highResult = high.completeCombat({ coins: 100, exp: 100, kills: 2 }, { lootCount: 0 });
  assert.ok(highResult.rewardMultiplier > lowResult.rewardMultiplier);
  assert.ok(high.getState().pendingRewards.coins > low.getState().pendingRewards.coins);
  assert.equal(high.getState().threat, 100);
  assert.equal(high.getState().overpressure, 0);
  assert.equal(high.overpressure, 0);
  assert.ok(highSpec.eliteCount > 0);
  assert.equal(high.getState().threatPreview.nextThreshold, null);
  assert.equal(high.getState().threatPreview.threatToNext, 0);
});

test("满背包的新战利品自动替换最低价值未保护物", () => {
  const run = new ExpeditionRunSystem({ backpackCapacity: 3 });
  run.startRun({ backpackCapacity: 3 });
  run.addLoot(loot("a", 10));
  run.addLoot(loot("b", 20));
  run.addLoot(loot("c", 30));
  assert.equal(run.protectLoot("a").success, true);
  const overflow = run.addLoot(loot("incoming", 99), { requireDecision: true, source: "test" });
  assert.equal(overflow.kept, true);
  assert.equal(overflow.autoReplaced, true);
  assert.equal(overflow.discarded.id, "b", "受保护的最低价值物不能被替换");
  assert.deepEqual(run.backpack.map(item => item.id), ["a", "incoming", "c"]);
  assert.equal(run.getState().pendingLootChoice, null);
  assert.deepEqual(run.getState().lootOverflowQueue, []);

  const lowValue = run.addLoot(loot("scrap", 5), { requireDecision: true, source: "test" });
  assert.equal(lowValue.kept, false);
  assert.equal(lowValue.autoDiscarded, true);
  assert.equal(lowValue.discarded.id, "scrap");
});

test("深层精英产出专属材料，结算暴露长期统计字段", () => {
  const run = new ExpeditionRunSystem({ random: () => 0.8, maxDepth: 8 });
  run.startRun();
  run.depth = 4;
  forceNode(run, "elite", 5);
  const combat = run.completeCombat({ coins: 50, exp: 30, kills: 1 }, { lootCount: 0 });
  assert.ok(combat.foundLoot.some(item => item.type === "deep-material"));
  const settlement = run.finishRun({ extracted: true });
  assert.equal(settlement.extractedDepth, 5);
  assert.equal(settlement.reachedDepth, 5);
  assert.ok(settlement.value > 0);
  assert.ok("rubyReward" in settlement);
  assert.ok("contractFragments" in settlement);
  assert.ok("bossDefeated" in settlement);
});

test("活动局可保存恢复随机序列，旧待选物品保留但队列自动收敛", () => {
  const source = new ExpeditionRunSystem({ seed: 20260721, backpackCapacity: 3 });
  source.startRun({ seed: 20260721, backpackCapacity: 3 });
  source.addLoot(loot("a", 10));
  source.addLoot(loot("b", 20));
  source.addLoot(loot("c", 30));
  source.resolveWorldEvent({
    supply: 2,
    threatDelta: 35,
    insurance: 1,
    stealth: 1,
    returnPressureReduction: 3,
    lootCount: 1,
    lootQuality: 2,
  });
  assert.equal(source.getState().pendingLootChoice, null);
  assert.deepEqual(source.getState().lootOverflowQueue, []);
  const save = JSON.parse(JSON.stringify(source.getRunSaveData()));
  save.state.pendingLootChoice = {
    id: "legacy-pending",
    incoming: loot("legacy-manual", 80),
    source: "legacy-save",
    replaceOptions: [],
  };
  save.state.lootOverflowQueue = [{
    id: "legacy-queued",
    incoming: loot("legacy-auto", 70),
    source: "legacy-save",
    replaceOptions: [],
  }];
  save.state.overpressure = 30;

  const restored = new ExpeditionRunSystem({ seed: 1 });
  const loaded = restored.loadRunSaveData(save);
  assert.equal(loaded.success, true);
  assert.equal(restored.getState().threat, Math.min(100, source.getState().threat + 30));
  assert.equal(restored.getState().overpressure, 0);
  assert.equal(restored.getState().supplies, source.getState().supplies);
  assert.equal(restored.getState().insuredSlotCount, source.getState().insuredSlotCount);
  assert.equal(restored.getState().pendingLootChoice.id, "legacy-pending");
  assert.deepEqual(restored.getState().lootOverflowQueue, []);
  assert.equal(restored.resolveLootChoice("discard").success, true);
  assert.equal(restored.getState().pendingLootChoice, null);
});

test("主动止损的保底高于战败且保险物仍可带回", () => {
  function settle(reason) {
    const run = new ExpeditionRunSystem();
    run.startRun();
    run.addPendingRewards({ coins: 100, exp: 100, kills: 2 });
    run.addLoot(loot("insured", 20));
    run.protectLoot("insured");
    return run.finishRun({ extracted: false, reason });
  }
  const abandoned = settle("abandoned");
  const defeated = settle("defeated");
  assert.equal(abandoned.coins, 30);
  assert.equal(abandoned.exp, 40);
  assert.equal(defeated.coins, 10);
  assert.equal(defeated.exp, 20);
  assert.ok(abandoned.coins > defeated.coins);
  assert.ok(abandoned.exp > defeated.exp);
  assert.equal(abandoned.abandonmentPenalty, true);
  assert.equal(abandoned.insuredLootRecovered, 1);
});
