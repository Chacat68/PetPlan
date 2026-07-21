import assert from "node:assert/strict";
import test from "node:test";

globalThis.Image = class ImageStub {
  set src(value) { this._src = value; }
  get src() { return this._src; }
};

const { CombatSystem } = await import("../js/modules/combat-system.js");
const { ExpeditionMetaSystem } = await import("../js/modules/expedition-meta-system.js");
const { ExpeditionRunSystem } = await import("../js/modules/expedition-run-system.js");

function createCombat(meta, { petGuard = 7 } = {}) {
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
  const combat = new CombatSystem({ random: () => 0.5 });
  combat.setPlayerSystem(playerSystem);
  combat.setResourceSystem({ addCoins() {}, addCrystals() {}, addRubies() {} });
  combat.setTerritorySystem({
    calculateBonuses() { return {}; },
    getPreparedBonuses() { return { attack: 0, defense: 0, supplies: 0, expBonus: 0 }; },
    consumePreparedBonuses() { return { attack: 0, defense: 0, supplies: 0, expBonus: 0 }; },
  });
  combat.setPetSystem({
    equippedPets: [],
    resetBattleStates() {},
    getCombatSupportSnapshot() { return { count: 0, members: [], guardCapacity: petGuard }; },
    awardExpeditionProgress() { return { totalGain: 0, pets: [] }; },
  });
  combat.setExpeditionMetaSystem(meta);
  combat.resetBattle();
  return { combat, playerSystem };
}

function depositAndFind(meta, item) {
  assert.equal(meta.depositItem({ stackable: false, sellPrice: 10, ...item }).success, true);
  return meta.getState().warehouse.find(entry => entry.name === item.name);
}

test("实际远征掉落包含可配装物，并能从仓库带入下一局产生效果", () => {
  const lootRun = new ExpeditionRunSystem({ random: () => 0.5 });
  lootRun.startRun();
  const generated = lootRun.generateLoot();
  assert.equal(generated.name, "完整机械芯");
  assert.equal(generated.equipSlot, "armor");
  assert.equal(generated.defenseBonus, 4);

  const meta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
  const armor = depositAndFind(meta, {
    name: "测试护甲芯", type: "component", equipSlot: "armor", defenseBonus: 6,
  });
  const linker = depositAndFind(meta, {
    name: "测试链接器", type: "crystal", equipSlot: "petLinker", guardBonus: 15,
  });
  const supply = depositAndFind(meta, {
    name: "测试补给", type: "pet-supply", equipSlot: "consumable", supplyValue: 2,
  });
  assert.equal(meta.equipItem(armor.instanceId).success, true);
  assert.equal(meta.equipItem(linker.instanceId).success, true);
  assert.equal(meta.equipItem(supply.instanceId, { consumableIndex: 0 }).success, true);

  const { combat } = createCombat(meta);
  assert.equal(combat.switchWeapon("shotgun").success, true);
  assert.equal(meta.getLoadout().mainWeapon.combatWeaponId, "shotgun");
  assert.equal(combat.startRun().success, true);

  const state = combat.getBattleState();
  assert.equal(state.supplies, 4, "基础 2 份补给加上配装提供的 2 份");
  assert.equal(combat.runPreparation.defense, 6);
  assert.equal(state.petGuard.maxHp, 22, "宠物基础护盾 7 加链接器 15");
  assert.equal(state.weapon.activeWeaponId, "shotgun");
  assert.equal(state.loadoutEffects.consumableSupplies, 2);
  assert.equal(meta.getLoadout().consumables[0], null, "装入行动的单份补给会在出发时消耗");
  assert.equal(meta.getState().activeRaid != null, true);

  combat.finishExpedition(false, "loadout-loss-test");
  const afterFailure = meta.getLoadout();
  assert.equal(afterFailure.armor, null);
  assert.equal(afterFailure.petLinker, null);
  assert.equal(afterFailure.mainWeapon.permanent, true);
});

test("基础武器模式会跨 Meta 存档保留，且远征中禁止改动局外仓库与合约", () => {
  const meta = new ExpeditionMetaSystem();
  assert.equal(meta.setWeaponMode("marksman").success, true);
  const sellable = depositAndFind(meta, { name: "待售组件", type: "component" });
  const offerId = meta.getState().contracts.board[0].offerId;
  assert.equal(meta.startRaid().success, true);
  assert.equal(meta.sellItem(sellable.instanceId).success, false);
  assert.equal(meta.acceptContract(offerId).success, false);
  assert.equal(meta.claimPendingDeliveries().success, false);

  const restored = new ExpeditionMetaSystem();
  assert.equal(restored.loadSaveData(meta.getSaveData()).success, true);
  assert.equal(restored.getLoadout().mainWeapon.combatWeaponId, "marksman");
});

test("仓库部分领取会明确标记 changed，供控制层立即持久化", () => {
  const meta = new ExpeditionMetaSystem({ warehouseCapacity: 4 });
  for (let index = 0; index < 6; index += 1) {
    meta.depositItem({
      name: `独立物品 ${index}`,
      type: "loot",
      stackable: false,
      sellPrice: 1,
    }, { allowPending: true });
  }
  assert.equal(meta.getState().warehouseUsed, 4);
  assert.equal(meta.getState().deliveryInbox.length, 2);
  const freed = meta.getState().warehouse[0];
  assert.equal(meta.withdrawItem(freed.instanceId).success, true);

  const result = meta.claimPendingDeliveries();
  assert.equal(result.success, false);
  assert.equal(result.changed, true);
  assert.equal(result.claimedCount, 1);
  assert.equal(meta.getState().warehouseUsed, 4);
  assert.equal(meta.getState().deliveryInbox.length, 1);
});

test("最终阶段调查补给事件会立即同步并解锁应急撤离点", () => {
  const meta = new ExpeditionMetaSystem();
  const { combat, playerSystem } = createCombat(meta);
  assert.equal(combat.startRun().success, true);
  combat.runSystem.depth = 5;
  combat.runSystem.phase = "extraction-ready";
  combat.runSystem.supplies = 0;
  combat.worldSystem.updateExtractionAvailability(combat.runSystem.getState());
  assert.equal(combat.worldSystem.getLocation("emergency-extraction").state, "locked");

  const event = combat.worldSystem.getState().locations.find(location => location.kind === "world-event");
  assert.ok(event);
  const mutable = combat.worldSystem.getLocation(event.id);
  mutable.type = "field-cache";
  mutable.effect = { supply: 1 };
  mutable.discovered = true;
  playerSystem.player.x = mutable.x - playerSystem.player.width / 2;
  playerSystem.player.y = mutable.y - playerSystem.player.height / 2;
  combat.updateWorldAwareness();

  const result = combat.interactWithNearbyLocation();
  assert.equal(result.success, true);
  assert.equal(combat.runSystem.supplies, 1);
  assert.equal(combat.worldSystem.getLocation("emergency-extraction").state, "unlocked");
});

test("带配装的活动局可按 Meta→Combat 顺序重启恢复并只结算一次", () => {
  const sourceMeta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
  const armor = depositAndFind(sourceMeta, {
    name: "存档护甲", type: "component", equipSlot: "armor", defenseBonus: 8,
  });
  const linker = depositAndFind(sourceMeta, {
    name: "存档链接器", type: "crystal", equipSlot: "petLinker", guardBonus: 12,
  });
  assert.equal(sourceMeta.equipItem(armor.instanceId).success, true);
  assert.equal(sourceMeta.equipItem(linker.instanceId).success, true);
  const { combat: sourceCombat } = createCombat(sourceMeta, { petGuard: 5 });
  assert.equal(sourceCombat.startRun().success, true);
  sourceCombat.weaponStates.rifle.magazine = 9;

  const metaSnapshot = JSON.parse(JSON.stringify(sourceMeta.getSaveData()));
  const combatSnapshot = JSON.parse(JSON.stringify(sourceCombat.getSaveData()));
  const restoredMeta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
  assert.equal(restoredMeta.loadSaveData(metaSnapshot).success, true);
  const { combat: restoredCombat } = createCombat(restoredMeta, { petGuard: 5 });
  restoredCombat.loadSaveData(combatSnapshot);

  const restoredState = restoredCombat.getBattleState();
  assert.equal(restoredCombat.runSystem.active, true);
  assert.equal(restoredCombat.runPreparation.defense, 8);
  assert.equal(restoredState.petGuard.maxHp, 17);
  assert.equal(restoredState.weapon.weapons.find(weapon => weapon.id === "rifle").magazine, 9);
  assert.equal(restoredMeta.getState().activeRaid?.raidId, sourceMeta.getState().activeRaid?.raidId);

  restoredCombat.runSystem.addLoot({
    id: "restored-loot",
    name: "恢复后战利品",
    type: "component",
    rarity: "common",
    score: 20,
  });
  const first = restoredCombat.finishExpedition(true, "restored-extraction");
  const second = restoredCombat.finishExpedition(true, "restored-extraction");
  assert.equal(first.metaSettlement.duplicate, false);
  assert.equal(second.metaSettlement.ledgerKey, first.metaSettlement.ledgerKey);
  assert.equal(restoredMeta.getState().warehouse.some(item => item.name === "恢复后战利品"), true);
  assert.equal(restoredMeta.getState().activeRaid, null);
});
