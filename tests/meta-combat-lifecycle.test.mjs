import assert from "node:assert/strict";
import test from "node:test";

globalThis.Image = class ImageStub {
  set src(value) { this._src = value; }
  get src() { return this._src; }
};

const { CombatSystem } = await import("../js/modules/combat-system.js");
const { ExpeditionMetaSystem } = await import("../js/modules/expedition-meta-system.js");
const { TerritorySystem } = await import("../js/modules/territory-system.js");
const { FIRST_EXTRACTION_BONUS } = await import("../js/modules/progression-config.js");

function createCombat(metaSystem, { resourceSystem = null, territorySystem = null } = {}) {
  const playerSystem = {
    player: {
      x: 0, y: 0, width: 40, height: 40,
      level: 1, maxHp: 100, attack: 20, defense: 0,
      hpRegen: 0, attackSpeed: 1, crit: 0, critDamage: 150, multiShot: 1,
    },
    addExperience() {},
    playAttackAnimation() {},
    setCombatState() {},
  };
  const combat = new CombatSystem({ random: () => 0.5, runOptions: { minExtractionDepth: 1 } });
  combat.setPlayerSystem(playerSystem);
  combat.setResourceSystem(resourceSystem || { addCoins() {}, addCrystals() {}, addRubies() {} });
  combat.setTerritorySystem(territorySystem || { calculateBonuses() { return {}; } });
  combat.setPetSystem({
    equippedPets: [],
    resetBattleStates() {},
    awardExpeditionProgress() { return { totalGain: 0, pets: [] }; },
  });
  combat.setExpeditionMetaSystem(metaSystem);
  combat.resetBattle();
  return combat;
}

function createLowResourceWallet() {
  return {
    coins: 500,
    crystals: 100,
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
    addRubies() {},
  };
}

function loot(id) {
  return {
    id,
    name: `组件 ${id}`,
    type: "component",
    rarity: "common",
    coins: 25,
    crystals: 0,
    exp: 5,
    score: 30,
  };
}

function unlockInvestigationContract(meta) {
  const main = meta.acceptContract("main-supply-recovery");
  assert.equal(main.success, true);
  meta.depositItems([loot("quest-a"), loot("quest-b"), loot("quest-c")]);
  assert.equal(meta.turnInContract(main.contract.contractId).success, true);
  assert.equal(meta.acceptContract("main-investigate-vault").success, true);
}

test("跨重启连续远征使用持久 Meta raidId，结算不会因 runId 重置而误判重复", () => {
  const firstMeta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
  const firstCombat = createCombat(firstMeta);
  assert.equal(firstCombat.startRun().success, true);
  firstCombat.runSystem.addLoot(loot("first"));
  const firstSettlement = firstCombat.finishExpedition(true, "test-extracted");
  assert.equal(firstSettlement.metaSettlement.duplicate, false);
  assert.equal(firstSettlement.metaSettlement.ledgerKey, "settlement:meta-raid-1");
  assert.equal(firstMeta.getState().warehouseUsed, 1);
  assert.equal(firstMeta.getState().activeRaid, null);

  const restoredMeta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
  assert.equal(restoredMeta.loadSaveData(firstMeta.getSaveData()).success, true);
  const secondCombat = createCombat(restoredMeta);
  assert.equal(secondCombat.startRun().success, true);
  secondCombat.runSystem.addLoot(loot("second"));
  const secondSettlement = secondCombat.finishExpedition(true, "test-extracted");
  assert.equal(secondSettlement.runId, 1, "Combat runId 在新实例中会重新从 1 开始");
  assert.equal(secondSettlement.metaSettlement.duplicate, false);
  assert.equal(secondSettlement.metaSettlement.ledgerKey, "settlement:meta-raid-2");
  assert.equal(restoredMeta.getState().warehouseUsed, 2);
  assert.equal(restoredMeta.getState().activeRaid, null);
});

test("实际远征结算会推进精英击杀与仓库调查合约", () => {
  const meta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
  unlockInvestigationContract(meta);
  assert.equal(meta.acceptContract("side-elite-hunt").success, true);
  const combat = createCombat(meta);
  assert.equal(combat.startRun().success, true);
  combat.worldSystem.locations.set("test-cache", {
    id: "test-cache",
    nodeId: "core-vault",
    kind: "route",
    type: "cache",
    state: "cleared",
    name: "测试仓库",
    x: 800,
    y: 800,
    radius: 40,
  });
  for (let index = 0; index < 3; index += 1) {
    const monster = {
      id: index + 1,
      name: "精英巡逻兵",
      x: 0,
      y: 0,
      width: 30,
      height: 30,
      isElite: true,
      rewardGranted: false,
      coinReward: 0,
      crystalReward: 0,
      expReward: 0,
    };
    combat.onMonsterKilled(monster);
  }
  combat.finishExpedition(true, "contract-test");
  const contracts = meta.getState().contracts.active;
  assert.equal(contracts.find(contract => contract.templateId === "side-elite-hunt").status, "ready");
  assert.equal(contracts.find(contract => contract.templateId === "main-investigate-vault").status, "ready");
});

test("低资源新档首次成功撤离后可升至 R2，并立即获得新设施下一步", () => {
  const resources = createLowResourceWallet();
  const territory = new TerritorySystem(resources, null);
  territory.setOnPersist(() => {});
  assert.equal(territory.buildBuilding("main_base", 0).success, true);

  // 300 金币代表首次远征前由命运、教学成就或常规活动取得的低门槛收入。
  resources.addCoins(300);
  assert.equal(territory.buildBuilding("training_ground", 1).success, true);
  assert.equal(territory.buildBuilding("temple", 2).success, true);
  assert.deepEqual(
    { coins: resources.coins, crystals: resources.crystals, constructionScore: territory.getConstructionScore() },
    { coins: 0, crystals: 40, constructionScore: 2 }
  );

  const beforeExtraction = territory.getProgressSummary().nextGoal;
  assert.match(beforeExtraction.detail, /成功撤离 0\/1（差1）/);
  assert.match(beforeExtraction.detail, /建设度 2\/2（完成）/);
  assert.match(beforeExtraction.detail, /金币 0\/700（差700）/);
  assert.match(beforeExtraction.detail, /水晶 40\/100（差60）/);

  const meta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
  const combat = createCombat(meta, { resourceSystem: resources, territorySystem: territory });
  assert.equal(combat.startRun().success, true);
  const settlement = combat.finishExpedition(true, "first-low-resource-extraction");
  assert.deepEqual(settlement.firstExtractionBonus, FIRST_EXTRACTION_BONUS);
  assert.equal(resources.coins, FIRST_EXTRACTION_BONUS.coins);
  assert.equal(resources.crystals, 40 + FIRST_EXTRACTION_BONUS.crystals);

  territory.setProgressContext({
    extractions: combat.meta.extractions,
    bestExtractedDepth: combat.meta.bestExtractedDepth,
  });
  assert.equal(territory.canExpand().success, true);
  const promotion = territory.expandTerritory();
  assert.equal(promotion.success, true);
  assert.equal(promotion.rank, 2);
  assert.deepEqual(promotion.promotionReward, { coins: 400, crystals: 30 });
  assert.deepEqual(
    { coins: resources.coins, crystals: resources.crystals },
    { coins: 400, crystals: 50 }
  );
  assert.match(promotion.message, /升级闪耀训练馆或萌宠疗愈庭/);

  const r2Goal = territory.getProgressSummary().nextGoal;
  assert.equal(r2Goal.kind, "upgrade");
  assert.equal(r2Goal.buildingType, "training_ground");
  assert.match(r2Goal.detail, /星光特训屋蓝图解锁/);

  assert.equal(combat.startRun().success, true);
  const repeatSettlement = combat.finishExpedition(true, "repeat-extraction");
  assert.equal(repeatSettlement.firstExtractionBonus, undefined);
  assert.equal(resources.coins, 400, "首次撤离奖励不能重复领取");
  assert.equal(resources.crystals, 50, "首次撤离水晶奖励不能重复领取");
});
