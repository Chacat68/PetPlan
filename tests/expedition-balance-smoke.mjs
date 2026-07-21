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

test("三种搜索方式分别服务速度、产量和品质", () => {
  const { quick, thorough, pet } = SEARCH_PROFILES;
  assert.ok(quick.durationSeconds < pet.durationSeconds);
  assert.ok(quick.threat < pet.threat);
  assert.equal(quick.supplyCost, 0);
  assert.ok(thorough.lootMax > pet.lootMax);
  assert.equal(thorough.supplyCost, 1);
  assert.equal(thorough.durationSeconds, 8);
  assert.equal(thorough.threat, 10);
  assert.equal(thorough.ambushChance, 0.2);
  assert.ok(pet.quality > quick.quality);
  assert.equal(pet.requiresPet, true);

  const run = new ExpeditionRunSystem({ random: () => 0.99 });
  run.startRun({ supplies: 0 });
  const node = run.getState().routeChoices.find(entry => entry.type === "search");
  run.chooseNode(node.id);
  const unavailable = run.resolveSearch("thorough");
  assert.equal(unavailable.success, false, "仔细搜刮必须真实支付补给");
  assert.equal(run.resolveSearch("quick").success, true, "快速搜索应是无补给时的低风险选项");
  assert.equal(run.getState().searchMetrics.timeSeconds, quick.durationSeconds);
  assert.equal(run.getState().searchProfiles.pet.role, pet.role);
});

test("多容器搜索按地点预算控制总产量，仔细搜刮价值高于宠物侦察", () => {
  function searchContainers(type, mode, count, random = () => 0.99) {
    const run = new ExpeditionRunSystem({ random, backpackCapacity: 8 });
    run.startRun({ supplies: 8, backpackCapacity: 8 });
    forceNode(run, type, 1);
    for (let index = 0; index < count; index += 1) {
      const started = run.beginSearch(mode, {
        hasPet: true,
        containerId: `${type}-${index + 1}`,
        isLastContainer: index === count - 1,
      });
      assert.equal(started.success, true);
      const completed = run.updateSearch(started.search.durationMs);
      assert.equal(completed.success, true);
      assert.equal(completed.ambushed, false);
    }
    return run;
  }

  const thoroughSearch = searchContainers("search", "thorough", 2);
  const petSearch = searchContainers("search", "pet", 2);
  const thoroughCache = searchContainers("cache", "thorough", 3);
  const petCache = searchContainers("cache", "pet", 3);

  assert.equal(thoroughSearch.backpack.length, 4, "普通点仔细搜刮最多产出 4 件");
  assert.equal(petSearch.backpack.length, 2, "普通点宠物侦察稳定产出 2 件");
  assert.equal(thoroughCache.backpack.length, 5, "密封仓库仔细搜刮最多产出 5 件");
  assert.equal(petCache.backpack.length, 3, "密封仓库宠物侦察稳定产出 3 件");
  assert.ok(
    thoroughSearch.getBackpackRewards().score > petSearch.getBackpackRewards().score,
    "相同品质下，仔细搜刮应以更多物品换取更高期望价值",
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

test("高威胁和超限压力同时提高收益与遭遇压力", () => {
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
  assert.ok(high.getState().overpressure >= 30);
  assert.ok(highSpec.eliteCount > 0);
  assert.equal(high.getState().threatPreview.nextThreshold, null);
});

test("满背包的新战利品等待玩家手动替换，并支持保险格", () => {
  const run = new ExpeditionRunSystem({ backpackCapacity: 3 });
  run.startRun({ backpackCapacity: 3 });
  run.addLoot(loot("a", 10));
  run.addLoot(loot("b", 20));
  run.addLoot(loot("c", 30));
  const overflow = run.addLoot(loot("incoming", 99), { requireDecision: true, source: "test" });
  assert.equal(overflow.pending, true);
  assert.deepEqual(run.backpack.map(item => item.id), ["a", "b", "c"]);
  assert.equal(run.getState().pendingLootChoice.incoming.id, "incoming");

  assert.equal(run.protectLoot("b").success, true);
  assert.equal(run.resolveLootChoice({ action: "replace", replaceItemId: "b" }).success, false);
  const decision = run.resolveLootChoice({ action: "replace", replaceItemId: "a" });
  assert.equal(decision.success, true);
  assert.equal(decision.kept, true);
  assert.deepEqual(run.backpack.map(item => item.id), ["incoming", "b", "c"]);
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

test("活动局可保存恢复随机序列、世界事件与待选战利品", () => {
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
  assert.ok(source.getState().pendingLootChoice);
  const save = JSON.parse(JSON.stringify(source.getRunSaveData()));

  const restored = new ExpeditionRunSystem({ seed: 1 });
  const loaded = restored.loadRunSaveData(save);
  assert.equal(loaded.success, true);
  assert.equal(restored.getState().threat, source.getState().threat);
  assert.equal(restored.getState().supplies, source.getState().supplies);
  assert.equal(restored.getState().insuredSlotCount, source.getState().insuredSlotCount);
  assert.deepEqual(restored.getState().pendingLootChoice, source.getState().pendingLootChoice);
  assert.deepEqual(restored.generateLoot(1), source.generateLoot(1), "恢复后随机序列应连续一致");
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
