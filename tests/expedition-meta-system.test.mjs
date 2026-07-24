import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPEDITION_CONTRACT_TEMPLATES,
  EXPEDITION_META_SAVE_VERSION,
  ExpeditionMetaSystem,
} from "../js/modules/expedition-meta-system.js";

function loot(id, overrides = {}) {
  return {
    id,
    name: id,
    type: "component",
    rarity: "common",
    score: 30,
    coins: 20,
    ...overrides,
  };
}

function equipment(id, type, equipSlot, overrides = {}) {
  return {
    id,
    templateId: id,
    name: id,
    type,
    equipSlot,
    score: 100,
    sellPrice: 50,
    ...overrides,
  };
}

function ensureOffer(meta, templateId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const offer = meta.getContractState().board.find(entry => entry.templateId === templateId);
    if (offer) return offer;
    meta.refreshContractBoard();
  }
  throw new Error(`委托板未出现模板 ${templateId}`);
}

function accept(meta, templateId, options = {}) {
  const offer = ensureOffer(meta, templateId);
  return meta.acceptContract(offer.offerId, options);
}

function unlockInvestigationContract(meta) {
  const first = accept(meta, "main-supply-recovery");
  meta.depositItems([
    loot("chain-part-a"),
    loot("chain-part-b"),
    loot("chain-part-c"),
  ]);
  assert.equal(meta.turnInContract(first.contract.contractId).success, true);
  return accept(meta, "main-investigate-vault");
}

test("默认配装始终包含不可丢失基础武器和四个消耗品槽", () => {
  const meta = new ExpeditionMetaSystem();
  const loadout = meta.getLoadout();
  assert.equal(loadout.mainWeapon.templateId, "starter-carbine");
  assert.equal(loadout.mainWeapon.combatWeaponId, "rifle");
  assert.equal(loadout.mainWeapon.permanent, true);
  assert.equal(loadout.mainWeapon.sellPrice, 0);
  assert.deepEqual(loadout.consumables, [null, null, null, null]);
  assert.equal(meta.depositItem(loadout.mainWeapon).success, false);
  assert.equal(meta.unequipItem("mainWeapon").success, false);
});

test("局外奖励可原子取走并清零，便于转入现有资源与玩家系统", () => {
  const meta = new ExpeditionMetaSystem();
  meta.depositItem(loot("sale-target", { sellPrice: 45 }));
  meta.sellItem(meta.getState().warehouse[0].instanceId);
  assert.deepEqual(meta.claimBalances(), { coins: 45, crystals: 0, rubies: 0, exp: 0 });
  assert.deepEqual(meta.drainBalances(), { coins: 0, crystals: 0, rubies: 0, exp: 0 });
  assert.deepEqual(meta.getState().balances, { coins: 0, crystals: 0, rubies: 0, exp: 0 });
});

test("仓库按 ItemInstance 持久存放，支持容量、堆叠、取出和出售", () => {
  const meta = new ExpeditionMetaSystem({ warehouseCapacity: 4 });
  const fragments = meta.depositItem({ templateId: "contract-fragment", quantity: 7 });
  assert.equal(fragments.success, true);
  assert.equal(meta.getState().warehouseUsed, 1);
  assert.equal(meta.getItemCount({ templateId: "contract-fragment" }), 7);

  meta.depositItem(loot("a"));
  meta.depositItem(loot("b"));
  meta.depositItem(loot("c"));
  const rejected = meta.depositItem(loot("overflow"));
  assert.equal(rejected.success, false);
  assert.equal(meta.getState().warehouseUsed, 4);

  const stack = meta.getState().warehouse.find(item => item.templateId === "contract-fragment");
  const split = meta.withdrawItem(stack.instanceId, { quantity: 2 });
  assert.equal(split.success, true);
  assert.equal(split.item.quantity, 2);
  assert.equal(meta.getItemCount({ templateId: "contract-fragment" }), 5);

  const saleItem = meta.getState().warehouse.find(item => item.originId === "a");
  const sold = meta.sellItem(saleItem.instanceId);
  assert.equal(sold.success, true);
  assert.equal(sold.coins, 20);
  assert.equal(meta.getState().balances.coins, 20);
});

test("装备可承担失败风险，保险保留装备且主武器永远回退到基础武器", () => {
  const meta = new ExpeditionMetaSystem();
  meta.depositItems([
    equipment("field-rifle", "weapon", "mainWeapon"),
    equipment("field-armor", "armor", "armor"),
    equipment("pet-linker-a", "pet-linker", "petLinker"),
    equipment("medkit", "consumable", "consumable", { quantity: 2, stackable: true }),
  ]);
  const state = meta.getState();
  const byTemplate = id => state.warehouse.find(item => item.templateId === id).instanceId;
  meta.equipItem(byTemplate("field-rifle"));
  meta.equipItem(byTemplate("field-armor"));
  meta.equipItem(byTemplate("pet-linker-a"));
  meta.equipItem(byTemplate("medkit"), { consumableIndex: 2 });
  const armorId = meta.getLoadout().armor.instanceId;
  assert.equal(meta.startRaid({ raidId: "loss-test", insuredLoadoutIds: [armorId] }).success, true);
  assert.equal(meta.markConsumableUsed(2, 1).remaining, 1);

  const result = meta.applySettlement({
    settlement: { runId: "loss-test", extracted: false, reason: "defeated" },
    loot: [],
  });
  assert.equal(result.success, true);
  assert.equal(meta.getLoadout().mainWeapon.templateId, "starter-carbine");
  assert.equal(meta.getLoadout().armor.instanceId, armorId);
  assert.equal(meta.getLoadout().petLinker, null);
  assert.equal(meta.getLoadout().consumables[2], null);
  assert.equal(result.loadoutLost.length, 3);
});

test("成功结算接收全部 loot 且账本保证同一局只处理一次", () => {
  const meta = new ExpeditionMetaSystem({ creditSettlementCurrency: true });
  const settlement = {
    runId: 42,
    extracted: true,
    coins: 100,
    crystals: 2,
    exp: 30,
    rubyReward: 1,
    threat: 80,
  };
  const first = meta.applySettlement({ settlement, loot: [loot("one"), loot("two")] });
  assert.equal(first.recoveredCount, 2);
  assert.equal(first.duplicate, false);
  assert.deepEqual(meta.getState().balances, { coins: 100, crystals: 2, rubies: 1, exp: 30 });

  const second = meta.applySettlement({ settlement, loot: [loot("one"), loot("two")] });
  assert.equal(second.duplicate, true);
  assert.equal(meta.getState().warehouse.length, 2);
  assert.deepEqual(meta.getState().balances, { coins: 100, crystals: 2, rubies: 1, exp: 30 });
});

test("默认不重复结算旧系统货币，失败只回收显式保险或安全物品", () => {
  const meta = new ExpeditionMetaSystem();
  const result = meta.applySettlement({
    settlement: { runId: "failed-1", extracted: false, coins: 999, crystals: 99 },
    loot: [
      loot("insured", { insured: true }),
      loot("lost"),
      loot("secure", { keepOnFailure: true }),
    ],
  });
  assert.equal(result.recoveredCount, 2);
  assert.equal(result.lostCount, 1);
  assert.deepEqual(meta.getState().warehouse.map(item => item.originId).sort(), ["insured", "secure"]);
  assert.deepEqual(meta.getState().balances, { coins: 0, crystals: 0, rubies: 0, exp: 0 });
});

test("远征结算不会因仓库已满而吞掉战利品，溢出物进入待领取箱", () => {
  const meta = new ExpeditionMetaSystem({ warehouseCapacity: 4 });
  meta.depositItems([loot("a"), loot("b"), loot("c"), loot("d")]);
  const result = meta.applySettlement({
    settlement: { runId: "full-stash", extracted: true },
    loot: [loot("e"), loot("f")],
  });
  assert.equal(result.storedCount, 0);
  assert.equal(result.pendingCount, 2);
  assert.equal(meta.getState().deliveryInbox.length, 2);

  meta.sellItem(meta.getState().warehouse[0].instanceId);
  const claim = meta.claimPendingDeliveries();
  assert.equal(claim.remaining, 1);
  assert.equal(meta.getState().warehouse.length, 4);
});

test("主线按一次性短链开放，合约槽严格限制为一条主线和两条支线", () => {
  const meta = new ExpeditionMetaSystem();
  assert.equal(accept(meta, "main-supply-recovery").success, true);
  assert.equal(meta.getContractState().board.some(entry => entry.templateId === "main-investigate-vault"), false);
  assert.match(meta.acceptContract("main-investigate-vault").message, /不在委托板/);
  assert.equal(accept(meta, "side-elite-hunt").success, true);
  assert.equal(accept(meta, "side-pet-extraction", { petId: "pet-1" }).success, true);
  assert.match(accept(meta, "side-high-threat-extraction").message, /支线合约槽已满/);
  assert.deepEqual(meta.getContractState().slots, { main: 1, mainMax: 1, side: 2, sideMax: 2 });
});

test("带回物资合约按仓库实时库存推进，交付扣除物资并发放奖励", () => {
  const meta = new ExpeditionMetaSystem();
  const accepted = accept(meta, "main-supply-recovery");
  meta.depositItems([loot("part-a"), loot("part-b"), loot("part-c")]);
  const ready = meta.getContractState().active.find(contract => contract.contractId === accepted.contract.contractId);
  assert.equal(ready.status, "ready");
  assert.equal(ready.progress, 3);

  const delivered = meta.turnInContract(ready.contractId);
  assert.equal(delivered.success, true);
  assert.equal(meta.getItemCount({ type: "component" }), 0);
  assert.equal(meta.getItemCount({ templateId: "contract-fragment" }), 2);
  assert.equal(meta.getState().balances.coins, 320);
  assert.equal(meta.getState().stats.contractsCompleted, 1);
});

test("调查、精英击杀、指定宠物和高威胁撤离事件均可独立推进", () => {
  const investigation = new ExpeditionMetaSystem();
  const investigateContract = unlockInvestigationContract(investigation).contract;
  investigation.recordContractEvent({ type: "location-investigated", locationId: "wrong-place", locationType: "cache" });
  assert.equal(investigation.getContractState().active[0].progress, 0);
  investigation.recordContractEvent({ type: "location-investigated", locationId: "core-vault", locationType: "combat" });
  assert.equal(investigation.getContractState().active[0].progress, 0);
  investigation.recordContractEvent({ type: "location-investigated", locationId: "core-vault", locationType: "cache" });
  assert.equal(investigation.getContractState().active[0].status, "ready");
  assert.equal(investigation.turnInContract(investigateContract.contractId).success, true);

  const combat = new ExpeditionMetaSystem();
  const elite = accept(combat, "side-elite-hunt").contract;
  const pet = accept(combat, "side-pet-extraction", { petId: "pet-wolf", petName: "小狼" }).contract;
  combat.recordContractEvent({ type: "elite-killed", count: 3 });
  combat.recordContractEvent({ type: "extraction", extracted: true, threat: 20, petIds: ["pet-wolf"] });
  const active = combat.getContractState().active;
  assert.equal(active.find(contract => contract.contractId === elite.contractId).status, "ready");
  assert.equal(active.find(contract => contract.contractId === pet.contractId).status, "ready");

  const pressure = new ExpeditionMetaSystem();
  const highThreat = accept(pressure, "side-high-threat-extraction").contract;
  pressure.recordContractEvent({ type: "extraction", extracted: true, threat: 74 });
  assert.equal(pressure.getContractState().active[0].progress, 0);
  pressure.recordContractEvent({ type: "extraction", extracted: true, threat: 75 });
  assert.equal(pressure.getContractState().active.find(entry => entry.contractId === highThreat.contractId).status, "ready");
});

test("applySettlement 可用 runStats 一次更新精英、探索和撤离合约", () => {
  const meta = new ExpeditionMetaSystem();
  unlockInvestigationContract(meta);
  accept(meta, "side-elite-hunt");
  accept(meta, "side-pet-extraction", { petId: "pet-cat" });
  const result = meta.applySettlement({
    settlement: { runId: "contracts", extracted: true, threat: 90 },
    loot: [],
    runStats: {
      eliteKills: 3,
      investigatedLocations: [{ id: "core-vault", type: "cache" }],
      petIds: ["pet-cat"],
    },
  });
  assert.equal(result.contractUpdates.length, 3);
  assert.ok(meta.getContractState().active.every(contract => contract.status === "ready"));
});

test("现有掉落统一映射为五类真实物资，工坊配方会原子消耗仓库材料", () => {
  const meta = new ExpeditionMetaSystem({ warehouseCapacity: 80 });
  assert.equal(meta.createItem({ name: "轻型护甲片", type: "equipment" }).purposeCategory, "equipment");
  assert.equal(meta.createItem({ name: "完整机械芯", type: "component", equipSlot: "armor" }).purposeCategory, "equipment");
  assert.equal(meta.createItem({ name: "封锁区通行证", type: "quest-material" }).purposeCategory, "intel");
  assert.equal(meta.createItem({ name: "旧铜线束", type: "valuable" }).purposeCategory, "valuables");
  meta.depositItems([
    ...Array.from({ length: 5 }, (_, index) => loot(`mechanical-${index}`)),
    loot("medical-a", { type: "medical" }),
    loot("medical-b", { type: "medical" }),
    loot("pet-a", { type: "pet-material" }),
    loot("intel-a", { type: "intel" }),
    loot("intel-b", { type: "intel" }),
    loot("core-a", { type: "deep-material" }),
  ]);

  assert.deepEqual(meta.getState().crafting.materialCounts, {
    mechanical: 5,
    medical: 2,
    intel: 2,
    pet: 1,
    core: 1,
  });
  assert.equal(meta.getCraftingRecipes().length, 4);
  assert.equal(meta.craftRecipe("field-ammo-pack").success, true);
  assert.equal(meta.craftRecipe("field-ration").success, true);
  assert.equal(meta.craftRecipe("insurance-voucher").success, true);
  assert.equal(meta.craftRecipe("field-armor").success, true);
  assert.equal(meta.getItemCount({ templateId: "field-ammo-pack" }), 1);
  assert.equal(meta.getItemCount({ templateId: "field-ration" }), 1);
  assert.equal(meta.getItemCount({ templateId: "insurance-voucher" }), 1);
  assert.equal(meta.getItemCount({ templateId: "field-armor" }), 1);
  const ammoPack = meta.getState().warehouse.find(item => item.templateId === "field-ammo-pack");
  assert.equal(meta.equipItem(ammoPack.instanceId, { consumableIndex: 0 }).success, true);
  assert.equal(meta.getLoadout().consumables[0].ammoPackValue, 1);
  assert.deepEqual(meta.getState().crafting.materialCounts, {
    mechanical: 0,
    medical: 0,
    intel: 0,
    pet: 0,
    core: 0,
  });
});

test("仓库、行动背包和安全袋可用真实物资升级并持久化", () => {
  const meta = new ExpeditionMetaSystem({ warehouseCapacity: 40 });
  meta.depositItems([
    ...Array.from({ length: 7 }, (_, index) => loot(`facility-mechanical-${index}`)),
    loot("facility-medical-a", { type: "medical" }),
    loot("facility-medical-b", { type: "medical" }),
    ...Array.from({ length: 4 }, (_, index) => loot(`facility-intel-${index}`, { type: "intel" })),
    loot("facility-core", { type: "deep-material" }),
  ]);

  assert.equal(meta.upgradeFacility("warehouse").success, true);
  assert.equal(meta.upgradeFacility("backpack").success, true);
  assert.equal(meta.upgradeFacility("safetyBag").success, true);
  assert.deepEqual(meta.getCapacityState(), {
    warehouseCapacity: 48,
    backpackCapacity: 9,
    safetyBagCapacity: 2,
    levels: { warehouse: 1, backpack: 1, safetyBag: 1 },
  });
  assert.equal(meta.getState().facilityUpgrades.warehouse.level, 1);

  const restored = new ExpeditionMetaSystem();
  assert.equal(restored.loadSaveData(meta.getSaveData()).success, true);
  assert.deepEqual(restored.getCapacityState(), meta.getCapacityState());
});

test("制作保险券可为当前配装投保一局，保费报价为售价的20%", () => {
  const meta = new ExpeditionMetaSystem();
  meta.depositItems([
    equipment("insured-field-armor", "armor", "armor"),
    { templateId: "insurance-voucher", quantity: 1 },
  ]);
  const armor = meta.getState().warehouse.find(item => item.templateId === "insured-field-armor");
  assert.equal(meta.equipItem(armor.instanceId).success, true);
  const equippedArmor = meta.getLoadout().armor;
  assert.equal(meta.quoteLoadoutInsurance(equippedArmor.instanceId).premium, 10);
  assert.equal(meta.insureLoadoutItem(equippedArmor.instanceId).success, true);
  assert.equal(meta.getItemCount({ templateId: "insurance-voucher" }), 0);

  const raid = meta.startRaid({ raidId: "insured-through-api" });
  assert.deepEqual(raid.insuredLoadoutIds, [equippedArmor.instanceId]);
  const settlement = meta.applySettlement({
    settlement: { runId: "insured-through-api", extracted: false },
    loot: [],
  });
  assert.equal(settlement.loadoutLost.length, 0);
  assert.equal(meta.getLoadout().armor.instanceId, equippedArmor.instanceId);
});

test("放弃支线不会免费刷新，完成下一次远征后委托板才进入新周期", () => {
  const meta = new ExpeditionMetaSystem();
  const accepted = accept(meta, "side-elite-hunt");
  assert.equal(meta.abandonContract(accepted.contract.contractId).success, true);
  meta.refreshContractBoard();
  assert.equal(meta.getContractState().board.some(entry => entry.templateId === "side-elite-hunt"), false);

  meta.applySettlement({
    settlement: { runId: "contract-refresh-cycle", extracted: false },
    loot: [],
  });
  assert.equal(meta.getContractState().cycle, 1);
  assert.equal(meta.getContractState().board.some(entry => entry.templateId === "side-elite-hunt"), true);
});

test("支线交付不会额外刷新委托板，下一批委托仍由远征结算触发", () => {
  const meta = new ExpeditionMetaSystem();
  const accepted = accept(meta, "side-elite-hunt");
  meta.recordContractEvent({ type: "elite-killed", count: 3 });
  const boardBeforeTurnIn = meta.getContractState().board;
  assert.equal(meta.turnInContract(accepted.contract.contractId).success, true);
  assert.deepEqual(meta.getContractState().board, boardBeforeTurnIn);
});

test("两段主线只能各完成一次，完成后不再回到委托板", () => {
  const meta = new ExpeditionMetaSystem();
  const investigation = unlockInvestigationContract(meta);
  assert.equal(meta.getContractState().board.some(entry => entry.templateId === "main-supply-recovery"), false);
  meta.recordContractEvent({
    type: "location-investigated",
    locationId: "core-vault",
    locationType: "cache",
  });
  assert.equal(meta.turnInContract(investigation.contract.contractId).success, true);
  assert.equal(meta.getContractState().board.some(entry => entry.category === "main"), false);
  meta.refreshContractBoard();
  assert.equal(meta.getContractState().board.some(entry => entry.category === "main"), false);
});

test("旧 contractFragments/deepMaterials 计数迁移为真实物品且不会重复迁移", () => {
  const meta = new ExpeditionMetaSystem();
  const loaded = meta.loadSaveData({
    contractFragments: 7,
    combat: { meta: { deepMaterials: 3 } },
  });
  assert.equal(loaded.success, true);
  assert.deepEqual(loaded.migrated, { contractFragments: 7, deepMaterials: 3 });
  assert.equal(meta.getItemCount({ templateId: "contract-fragment" }), 7);
  assert.equal(meta.getItemCount({ templateId: "deep-material" }), 3);

  const save = meta.getSaveData();
  const restored = new ExpeditionMetaSystem();
  const reloaded = restored.loadSaveData(save);
  assert.deepEqual(reloaded.migrated, { contractFragments: 0, deepMaterials: 0 });
  assert.equal(restored.getItemCount({ templateId: "contract-fragment" }), 7);
  assert.equal(restored.getItemCount({ templateId: "deep-material" }), 3);
});

test("完整存档可恢复仓库、配装、合约、活动远征和幂等结算账本", () => {
  const source = new ExpeditionMetaSystem();
  source.depositItem(equipment("saved-armor", "armor", "armor"));
  source.equipItem(source.getState().warehouse[0].instanceId);
  accept(source, "side-elite-hunt");
  source.recordContractEvent({ type: "elite-killed", count: 2 });
  source.applySettlement({
    settlement: { runId: "already-applied", extracted: true },
    loot: [loot("saved-loot")],
  });
  source.startRaid({ raidId: "active-raid", insuredLoadoutIds: [source.getLoadout().armor.instanceId] });

  const serialized = JSON.parse(JSON.stringify(source.getSaveData()));
  assert.equal(serialized.version, EXPEDITION_META_SAVE_VERSION);
  const restored = new ExpeditionMetaSystem();
  assert.equal(restored.loadSaveData(serialized).success, true);
  assert.deepEqual(restored.getState(), source.getState());

  const duplicate = restored.applySettlement({
    settlement: { runId: "already-applied", extracted: true },
    loot: [loot("duplicate")],
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(restored.getState().warehouse.filter(item => item.originId === "duplicate").length, 0);
});

test("基础模板保持 3-5 条并覆盖目标中的五种合约方向", () => {
  const templates = Object.values(EXPEDITION_CONTRACT_TEMPLATES);
  assert.equal(templates.length, 5);
  assert.deepEqual(
    new Set(templates.map(template => template.kind)),
    new Set([
      "bring-items",
      "investigate-location",
      "kill-elite",
      "pet-extraction",
      "high-threat-extraction",
    ]),
  );
});
