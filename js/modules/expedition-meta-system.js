/**
 * ExpeditionMetaSystem - 远征局外仓库、配装与合约闭环。
 *
 * 本模块不依赖 DOM、Canvas 或其它游戏系统。外部只需把远征结算对象和
 * 本局战利品快照交给 applySettlement，即可安全地完成一次且仅一次的入库。
 */

export const EXPEDITION_META_SAVE_VERSION = 1;

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const asInteger = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Math.floor(Number(value))
  : fallback;
const clampNonNegative = value => Math.max(0, asInteger(value));

export const EXPEDITION_ITEM_TEMPLATES = Object.freeze({
  "starter-carbine": Object.freeze({
    templateId: "starter-carbine",
    name: "制式训练武器组",
    type: "weapon",
    rarity: "starter",
    equipSlot: "mainWeapon",
    combatWeaponId: "rifle",
    combatWeaponIds: Object.freeze(["rifle", "shotgun", "marksman"]),
    sellPrice: 0,
    score: 20,
    permanent: true,
    bound: true,
    stackable: false,
    description: "始终可用、不会在远征失败时遗失；可在步枪、霰弹枪和精确枪模式间切换。",
  }),
  "contract-fragment": Object.freeze({
    templateId: "contract-fragment",
    name: "合约残片",
    type: "contract-material",
    rarity: "uncommon",
    sellPrice: 12,
    score: 20,
    stackable: true,
    maxStack: 999,
    description: "旧城区情报整理出的合约线索。",
  }),
  "deep-material": Object.freeze({
    templateId: "deep-material",
    name: "深层材料",
    type: "deep-material",
    rarity: "rare",
    sellPrice: 55,
    score: 90,
    stackable: true,
    maxStack: 999,
    description: "来自远征深层区域的稀有研究材料。",
  }),
});

/**
 * 基础合约模板。main 最多同时接受 1 条，side 最多同时接受 2 条。
 * bring-items 的进度取决于仓库实时库存，交付时才会扣除物品。
 */
export const EXPEDITION_CONTRACT_TEMPLATES = Object.freeze({
  "main-supply-recovery": Object.freeze({
    id: "main-supply-recovery",
    category: "main",
    kind: "bring-items",
    title: "重建补给线",
    description: "带回并交付 3 件机械或通用组件。",
    target: 3,
    matcher: Object.freeze({ types: Object.freeze(["component"]) }),
    reward: Object.freeze({
      coins: 320,
      crystals: 1,
      items: Object.freeze([{ templateId: "contract-fragment", quantity: 2 }]),
    }),
  }),
  "main-investigate-vault": Object.freeze({
    id: "main-investigate-vault",
    category: "main",
    kind: "investigate-location",
    title: "失联仓库",
    description: "调查核心仓库，确认旧城区补给线的去向。",
    target: 1,
    requirements: Object.freeze({ locationId: "core-vault", locationType: "cache" }),
    reward: Object.freeze({ coins: 260, crystals: 2, items: Object.freeze([]) }),
  }),
  "side-elite-hunt": Object.freeze({
    id: "side-elite-hunt",
    category: "side",
    kind: "kill-elite",
    title: "清除精英威胁",
    description: "在远征中击败 3 名精英敌人。",
    target: 3,
    reward: Object.freeze({ coins: 180, crystals: 1, items: Object.freeze([]) }),
  }),
  "side-pet-extraction": Object.freeze({
    id: "side-pet-extraction",
    category: "side",
    kind: "pet-extraction",
    title: "伙伴归队",
    description: "携带指定宠物完成一次成功撤离。",
    target: 1,
    requiresPetSelection: true,
    reward: Object.freeze({
      coins: 150,
      crystals: 0,
      items: Object.freeze([{ templateId: "contract-fragment", quantity: 1 }]),
    }),
  }),
  "side-high-threat-extraction": Object.freeze({
    id: "side-high-threat-extraction",
    category: "side",
    kind: "high-threat-extraction",
    title: "封锁线突围",
    description: "在威胁值达到 75 或更高时成功撤离。",
    target: 1,
    requirements: Object.freeze({ minimumThreat: 75 }),
    reward: Object.freeze({ coins: 230, crystals: 1, items: Object.freeze([]) }),
  }),
});

const BASIC_WEAPON_INSTANCE_ID = "permanent-starter-carbine";
const LOADOUT_SLOTS = Object.freeze(["mainWeapon", "armor", "petLinker"]);

export class ExpeditionMetaSystem {
  constructor({
    warehouseCapacity = 40,
    creditSettlementCurrency = false,
    contractBoardSize = 4,
  } = {}) {
    this.defaultWarehouseCapacity = Math.max(4, asInteger(warehouseCapacity, 40));
    this.creditSettlementCurrency = creditSettlementCurrency !== false;
    this.contractBoardSize = Math.max(3, Math.min(5, asInteger(contractBoardSize, 4)));
    this.reset();
  }

  reset() {
    this.warehouseCapacity = this.defaultWarehouseCapacity;
    this.itemSerial = 0;
    this.contractSerial = 0;
    this.boardSerial = 0;
    this.raidSerial = 0;
    this.warehouse = [];
    this.deliveryInbox = [];
    this.loadout = this.createDefaultLoadout();
    this.activeRaid = null;
    this.balances = { coins: 0, crystals: 0, rubies: 0, exp: 0 };
    this.activeContracts = [];
    this.contractHistory = [];
    this.contractBoard = [];
    this.settlementLedger = {};
    this.stats = {
      settlements: 0,
      successfulExtractions: 0,
      failedRuns: 0,
      itemsRecovered: 0,
      itemsLost: 0,
      itemsSold: 0,
      coinsFromSales: 0,
      contractsCompleted: 0,
    };
    this.migrations = { legacyCountersV1: true };
    this.refreshContractBoard();
    return this.getState();
  }

  createDefaultLoadout() {
    return {
      mainWeapon: this.createStarterWeapon(),
      armor: null,
      petLinker: null,
      consumables: [null, null, null, null],
    };
  }

  createStarterWeapon(combatWeaponId = null) {
    const template = clone(EXPEDITION_ITEM_TEMPLATES["starter-carbine"]);
    const allowedModes = template.combatWeaponIds || [template.combatWeaponId];
    const selectedMode = allowedModes.includes(String(combatWeaponId || ""))
      ? String(combatWeaponId)
      : template.combatWeaponId;
    return {
      instanceId: BASIC_WEAPON_INSTANCE_ID,
      ...template,
      combatWeaponId: selectedMode,
      quantity: 1,
      originId: null,
      acquiredFrom: "default-loadout",
    };
  }

  /** 将远征 loot 对象或模板对象标准化为可持久化 ItemInstance。 */
  createItem(rawItem = {}, { source = "unknown", preserveInstanceId = false } = {}) {
    if (!rawItem || typeof rawItem !== "object") return null;
    const template = rawItem.templateId && EXPEDITION_ITEM_TEMPLATES[rawItem.templateId]
      ? EXPEDITION_ITEM_TEMPLATES[rawItem.templateId]
      : null;
    const merged = { ...(template ? clone(template) : {}), ...clone(rawItem) };
    const templateId = String(
      merged.templateId
      || merged.itemId
      || merged.type
      || "expedition-loot",
    );
    const permanent = Boolean(merged.permanent || templateId === "starter-carbine");
    let instanceId = preserveInstanceId && merged.instanceId
      ? String(merged.instanceId)
      : null;
    if (!instanceId || instanceId === BASIC_WEAPON_INSTANCE_ID) {
      this.itemSerial += 1;
      instanceId = `meta-item-${this.itemSerial}`;
    }
    const quantity = Math.max(1, asInteger(merged.quantity, 1));
    const item = {
      ...merged,
      instanceId,
      templateId,
      originId: merged.originId ?? merged.id ?? null,
      name: String(merged.name || templateId),
      type: String(merged.type || "loot"),
      rarity: String(merged.rarity || "common"),
      quantity,
      stackable: Boolean(merged.stackable),
      maxStack: Math.max(1, asInteger(merged.maxStack, merged.stackable ? 99 : 1)),
      sellPrice: permanent ? 0 : Math.max(
        0,
        asInteger(merged.sellPrice, asInteger(merged.coins, Math.floor(asInteger(merged.score) * 0.5))),
      ),
      permanent,
      bound: Boolean(merged.bound || permanent),
      acquiredFrom: String(merged.acquiredFrom || source),
    };
    // loot.id 是局内编号，避免与局外实例编号混用。
    delete item.id;
    return item;
  }

  getWarehouseSlotCount() {
    return this.warehouse.length;
  }

  getWarehouseFreeSlots() {
    return Math.max(0, this.warehouseCapacity - this.getWarehouseSlotCount());
  }

  findStackTarget(item, collection = this.warehouse) {
    if (!item.stackable) return null;
    return collection.find(entry => (
      entry.stackable
      && entry.templateId === item.templateId
      && entry.quantity < entry.maxStack
    )) || null;
  }

  getRequiredWarehouseSlots(item) {
    let remaining = Math.max(1, asInteger(item.quantity, 1));
    if (item.stackable) {
      for (const stack of this.warehouse) {
        if (stack.templateId !== item.templateId || !stack.stackable) continue;
        remaining -= Math.max(0, stack.maxStack - stack.quantity);
        if (remaining <= 0) return 0;
      }
      return Math.ceil(remaining / item.maxStack);
    }
    return remaining;
  }

  storeNormalizedItem(item, { allowPending = false } = {}) {
    const stored = [];
    const pending = [];
    if (!allowPending && this.getRequiredWarehouseSlots(item) > this.getWarehouseFreeSlots()) {
      return {
        success: false,
        message: "仓库容量不足",
        stored,
        pending,
        rejected: clone(item),
      };
    }
    let remaining = Math.max(1, asInteger(item.quantity, 1));
    while (remaining > 0) {
      const stack = this.findStackTarget(item);
      if (stack) {
        const moved = Math.min(remaining, stack.maxStack - stack.quantity);
        stack.quantity += moved;
        remaining -= moved;
        stored.push({ instanceId: stack.instanceId, quantity: moved, stacked: true });
        continue;
      }
      const stackQuantity = Math.min(remaining, item.stackable ? item.maxStack : 1);
      const next = {
        ...clone(item),
        instanceId: remaining === item.quantity
          ? item.instanceId
          : `meta-item-${++this.itemSerial}`,
        quantity: stackQuantity,
      };
      if (this.warehouse.length < this.warehouseCapacity) {
        this.warehouse.push(next);
        stored.push({ instanceId: next.instanceId, quantity: stackQuantity, stacked: false });
      } else if (allowPending) {
        const inboxStack = this.findStackTarget(next, this.deliveryInbox);
        if (inboxStack) inboxStack.quantity += stackQuantity;
        else this.deliveryInbox.push(next);
        pending.push({ instanceId: next.instanceId, quantity: stackQuantity });
      } else {
        return {
          success: false,
          message: "仓库容量不足",
          stored,
          pending,
          rejected: { ...clone(item), quantity: remaining },
        };
      }
      remaining -= stackQuantity;
    }
    this.refreshInventoryContractProgress();
    return { success: true, stored, pending, item: clone(item) };
  }

  depositItem(rawItem, { source = "manual", allowPending = false } = {}) {
    const item = this.createItem(rawItem, { source });
    if (!item) return { success: false, message: "物品数据无效" };
    if (item.permanent || item.templateId === "starter-carbine") {
      return { success: false, message: "基础武器无需存入仓库" };
    }
    if (!allowPending && this.getRequiredWarehouseSlots(item) > this.getWarehouseFreeSlots()) {
      return { success: false, message: "仓库容量不足", stored: [], pending: [], rejected: clone(item) };
    }
    return this.storeNormalizedItem(item, { allowPending });
  }

  depositItems(items = [], options = {}) {
    const results = [];
    for (const item of Array.isArray(items) ? items : []) {
      results.push(this.depositItem(item, options));
    }
    return {
      success: results.every(result => result.success),
      results,
      storedCount: results.reduce((sum, result) => (
        sum + (result.stored || []).reduce((inner, entry) => inner + entry.quantity, 0)
      ), 0),
      pendingCount: results.reduce((sum, result) => (
        sum + (result.pending || []).reduce((inner, entry) => inner + entry.quantity, 0)
      ), 0),
    };
  }

  withdrawItem(instanceId, { quantity = null } = {}) {
    const index = this.warehouse.findIndex(item => item.instanceId === instanceId);
    if (index < 0) return { success: false, message: "仓库中没有该物品" };
    const source = this.warehouse[index];
    const amount = quantity == null
      ? source.quantity
      : Math.max(1, Math.min(source.quantity, asInteger(quantity, 1)));
    let item;
    if (amount >= source.quantity) {
      item = this.warehouse.splice(index, 1)[0];
    } else {
      source.quantity -= amount;
      item = { ...clone(source), instanceId: `meta-item-${++this.itemSerial}`, quantity: amount };
    }
    this.refreshInventoryContractProgress();
    return { success: true, item: clone(item) };
  }

  sellItem(instanceId, { quantity = null } = {}) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法出售仓库物品" };
    const item = this.warehouse.find(entry => entry.instanceId === instanceId);
    if (!item) return { success: false, message: "仓库中没有该物品" };
    if (item.bound || item.permanent) return { success: false, message: "该物品不可出售" };
    const amount = quantity == null
      ? item.quantity
      : Math.max(1, Math.min(item.quantity, asInteger(quantity, 1)));
    const withdrawn = this.withdrawItem(instanceId, { quantity: amount });
    if (!withdrawn.success) return withdrawn;
    const coins = Math.max(0, asInteger(withdrawn.item.sellPrice)) * amount;
    this.balances.coins += coins;
    this.stats.itemsSold += amount;
    this.stats.coinsFromSales += coins;
    return { success: true, coins, quantity: amount, item: withdrawn.item };
  }

  /** 原子取走待转入现有 ResourceSystem / PlayerSystem 的局外奖励。 */
  drainBalances() {
    const drained = { ...this.balances };
    this.balances = { coins: 0, crystals: 0, rubies: 0, exp: 0 };
    return drained;
  }

  claimBalances() {
    return this.drainBalances();
  }

  claimPendingDeliveries({ limit = Infinity } = {}) {
    if (this.activeRaid) return { success: false, changed: false, claimedCount: 0, message: "远征进行中无法领取物资" };
    const claimed = [];
    let count = 0;
    let claimedCount = 0;
    while (this.deliveryInbox.length > 0 && count < limit) {
      const item = this.deliveryInbox[0];
      const result = this.storeNormalizedItem(item, { allowPending: false });
      if (!result.success) break;
      this.deliveryInbox.shift();
      claimed.push(...result.stored);
      claimedCount += Math.max(1, asInteger(item.quantity, 1));
      count += 1;
    }
    return {
      success: this.deliveryInbox.length === 0,
      changed: claimed.length > 0,
      claimedCount,
      claimed,
      remaining: this.deliveryInbox.length,
      message: this.deliveryInbox.length ? "仓库空间不足，仍有待领取物品" : "待领取物品已全部入库",
    };
  }

  expectedEquipSlot(item) {
    if (item.equipSlot) return item.equipSlot;
    if (item.type === "weapon") return "mainWeapon";
    if (item.type === "armor") return "armor";
    if (["pet-linker", "petLinker", "pet-device"].includes(item.type)) return "petLinker";
    if (["consumable", "medical", "grenade", "supply"].includes(item.type)) return "consumable";
    return null;
  }

  setWeaponMode(combatWeaponId) {
    const weapon = this.loadout.mainWeapon;
    if (!weapon) return { success: false, message: "主武器槽为空" };
    const requested = String(combatWeaponId || "");
    const allowed = Array.isArray(weapon.combatWeaponIds) && weapon.combatWeaponIds.length
      ? weapon.combatWeaponIds.map(String)
      : [String(weapon.combatWeaponId || "")].filter(Boolean);
    if (!allowed.includes(requested)) {
      return { success: false, message: "当前主武器不支持该射击模式" };
    }
    weapon.combatWeaponId = requested;
    if (this.activeRaid?.loadoutSnapshot?.mainWeapon?.instanceId === weapon.instanceId) {
      this.activeRaid.loadoutSnapshot.mainWeapon.combatWeaponId = requested;
    }
    return { success: true, message: `已设置主武器模式：${requested}`, combatWeaponId: requested };
  }

  equipItem(instanceId, { slot = null, consumableIndex = 0 } = {}) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法调整配装" };
    const index = this.warehouse.findIndex(item => item.instanceId === instanceId);
    if (index < 0) return { success: false, message: "仓库中没有该物品" };
    const item = this.warehouse[index];
    const expected = this.expectedEquipSlot(item);
    const requested = slot || expected;
    if (!expected || (requested !== expected && !(requested === "consumables" && expected === "consumable"))) {
      return { success: false, message: "物品与配装槽不匹配" };
    }

    let previous = null;
    if (expected === "consumable") {
      const targetIndex = Math.max(0, Math.min(3, asInteger(consumableIndex)));
      previous = this.loadout.consumables[targetIndex];
      this.warehouse.splice(index, 1);
      if (previous) this.warehouse.push(previous);
      this.loadout.consumables[targetIndex] = item;
    } else {
      previous = this.loadout[expected];
      this.warehouse.splice(index, 1);
      if (previous && !previous.permanent) this.warehouse.push(previous);
      this.loadout[expected] = item;
    }
    this.refreshInventoryContractProgress();
    return { success: true, equipped: clone(item), previous: clone(previous), loadout: this.getLoadout() };
  }

  unequipItem(slot, { consumableIndex = 0 } = {}) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法调整配装" };
    if (!LOADOUT_SLOTS.includes(slot) && slot !== "consumable" && slot !== "consumables") {
      return { success: false, message: "未知配装槽" };
    }
    const targetIndex = Math.max(0, Math.min(3, asInteger(consumableIndex)));
    const current = slot === "consumable" || slot === "consumables"
      ? this.loadout.consumables[targetIndex]
      : this.loadout[slot];
    if (!current) return { success: false, message: "该配装槽为空" };
    if (current.permanent) return { success: false, message: "基础武器不可移除" };
    if (!this.findStackTarget(current) && this.warehouse.length >= this.warehouseCapacity) {
      return { success: false, message: "仓库容量不足" };
    }
    const result = this.storeNormalizedItem(current, { allowPending: false });
    if (!result.success) return result;
    if (slot === "consumable" || slot === "consumables") this.loadout.consumables[targetIndex] = null;
    else if (slot === "mainWeapon") this.loadout.mainWeapon = this.createStarterWeapon();
    else this.loadout[slot] = null;
    return { success: true, item: clone(current), loadout: this.getLoadout() };
  }

  getLoadout() {
    return clone(this.loadout);
  }

  getEquippedItems() {
    return [
      this.loadout.mainWeapon,
      this.loadout.armor,
      this.loadout.petLinker,
      ...this.loadout.consumables,
    ].filter(Boolean);
  }

  startRaid({ raidId = null, insuredLoadoutIds = [] } = {}) {
    if (this.activeRaid) return { success: false, message: "已有进行中的远征配装" };
    this.raidSerial += 1;
    const resolvedRaidId = String(raidId ?? `meta-raid-${this.raidSerial}`);
    const equippedIds = new Set(this.getEquippedItems().map(item => item.instanceId));
    const insuredIds = [...new Set((insuredLoadoutIds || []).map(String))]
      .filter(id => equippedIds.has(id) && id !== BASIC_WEAPON_INSTANCE_ID);
    this.activeRaid = {
      raidId: resolvedRaidId,
      insuredLoadoutIds: insuredIds,
      loadoutSnapshot: this.getLoadout(),
    };
    return {
      success: true,
      raidId: resolvedRaidId,
      loadout: this.getLoadout(),
      insuredLoadoutIds: [...insuredIds],
    };
  }

  markConsumableUsed(consumableIndex, quantity = 1) {
    if (!this.activeRaid) return { success: false, message: "当前没有进行中的远征" };
    const index = Math.max(0, Math.min(3, asInteger(consumableIndex)));
    const item = this.loadout.consumables[index];
    if (!item) return { success: false, message: "该消耗品槽为空" };
    const used = Math.min(item.quantity, Math.max(1, asInteger(quantity, 1)));
    item.quantity -= used;
    if (item.quantity <= 0) this.loadout.consumables[index] = null;
    return { success: true, used, remaining: this.loadout.consumables[index]?.quantity || 0 };
  }

  resolveRaidLoadout({ extracted, insuredItemIds = [] } = {}) {
    if (!this.activeRaid) return { lost: [], retained: this.getEquippedItems().map(clone) };
    const protectedIds = new Set([
      ...this.activeRaid.insuredLoadoutIds,
      ...(insuredItemIds || []).map(String),
    ]);
    const lost = [];
    if (!extracted) {
      const loseUnlessProtected = item => {
        if (!item || item.permanent || item.keepOnFailure || protectedIds.has(item.instanceId)) return false;
        lost.push(clone(item));
        return true;
      };
      if (loseUnlessProtected(this.loadout.mainWeapon)) this.loadout.mainWeapon = this.createStarterWeapon();
      if (loseUnlessProtected(this.loadout.armor)) this.loadout.armor = null;
      if (loseUnlessProtected(this.loadout.petLinker)) this.loadout.petLinker = null;
      this.loadout.consumables = this.loadout.consumables.map(item => loseUnlessProtected(item) ? null : item);
    }
    if (!this.loadout.mainWeapon) this.loadout.mainWeapon = this.createStarterWeapon();
    const retained = this.getEquippedItems().map(clone);
    this.activeRaid = null;
    return { lost, retained };
  }

  buildSettlementKey(settlement, explicitId = null) {
    const id = explicitId ?? settlement?.settlementId ?? settlement?.runId ?? settlement?.id;
    return id == null || id === "" ? null : `settlement:${String(id)}`;
  }

  isFailureRecoverableLoot(item, insuredIds) {
    const ids = [item?.instanceId, item?.id, item?.originId].filter(Boolean).map(String);
    return Boolean(
      item?.insured
      || item?.secured
      || item?.keepOnFailure
      || ids.some(id => insuredIds.has(id))
    );
  }

  createLegacySettlementMaterials(settlement) {
    const items = [];
    const fragments = clampNonNegative(settlement?.contractFragments);
    const deepMaterials = clampNonNegative(settlement?.deepMaterials);
    if (fragments > 0) items.push({ templateId: "contract-fragment", quantity: fragments });
    if (deepMaterials > 0) items.push({ templateId: "deep-material", quantity: deepMaterials });
    return items;
  }

  /**
   * 接收现有 ExpeditionRunSystem 的结算结果。
   *
   * 成功撤离：loot 全部入库；失败：只接收显式 insured/secured/keepOnFailure
   * 的 loot，或 recoveredLoot 中由远征系统已判定可回收的物品。
   */
  applySettlement({
    settlement,
    loot = null,
    recoveredLoot = [],
    insuredItemIds = [],
    settlementId = null,
    runStats = {},
  } = {}) {
    if (!settlement || typeof settlement !== "object") {
      return { success: false, message: "结算数据无效" };
    }
    const ledgerKey = this.buildSettlementKey(settlement, settlementId);
    if (!ledgerKey) return { success: false, message: "结算缺少稳定的 runId 或 settlementId" };
    if (this.settlementLedger[ledgerKey]) {
      return { ...clone(this.settlementLedger[ledgerKey]), success: true, duplicate: true };
    }

    const extracted = Boolean(settlement.extracted);
    const lootSource = Array.isArray(loot)
      ? loot
      : Array.isArray(settlement.loot)
        ? settlement.loot
        : Array.isArray(settlement.backpack)
          ? settlement.backpack
          : [];
    const insuredIds = new Set((insuredItemIds || []).map(String));
    let recoverable;
    if (extracted) {
      recoverable = [...lootSource];
    } else {
      const explicitRecovered = Array.isArray(recoveredLoot) ? recoveredLoot : [];
      const candidates = [
        ...explicitRecovered,
        ...lootSource.filter(item => this.isFailureRecoverableLoot(item, insuredIds)),
      ];
      const seen = new Set();
      recoverable = candidates.filter((item, index) => {
        const key = String(item?.instanceId ?? item?.id ?? item?.originId ?? `anonymous-${index}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (lootSource.length === 0 && recoverable.length === 0) {
      recoverable.push(...this.createLegacySettlementMaterials(settlement));
    }

    const deposit = this.depositItems(recoverable, {
      source: `settlement-${ledgerKey.slice("settlement:".length)}`,
      allowPending: true,
    });
    const recoveredQuantity = deposit.storedCount + deposit.pendingCount;
    const recoveredKeys = new Set(recoverable.map((item, index) => String(
      item?.instanceId ?? item?.id ?? item?.originId ?? `anonymous-${index}`,
    )));
    const lostQuantity = extracted
      ? 0
      : lootSource.filter((item, index) => {
        const key = String(item?.instanceId ?? item?.id ?? item?.originId ?? `anonymous-${index}`);
        return !this.isFailureRecoverableLoot(item, insuredIds) && !recoveredKeys.has(key);
      }).reduce((sum, item) => sum + Math.max(1, asInteger(item?.quantity, 1)), 0);

    const currency = {
      coins: this.creditSettlementCurrency ? clampNonNegative(settlement.coins) : 0,
      crystals: this.creditSettlementCurrency ? clampNonNegative(settlement.crystals) : 0,
      rubies: this.creditSettlementCurrency ? clampNonNegative(settlement.rubyReward ?? settlement.rubies) : 0,
      exp: this.creditSettlementCurrency ? clampNonNegative(settlement.exp) : 0,
    };
    for (const key of Object.keys(this.balances)) this.balances[key] += currency[key];

    const loadoutResolution = this.resolveRaidLoadout({ extracted, insuredItemIds });
    const contractUpdates = [];
    const eliteKills = clampNonNegative(runStats.eliteKills ?? settlement.eliteKills);
    if (eliteKills > 0) contractUpdates.push(...this.recordContractEvent({ type: "elite-killed", count: eliteKills }).updated);
    for (const location of runStats.investigatedLocations || runStats.investigatedLocationIds || settlement.investigatedLocationIds || []) {
      const locationId = typeof location === "object" ? location.id || location.nodeId : location;
      const locationType = typeof location === "object" ? location.type || location.locationType : null;
      contractUpdates.push(...this.recordContractEvent({
        type: "location-investigated",
        locationId,
        locationType,
      }).updated);
    }
    contractUpdates.push(...this.recordContractEvent({
      type: "extraction",
      extracted,
      threat: clampNonNegative(settlement.threat),
      petIds: runStats.petIds || settlement.petIds || [],
    }).updated);

    this.stats.settlements += 1;
    if (extracted) this.stats.successfulExtractions += 1;
    else this.stats.failedRuns += 1;
    this.stats.itemsRecovered += recoveredQuantity;
    this.stats.itemsLost += lostQuantity + loadoutResolution.lost.reduce((sum, item) => sum + item.quantity, 0);

    const result = {
      success: true,
      duplicate: false,
      ledgerKey,
      extracted,
      recoveredCount: recoveredQuantity,
      lostCount: lostQuantity,
      storedCount: deposit.storedCount,
      pendingCount: deposit.pendingCount,
      currency,
      loadoutLost: loadoutResolution.lost,
      loadoutRetained: loadoutResolution.retained,
      contractUpdates: [...new Set(contractUpdates)],
      message: extracted
        ? `撤离物资已接收：${recoveredQuantity} 件`
        : `失败回收已处理：${recoveredQuantity} 件，遗失 ${lostQuantity} 件`,
    };
    this.settlementLedger[ledgerKey] = clone(result);
    return result;
  }

  getSettlementRecord(settlementId) {
    const key = String(settlementId).startsWith("settlement:")
      ? String(settlementId)
      : `settlement:${String(settlementId)}`;
    return clone(this.settlementLedger[key] || null);
  }

  getItemCount(matcher = {}) {
    return this.warehouse.reduce((sum, item) => (
      this.itemMatches(item, matcher) ? sum + item.quantity : sum
    ), 0);
  }

  itemMatches(item, matcher = {}) {
    if (!item) return false;
    if (matcher.templateId && item.templateId !== matcher.templateId) return false;
    if (matcher.name && item.name !== matcher.name) return false;
    if (matcher.type && item.type !== matcher.type) return false;
    if (Array.isArray(matcher.types) && !matcher.types.includes(item.type)) return false;
    if (Array.isArray(matcher.tags) && !matcher.tags.every(tag => (item.tags || []).includes(tag))) return false;
    return true;
  }

  refreshContractBoard() {
    const activeTemplateIds = new Set(this.activeContracts.map(contract => contract.templateId));
    const templates = Object.values(EXPEDITION_CONTRACT_TEMPLATES)
      .filter(template => !activeTemplateIds.has(template.id));
    this.boardSerial += 1;
    const start = templates.length ? (this.boardSerial - 1) % templates.length : 0;
    const rotated = templates.length
      ? [...templates.slice(start), ...templates.slice(0, start)]
      : [];
    this.contractBoard = rotated.slice(0, this.contractBoardSize).map((template, index) => ({
      offerId: `contract-offer-${this.boardSerial}-${index + 1}`,
      templateId: template.id,
      category: template.category,
      title: template.title,
      description: template.description,
      reward: clone(template.reward),
    }));
    return clone(this.contractBoard);
  }

  acceptContract(templateOrOfferId, options = {}) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法接受新合约" };
    const offer = this.contractBoard.find(entry => entry.offerId === templateOrOfferId);
    const templateId = offer?.templateId || String(templateOrOfferId);
    const template = EXPEDITION_CONTRACT_TEMPLATES[templateId];
    if (!template) return { success: false, message: "未知合约" };
    if (!offer && !this.contractBoard.some(entry => entry.templateId === templateId)) {
      return { success: false, message: "该合约当前不在委托板上" };
    }
    if (this.activeContracts.some(contract => contract.templateId === templateId)) {
      return { success: false, message: "该合约已经在进行中" };
    }
    const categoryCount = this.activeContracts.filter(contract => contract.category === template.category).length;
    const categoryLimit = template.category === "main" ? 1 : 2;
    if (categoryCount >= categoryLimit) {
      return { success: false, message: template.category === "main" ? "主线合约槽已满" : "支线合约槽已满" };
    }
    if (template.requiresPetSelection && !options.petId) {
      return { success: false, message: "该合约需要指定一只宠物" };
    }
    this.contractSerial += 1;
    const contract = {
      contractId: `contract-${this.contractSerial}`,
      templateId: template.id,
      category: template.category,
      kind: template.kind,
      title: template.title,
      description: template.description,
      target: Math.max(1, asInteger(template.target, 1)),
      progress: 0,
      status: "active",
      matcher: clone(template.matcher || null),
      requirements: clone(template.requirements || {}),
      reward: clone(template.reward || {}),
      targetPetId: options.petId ? String(options.petId) : null,
      targetPetName: options.petName ? String(options.petName) : null,
    };
    this.activeContracts.push(contract);
    this.refreshInventoryContractProgress();
    this.refreshContractBoard();
    return { success: true, contract: clone(contract) };
  }

  refreshInventoryContractProgress() {
    for (const contract of this.activeContracts) {
      if (contract.kind !== "bring-items") continue;
      contract.progress = Math.min(contract.target, this.getItemCount(contract.matcher || {}));
      contract.status = contract.progress >= contract.target ? "ready" : "active";
    }
    return clone(this.activeContracts);
  }

  recordContractEvent(event = {}) {
    const updated = [];
    for (const contract of this.activeContracts) {
      if (contract.status === "completed") continue;
      let increment = 0;
      if (contract.kind === "investigate-location" && event.type === "location-investigated") {
        const required = contract.requirements?.locationId;
        const requiredType = contract.requirements?.locationType;
        if (
          (!required && !requiredType)
          || (required && String(event.locationId) === String(required))
          || (requiredType && String(event.locationType) === String(requiredType))
        ) increment = 1;
      } else if (contract.kind === "kill-elite" && event.type === "elite-killed") {
        increment = Math.max(1, asInteger(event.count, 1));
      } else if (contract.kind === "pet-extraction" && event.type === "extraction" && event.extracted) {
        const petIds = (event.petIds || []).map(String);
        if (petIds.includes(String(contract.targetPetId))) increment = 1;
      } else if (contract.kind === "high-threat-extraction" && event.type === "extraction" && event.extracted) {
        if (Number(event.threat || 0) >= Number(contract.requirements?.minimumThreat || 75)) increment = 1;
      }
      if (increment > 0) {
        contract.progress = Math.min(contract.target, contract.progress + increment);
        contract.status = contract.progress >= contract.target ? "ready" : "active";
        updated.push(contract.contractId);
      }
    }
    this.refreshInventoryContractProgress();
    return { success: true, updated: [...new Set(updated)], contracts: clone(this.activeContracts) };
  }

  consumeMatchingItems(matcher, quantity) {
    let remaining = Math.max(0, asInteger(quantity));
    const consumed = [];
    for (let index = this.warehouse.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const item = this.warehouse[index];
      if (!this.itemMatches(item, matcher)) continue;
      const amount = Math.min(remaining, item.quantity);
      item.quantity -= amount;
      remaining -= amount;
      consumed.push({ instanceId: item.instanceId, templateId: item.templateId, quantity: amount });
      if (item.quantity <= 0) this.warehouse.splice(index, 1);
    }
    return { success: remaining === 0, consumed, remaining };
  }

  turnInContract(contractId) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法交付合约" };
    this.refreshInventoryContractProgress();
    const index = this.activeContracts.findIndex(contract => contract.contractId === contractId);
    if (index < 0) return { success: false, message: "未找到进行中的合约" };
    const contract = this.activeContracts[index];
    if (contract.progress < contract.target) return { success: false, message: "合约目标尚未完成" };
    let consumed = [];
    if (contract.kind === "bring-items") {
      const consumption = this.consumeMatchingItems(contract.matcher || {}, contract.target);
      if (!consumption.success) {
        this.refreshInventoryContractProgress();
        return { success: false, message: "交付物资不足" };
      }
      consumed = consumption.consumed;
    }

    const reward = {
      coins: clampNonNegative(contract.reward?.coins),
      crystals: clampNonNegative(contract.reward?.crystals),
      rubies: clampNonNegative(contract.reward?.rubies),
      exp: clampNonNegative(contract.reward?.exp),
      items: clone(contract.reward?.items || []),
    };
    this.balances.coins += reward.coins;
    this.balances.crystals += reward.crystals;
    this.balances.rubies += reward.rubies;
    this.balances.exp += reward.exp;
    const itemRewards = this.depositItems(reward.items, { source: `contract-${contract.templateId}`, allowPending: true });

    contract.status = "completed";
    contract.completedSerial = this.stats.contractsCompleted + 1;
    this.activeContracts.splice(index, 1);
    this.contractHistory.push(clone(contract));
    this.stats.contractsCompleted += 1;
    this.refreshInventoryContractProgress();
    this.refreshContractBoard();
    return {
      success: true,
      contract: clone(contract),
      consumed,
      reward,
      itemRewards,
      message: `合约“${contract.title}”已交付`,
    };
  }

  abandonContract(contractId) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法放弃合约" };
    const index = this.activeContracts.findIndex(contract => contract.contractId === contractId);
    if (index < 0) return { success: false, message: "未找到进行中的合约" };
    const [contract] = this.activeContracts.splice(index, 1);
    this.refreshContractBoard();
    return { success: true, contract: clone(contract) };
  }

  getContractState() {
    return {
      active: clone(this.activeContracts),
      history: clone(this.contractHistory),
      board: clone(this.contractBoard),
      slots: {
        main: this.activeContracts.filter(contract => contract.category === "main").length,
        mainMax: 1,
        side: this.activeContracts.filter(contract => contract.category === "side").length,
        sideMax: 2,
      },
    };
  }

  findLegacyCounter(data, key) {
    const candidates = [
      data?.[key],
      data?.meta?.[key],
      data?.stats?.[key],
      data?.progress?.[key],
      data?.combat?.meta?.[key],
    ];
    const match = candidates.find(value => Number.isFinite(Number(value)) && Number(value) > 0);
    return clampNonNegative(match);
  }

  hydrateCollection(items = [], seenIds = new Set(), source = "save") {
    const hydrated = [];
    for (const raw of Array.isArray(items) ? items : []) {
      let item = this.createItem(raw, { source, preserveInstanceId: true });
      if (!item || item.permanent) continue;
      if (seenIds.has(item.instanceId)) item = { ...item, instanceId: `meta-item-${++this.itemSerial}` };
      seenIds.add(item.instanceId);
      hydrated.push(item);
    }
    return hydrated;
  }

  hydrateLoadout(savedLoadout = {}, seenIds = new Set()) {
    const hydrateEquipped = (raw, slot) => {
      if (!raw) return null;
      if (slot === "mainWeapon" && (raw.permanent || raw.templateId === "starter-carbine")) {
        return this.createStarterWeapon(raw.combatWeaponId);
      }
      let item = this.createItem(raw, { source: "save-loadout", preserveInstanceId: true });
      if (!item || this.expectedEquipSlot(item) !== slot) return null;
      if (seenIds.has(item.instanceId)) item = { ...item, instanceId: `meta-item-${++this.itemSerial}` };
      seenIds.add(item.instanceId);
      return item;
    };
    const consumables = Array.from({ length: 4 }, (_, index) => {
      const item = this.createItem(savedLoadout?.consumables?.[index], {
        source: "save-loadout",
        preserveInstanceId: true,
      });
      if (!item || this.expectedEquipSlot(item) !== "consumable") return null;
      if (seenIds.has(item.instanceId)) item.instanceId = `meta-item-${++this.itemSerial}`;
      seenIds.add(item.instanceId);
      return item;
    });
    return {
      mainWeapon: hydrateEquipped(savedLoadout.mainWeapon, "mainWeapon") || this.createStarterWeapon(),
      armor: hydrateEquipped(savedLoadout.armor, "armor"),
      petLinker: hydrateEquipped(savedLoadout.petLinker, "petLinker"),
      consumables,
    };
  }

  getSaveData() {
    return clone({
      version: EXPEDITION_META_SAVE_VERSION,
      config: {
        warehouseCapacity: this.warehouseCapacity,
        creditSettlementCurrency: this.creditSettlementCurrency,
        contractBoardSize: this.contractBoardSize,
      },
      serials: {
        item: this.itemSerial,
        contract: this.contractSerial,
        board: this.boardSerial,
        raid: this.raidSerial,
      },
      warehouse: this.warehouse,
      deliveryInbox: this.deliveryInbox,
      loadout: this.loadout,
      activeRaid: this.activeRaid,
      balances: this.balances,
      activeContracts: this.activeContracts,
      contractHistory: this.contractHistory,
      contractBoard: this.contractBoard,
      settlementLedger: this.settlementLedger,
      stats: this.stats,
      migrations: this.migrations,
    });
  }

  loadSaveData(saveData = {}) {
    if (!saveData || typeof saveData !== "object") {
      return { success: false, message: "远征局外存档无效" };
    }
    const saved = saveData.state && typeof saveData.state === "object" ? saveData.state : saveData;
    const legacyFragments = this.findLegacyCounter(saveData, "contractFragments");
    const legacyDeepMaterials = this.findLegacyCounter(saveData, "deepMaterials");
    const migrationAlreadyApplied = Boolean(saved.migrations?.legacyCountersV1);

    this.reset();
    this.warehouseCapacity = Math.max(4, asInteger(saved.config?.warehouseCapacity ?? saved.warehouseCapacity, this.defaultWarehouseCapacity));
    this.creditSettlementCurrency = saved.config?.creditSettlementCurrency ?? this.creditSettlementCurrency;
    this.contractBoardSize = Math.max(3, Math.min(5, asInteger(saved.config?.contractBoardSize, this.contractBoardSize)));
    this.itemSerial = clampNonNegative(saved.serials?.item ?? saved.itemSerial);
    this.contractSerial = clampNonNegative(saved.serials?.contract ?? saved.contractSerial);
    this.boardSerial = clampNonNegative(saved.serials?.board ?? saved.boardSerial);
    this.raidSerial = clampNonNegative(saved.serials?.raid ?? saved.raidSerial);

    const seenIds = new Set([BASIC_WEAPON_INSTANCE_ID]);
    const hydratedWarehouse = this.hydrateCollection(saved.warehouse || saved.stash, seenIds, "save-warehouse");
    this.warehouse = hydratedWarehouse.slice(0, this.warehouseCapacity);
    const overflowFromSave = hydratedWarehouse.slice(this.warehouseCapacity);
    this.deliveryInbox = [
      ...overflowFromSave,
      ...this.hydrateCollection(saved.deliveryInbox, seenIds, "save-inbox"),
    ];
    this.loadout = this.hydrateLoadout(saved.loadout || {}, seenIds);
    this.activeRaid = saved.activeRaid && typeof saved.activeRaid === "object" ? clone(saved.activeRaid) : null;
    this.balances = {
      coins: clampNonNegative(saved.balances?.coins),
      crystals: clampNonNegative(saved.balances?.crystals),
      rubies: clampNonNegative(saved.balances?.rubies),
      exp: clampNonNegative(saved.balances?.exp),
    };
    this.activeContracts = Array.isArray(saved.activeContracts) ? clone(saved.activeContracts) : [];
    this.contractHistory = Array.isArray(saved.contractHistory) ? clone(saved.contractHistory) : [];
    this.contractBoard = Array.isArray(saved.contractBoard) ? clone(saved.contractBoard) : [];
    this.settlementLedger = saved.settlementLedger && typeof saved.settlementLedger === "object"
      ? clone(saved.settlementLedger)
      : {};
    this.stats = { ...this.stats, ...(saved.stats && typeof saved.stats === "object" ? clone(saved.stats) : {}) };
    this.migrations = { ...this.migrations, ...(saved.migrations || {}) };

    const migrated = { contractFragments: 0, deepMaterials: 0 };
    if (!migrationAlreadyApplied) {
      if (legacyFragments > 0) {
        this.depositItem({ templateId: "contract-fragment", quantity: legacyFragments }, {
          source: "legacy-counter-migration",
          allowPending: true,
        });
        migrated.contractFragments = legacyFragments;
      }
      if (legacyDeepMaterials > 0) {
        this.depositItem({ templateId: "deep-material", quantity: legacyDeepMaterials }, {
          source: "legacy-counter-migration",
          allowPending: true,
        });
        migrated.deepMaterials = legacyDeepMaterials;
      }
    }
    this.migrations.legacyCountersV1 = true;
    if (!this.contractBoard.length) this.refreshContractBoard();
    this.refreshInventoryContractProgress();
    return {
      success: true,
      message: "远征局外进度已恢复",
      migrated,
      state: this.getState(),
    };
  }

  getState() {
    return clone({
      version: EXPEDITION_META_SAVE_VERSION,
      warehouseCapacity: this.warehouseCapacity,
      warehouseUsed: this.getWarehouseSlotCount(),
      warehouseFree: this.getWarehouseFreeSlots(),
      warehouse: this.warehouse,
      deliveryInbox: this.deliveryInbox,
      loadout: this.loadout,
      activeRaid: this.activeRaid,
      balances: this.balances,
      contracts: this.getContractState(),
      stats: this.stats,
      settlementCount: Object.keys(this.settlementLedger).length,
      migrations: this.migrations,
    });
  }
}
