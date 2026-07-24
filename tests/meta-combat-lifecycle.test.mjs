import assert from "node:assert/strict";
import test from "node:test";

globalThis.Image = class ImageStub {
  set src(value) { this._src = value; }
  get src() { return this._src; }
};

const { CombatSystem } = await import("../js/modules/combat-system.js");
const { ExpeditionMetaSystem } = await import("../js/modules/expedition-meta-system.js");

function createCombat(metaSystem) {
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
  combat.setResourceSystem({ addCoins() {}, addCrystals() {}, addRubies() {} });
  combat.setTerritorySystem({ calculateBonuses() { return {}; } });
  combat.setPetSystem({
    equippedPets: [],
    resetBattleStates() {},
    awardExpeditionProgress() { return { totalGain: 0, pets: [] }; },
  });
  combat.setExpeditionMetaSystem(metaSystem);
  combat.resetBattle();
  return combat;
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
