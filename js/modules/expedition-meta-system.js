/**
 * ExpeditionMetaSystem - 远征局外仓库、配装与合约闭环。
 *
 * 本模块不依赖 DOM、Canvas 或其它游戏系统。外部只需把远征结算对象和
 * 本局战利品快照交给 applySettlement，即可安全地完成一次且仅一次的入库。
 */

export const EXPEDITION_META_SAVE_VERSION = 2;

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const asInteger = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Math.floor(Number(value))
  : fallback;
const clampNonNegative = value => Math.max(0, asInteger(value));

export const EXPEDITION_ITEM_PURPOSES = Object.freeze({
  mechanical: Object.freeze({ id: "mechanical", label: "机械件", use: "武器维护、弹药与基础护甲制作" }),
  medical: Object.freeze({ id: "medical", label: "医疗物资", use: "行动补给与护甲内衬制作" }),
  intel: Object.freeze({ id: "intel", label: "情报", use: "主线调查、保险与路线准备" }),
  pet: Object.freeze({ id: "pet", label: "宠物素材", use: "伙伴补给与宠物装置制作" }),
  core: Object.freeze({ id: "core", label: "稀有核心", use: "高阶装备、保险券与基地扩容" }),
  equipment: Object.freeze({ id: "equipment", label: "装备", use: "带入远征并承担失败遗失风险" }),
  consumable: Object.freeze({ id: "consumable", label: "行动物资", use: "出发时转化为本局补给或弹药" }),
  insurance: Object.freeze({ id: "insurance", label: "保险凭证", use: "为一件非永久配装承保一局" }),
  valuables: Object.freeze({ id: "valuables", label: "贵重品", use: "出售换取金币" }),
});

const MATERIAL_PURPOSES = Object.freeze(["mechanical", "medical", "intel", "pet", "core"]);

export const EXPEDITION_WORKSHOP_RECIPES = Object.freeze({
  "field-ammo-pack": Object.freeze({
    id: "field-ammo-pack",
    name: "通用弹药包",
    description: "为后续远征整备预留的通用弹药物资。",
    costs: Object.freeze({ mechanical: 2 }),
    output: Object.freeze({ templateId: "field-ammo-pack", quantity: 1 }),
  }),
  "field-ration": Object.freeze({
    id: "field-ration",
    name: "伙伴行动补给",
    description: "装入补给栏，出发时转化为 1 份补给。",
    costs: Object.freeze({ medical: 1, pet: 1 }),
    output: Object.freeze({ templateId: "field-ration", quantity: 1 }),
  }),
  "insurance-voucher": Object.freeze({
    id: "insurance-voucher",
    name: "装备保险券",
    description: "为一件非永久配装支付一次出发保险。",
    costs: Object.freeze({ intel: 2, core: 1 }),
    output: Object.freeze({ templateId: "insurance-voucher", quantity: 1 }),
  }),
  "field-armor": Object.freeze({
    id: "field-armor",
    name: "拼装野战护甲",
    description: "基础可遗失护甲，本局提供 6 点防御。",
    costs: Object.freeze({ mechanical: 3, medical: 1 }),
    output: Object.freeze({ templateId: "field-armor", quantity: 1 }),
  }),
});

export const EXPEDITION_CAPACITY_UPGRADES = Object.freeze({
  warehouse: Object.freeze([
    Object.freeze({ level: 1, increase: 8, costs: Object.freeze({ mechanical: 4, intel: 1 }) }),
    Object.freeze({ level: 2, increase: 8, costs: Object.freeze({ mechanical: 7, core: 1 }) }),
    Object.freeze({ level: 3, increase: 12, costs: Object.freeze({ mechanical: 10, core: 2 }) }),
  ]),
  backpack: Object.freeze([
    Object.freeze({ level: 1, increase: 1, costs: Object.freeze({ mechanical: 3, medical: 2 }) }),
    Object.freeze({ level: 2, increase: 1, costs: Object.freeze({ mechanical: 6, pet: 2, core: 1 }) }),
  ]),
  safetyBag: Object.freeze([
    Object.freeze({ level: 1, increase: 1, costs: Object.freeze({ intel: 3, core: 1 }) }),
    Object.freeze({ level: 2, increase: 1, costs: Object.freeze({ intel: 6, core: 2 }) }),
  ]),
});

const MAIN_CONTRACT_CHAIN = Object.freeze([
  "main-supply-recovery",
  "main-investigate-vault",
]);

const inferPurposeCategory = item => {
  const explicit = String(item?.purposeCategory || item?.materialCategory || "");
  if (EXPEDITION_ITEM_PURPOSES[explicit]) return explicit;
  const type = String(item?.type || "");
  const equipSlot = String(item?.equipSlot || "");
  if (["mainWeapon", "weapon", "armor", "petLinker", "pet-linker"].includes(equipSlot)) return "equipment";
  if (type === "component") return "mechanical";
  if (["medical", "medicine", "medkit", "supply"].includes(type)) return "medical";
  if (["intel", "contract-material", "quest-material", "trophy"].includes(type)) return "intel";
  if (["pet-supply", "pet-material"].includes(type)) return "pet";
  if (["crystal", "relic", "deep-material", "boss-material"].includes(type)) return "core";
  if (["weapon", "armor", "equipment", "pet-linker", "petLinker", "pet-device"].includes(type)) return "equipment";
  if (["consumable", "ammo", "grenade"].includes(type)) return "consumable";
  if (type === "insurance-voucher") return "insurance";
  if (["currency", "valuable"].includes(type)) return "valuables";
  return "valuables";
};

export const EXPEDITION_ITEM_TEMPLATES = Object.freeze({
  "starter-carbine": Object.freeze({
    templateId: "starter-carbine",
    name: "制式训练武器",
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
    description: "始终可用且不会在远征失败时遗失；出发前选择射击模式，本局内保持锁定。",
  }),
  "contract-fragment": Object.freeze({
    templateId: "contract-fragment",
    name: "合约残片",
    type: "contract-material",
    purposeCategory: "intel",
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
    purposeCategory: "core",
    rarity: "rare",
    sellPrice: 55,
    score: 90,
    stackable: true,
    maxStack: 999,
    description: "来自远征深层区域的稀有研究材料。",
  }),
  "field-ammo-pack": Object.freeze({
    templateId: "field-ammo-pack",
    name: "通用弹药包",
    type: "ammo",
    purposeCategory: "consumable",
    rarity: "common",
    equipSlot: "consumable",
    sellPrice: 18,
    score: 28,
    stackable: true,
    maxStack: 12,
    ammoPackValue: 1,
    description: "装入行动物资栏，出发时补充一份备弹。",
  }),
  "field-ration": Object.freeze({
    templateId: "field-ration",
    name: "伙伴行动补给",
    type: "consumable",
    purposeCategory: "consumable",
    rarity: "uncommon",
    equipSlot: "consumable",
    supplyValue: 1,
    sellPrice: 24,
    score: 42,
    stackable: true,
    maxStack: 8,
    description: "装入行动补给栏，出发时转化为 1 份补给。",
  }),
  "insurance-voucher": Object.freeze({
    templateId: "insurance-voucher",
    name: "装备保险券",
    type: "insurance-voucher",
    purposeCategory: "insurance",
    rarity: "rare",
    sellPrice: 40,
    score: 80,
    stackable: true,
    maxStack: 20,
    description: "出发前为一件非永久配装承保一局。",
  }),
  "field-armor": Object.freeze({
    templateId: "field-armor",
    name: "拼装野战护甲",
    type: "armor",
    purposeCategory: "equipment",
    rarity: "uncommon",
    equipSlot: "armor",
    defenseBonus: 6,
    sellPrice: 60,
    score: 105,
    stackable: false,
    description: "基础可遗失护甲，本局提供 6 点防御。",
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
    matcher: Object.freeze({ purposeCategory: "mechanical" }),
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
    this.defaultBackpackCapacity = 8;
    this.defaultSafetyBagCapacity = 1;
    this.creditSettlementCurrency = creditSettlementCurrency !== false;
    this.contractBoardSize = Math.max(3, Math.min(5, asInteger(contractBoardSize, 4)));
    this.reset();
  }

  reset() {
    this.baseWarehouseCapacity = this.defaultWarehouseCapacity;
    this.capacityLevels = { warehouse: 0, backpack: 0, safetyBag: 0 };
    this.warehouseCapacity = this.baseWarehouseCapacity;
    this.backpackCapacity = this.defaultBackpackCapacity;
    this.safetyBagCapacity = this.defaultSafetyBagCapacity;
    this.itemSerial = 0;
    this.contractSerial = 0;
    this.boardSerial = 0;
    this.contractCycle = 0;
    this.raidSerial = 0;
    this.warehouse = [];
    this.deliveryInbox = [];
    this.loadout = this.createDefaultLoadout();
    this.selectedLoadoutInsurance = {};
    this.activeRaid = null;
    this.balances = { coins: 0, crystals: 0, rubies: 0, exp: 0 };
    this.activeContracts = [];
    this.contractHistory = [];
    this.contractBoard = [];
    this.contractOfferCooldowns = {};
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
    this.refreshContractBoard({ reason: "initial" });
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
    const purposeCategory = inferPurposeCategory(merged);
    const purpose = EXPEDITION_ITEM_PURPOSES[purposeCategory] || EXPEDITION_ITEM_PURPOSES.valuables;
    const item = {
      ...merged,
      instanceId,
      templateId,
      originId: merged.originId ?? merged.id ?? null,
      name: String(merged.name || templateId),
      type: String(merged.type || "loot"),
      purposeCategory,
      materialCategory: MATERIAL_PURPOSES.includes(purposeCategory) ? purposeCategory : null,
      purposeLabel: purpose.label,
      purposeUse: String(merged.purposeUse || purpose.use),
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

  getPurposeCount(purposeCategory) {
    const normalized = String(purposeCategory || "");
    return this.warehouse.reduce((total, item) => (
      item.purposeCategory === normalized ? total + Math.max(1, asInteger(item.quantity, 1)) : total
    ), 0);
  }

  getMaterialRequirementState(costs = {}, multiplier = 1) {
    const safeMultiplier = Math.max(1, asInteger(multiplier, 1));
    const requirements = Object.entries(costs)
      .filter(([purposeCategory]) => MATERIAL_PURPOSES.includes(purposeCategory))
      .map(([purposeCategory, amount]) => {
        const required = Math.max(0, asInteger(amount)) * safeMultiplier;
        const current = this.getPurposeCount(purposeCategory);
        return {
          purposeCategory,
          label: EXPEDITION_ITEM_PURPOSES[purposeCategory]?.label || purposeCategory,
          current,
          required,
          missing: Math.max(0, required - current),
          met: current >= required,
        };
      });
    return {
      requirements,
      ready: requirements.every(requirement => requirement.met),
    };
  }

  consumeMaterialCosts(costs = {}, multiplier = 1) {
    const state = this.getMaterialRequirementState(costs, multiplier);
    if (!state.ready) return { success: false, consumed: [], ...state };
    const consumed = [];
    for (const requirement of state.requirements) {
      const result = this.consumeMatchingItems(
        { purposeCategory: requirement.purposeCategory },
        requirement.required,
      );
      consumed.push(...result.consumed);
    }
    this.refreshInventoryContractProgress();
    return { success: true, consumed, ...state };
  }

  getCraftingRecipes() {
    return Object.values(EXPEDITION_WORKSHOP_RECIPES).map(recipe => {
      const requirementState = this.getMaterialRequirementState(recipe.costs);
      return {
        ...clone(recipe),
        ...requirementState,
        available: !this.activeRaid && requirementState.ready,
      };
    });
  }

  craftRecipe(recipeId, { quantity = 1 } = {}) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法使用工坊" };
    const recipe = EXPEDITION_WORKSHOP_RECIPES[String(recipeId || "")];
    if (!recipe) return { success: false, message: "未知工坊配方" };
    const safeQuantity = Math.max(1, Math.min(20, asInteger(quantity, 1)));
    const requirementState = this.getMaterialRequirementState(recipe.costs, safeQuantity);
    if (!requirementState.ready) {
      const missing = requirementState.requirements
        .filter(requirement => !requirement.met)
        .map(requirement => `${requirement.label} ${requirement.missing}`)
        .join("、");
      return { success: false, message: `制作材料不足：${missing}`, ...requirementState };
    }
    const consumption = this.consumeMaterialCosts(recipe.costs, safeQuantity);
    if (!consumption.success) return { success: false, message: "制作材料扣除失败", ...consumption };
    const output = {
      ...clone(recipe.output),
      quantity: Math.max(1, asInteger(recipe.output.quantity, 1)) * safeQuantity,
    };
    const deposit = this.depositItem(output, {
      source: `workshop-${recipe.id}`,
      allowPending: true,
    });
    return {
      success: deposit.success,
      message: (deposit.pending || []).length > 0
        ? `${recipe.name}制作完成，仓库已满并转入待领取箱`
        : `${recipe.name}制作完成`,
      recipe: clone(recipe),
      quantity: safeQuantity,
      consumed: consumption.consumed,
      output: deposit.item || this.createItem(output, { source: `workshop-${recipe.id}` }),
      deposit,
    };
  }

  recalculateFacilityCapacities() {
    const sumIncrease = id => EXPEDITION_CAPACITY_UPGRADES[id]
      .slice(0, Math.max(0, asInteger(this.capacityLevels[id])))
      .reduce((total, upgrade) => total + upgrade.increase, 0);
    this.warehouseCapacity = this.baseWarehouseCapacity + sumIncrease("warehouse");
    this.backpackCapacity = this.defaultBackpackCapacity + sumIncrease("backpack");
    this.safetyBagCapacity = this.defaultSafetyBagCapacity + sumIncrease("safetyBag");
    return {
      warehouseCapacity: this.warehouseCapacity,
      backpackCapacity: this.backpackCapacity,
      safetyBagCapacity: this.safetyBagCapacity,
    };
  }

  getFacilityUpgrades() {
    const labels = {
      warehouse: "仓库扩建",
      backpack: "行动背包",
      safetyBag: "安全袋",
    };
    return Object.fromEntries(Object.keys(EXPEDITION_CAPACITY_UPGRADES).map(id => {
      const level = Math.max(0, asInteger(this.capacityLevels[id]));
      const next = EXPEDITION_CAPACITY_UPGRADES[id][level] || null;
      const requirementState = next
        ? this.getMaterialRequirementState(next.costs)
        : { requirements: [], ready: false };
      const capacityKey = id === "warehouse"
        ? "warehouseCapacity"
        : id === "backpack"
          ? "backpackCapacity"
          : "safetyBagCapacity";
      return [id, {
        id,
        label: labels[id],
        level,
        maxLevel: EXPEDITION_CAPACITY_UPGRADES[id].length,
        capacity: this[capacityKey],
        next: next ? clone(next) : null,
        requirements: requirementState.requirements,
        available: !this.activeRaid && Boolean(next) && requirementState.ready,
      }];
    }));
  }

  upgradeFacility(facilityId) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法升级远征设施" };
    const aliases = {
      stash: "warehouse",
      safePocket: "safetyBag",
      insuredSlot: "safetyBag",
    };
    const id = aliases[String(facilityId || "")] || String(facilityId || "");
    const upgrades = EXPEDITION_CAPACITY_UPGRADES[id];
    if (!upgrades) return { success: false, message: "未知远征设施" };
    const level = Math.max(0, asInteger(this.capacityLevels[id]));
    const next = upgrades[level];
    if (!next) return { success: false, message: "该设施已达到最高等级" };
    const requirementState = this.getMaterialRequirementState(next.costs);
    if (!requirementState.ready) {
      const missing = requirementState.requirements
        .filter(requirement => !requirement.met)
        .map(requirement => `${requirement.label} ${requirement.missing}`)
        .join("、");
      return { success: false, message: `升级材料不足：${missing}`, ...requirementState };
    }
    const consumption = this.consumeMaterialCosts(next.costs);
    if (!consumption.success) return { success: false, message: "升级材料扣除失败", ...consumption };
    this.capacityLevels[id] = level + 1;
    const capacities = this.recalculateFacilityCapacities();
    return {
      success: true,
      message: `${this.getFacilityUpgrades()[id].label}升级至 Lv.${this.capacityLevels[id]}`,
      facilityId: id,
      level: this.capacityLevels[id],
      consumed: consumption.consumed,
      capacities,
      state: this.getFacilityUpgrades()[id],
    };
  }

  upgradeCapacity(facilityId) {
    return this.upgradeFacility(facilityId);
  }

  getCapacityState() {
    return {
      warehouseCapacity: this.warehouseCapacity,
      backpackCapacity: this.backpackCapacity,
      safetyBagCapacity: this.safetyBagCapacity,
      levels: { ...this.capacityLevels },
    };
  }

  expectedEquipSlot(item) {
    if (item.equipSlot) return item.equipSlot;
    if (item.type === "weapon") return "mainWeapon";
    if (item.type === "armor") return "armor";
    if (["pet-linker", "petLinker", "pet-device"].includes(item.type)) return "petLinker";
    if (["consumable", "medical", "ammo", "grenade", "supply"].includes(item.type)) return "consumable";
    return null;
  }

  setWeaponMode(combatWeaponId) {
    if (this.activeRaid) {
      return { success: false, message: "远征进行中，出发武器已经锁定" };
    }
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
    if (previous?.instanceId) delete this.selectedLoadoutInsurance[previous.instanceId];
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
    delete this.selectedLoadoutInsurance[current.instanceId];
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

  quoteLoadoutInsurance(instanceId) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法调整装备保险" };
    const item = this.getEquippedItems().find(entry => String(entry.instanceId) === String(instanceId));
    if (!item) return { success: false, message: "该物品不在当前配装中" };
    if (item.permanent || item.bound || item.keepOnFailure) {
      return { success: false, message: "该物品无需装备保险", item: clone(item) };
    }
    const premium = Math.max(1, Math.ceil(Math.max(0, Number(item.sellPrice) || 0) * 0.2));
    const voucherCount = this.getItemCount({ templateId: "insurance-voucher" });
    return {
      success: true,
      instanceId: item.instanceId,
      item: clone(item),
      premium,
      rate: 0.2,
      voucherCount,
      alreadyInsured: Boolean(this.selectedLoadoutInsurance[item.instanceId]),
    };
  }

  insureLoadoutItem(instanceId, {
    useVoucher = true,
    paidCoins = 0,
    useBalance = true,
  } = {}) {
    const quote = this.quoteLoadoutInsurance(instanceId);
    if (!quote.success) return quote;
    if (quote.alreadyInsured) {
      return {
        success: true,
        duplicate: true,
        message: `${quote.item.name}已投保`,
        insurance: clone(this.selectedLoadoutInsurance[quote.instanceId]),
      };
    }

    let payment = null;
    if (useVoucher && quote.voucherCount > 0) {
      const voucher = this.warehouse.find(item => item.templateId === "insurance-voucher");
      const consumed = this.withdrawItem(voucher.instanceId, { quantity: 1 });
      if (!consumed.success) return { success: false, message: "保险券扣除失败" };
      payment = { type: "voucher", amount: 1 };
    } else if (Math.max(0, asInteger(paidCoins)) >= quote.premium) {
      payment = { type: "external-coins", amount: quote.premium };
    } else if (useBalance && this.balances.coins >= quote.premium) {
      this.balances.coins -= quote.premium;
      payment = { type: "meta-balance", amount: quote.premium };
    } else {
      return {
        success: false,
        message: `需要 1 张装备保险券或 ${quote.premium} 金币保费`,
        quote,
      };
    }

    const insurance = {
      instanceId: quote.instanceId,
      itemName: quote.item.name,
      premium: quote.premium,
      rate: quote.rate,
      payment,
      selectedAtRaidSerial: this.raidSerial + 1,
    };
    this.selectedLoadoutInsurance[quote.instanceId] = insurance;
    return {
      success: true,
      message: `${quote.item.name}已投保，本次出发失败时不会遗失`,
      insurance: clone(insurance),
    };
  }

  cancelLoadoutInsurance(instanceId) {
    if (this.activeRaid) return { success: false, message: "远征进行中无法取消装备保险" };
    const insurance = this.selectedLoadoutInsurance[String(instanceId)];
    if (!insurance) return { success: false, message: "该物品尚未投保" };
    delete this.selectedLoadoutInsurance[String(instanceId)];
    return {
      success: true,
      message: "装备保险已取消；已支付保费不返还",
      insurance: clone(insurance),
    };
  }

  startRaid({ raidId = null, insuredLoadoutIds = [] } = {}) {
    if (this.activeRaid) return { success: false, message: "已有进行中的远征配装" };
    this.raidSerial += 1;
    const resolvedRaidId = String(raidId ?? `meta-raid-${this.raidSerial}`);
    const equippedIds = new Set(this.getEquippedItems().map(item => item.instanceId));
    const selectedIds = Object.keys(this.selectedLoadoutInsurance);
    const insuredIds = [...new Set([...(insuredLoadoutIds || []).map(String), ...selectedIds])]
      .filter(id => equippedIds.has(id) && id !== BASIC_WEAPON_INSTANCE_ID);
    this.activeRaid = {
      raidId: resolvedRaidId,
      insuredLoadoutIds: insuredIds,
      insurance: insuredIds
        .map(id => this.selectedLoadoutInsurance[id])
        .filter(Boolean)
        .map(clone),
      loadoutSnapshot: this.getLoadout(),
      capacities: this.getCapacityState(),
    };
    this.selectedLoadoutInsurance = {};
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
    const refreshedContractBoard = this.refreshContractBoard({
      advanceCycle: true,
      reason: "settlement",
    });

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
      contractCycle: this.contractCycle,
      refreshedContractBoard,
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
    if (matcher.purposeCategory && item.purposeCategory !== matcher.purposeCategory) return false;
    if (matcher.materialCategory && item.materialCategory !== matcher.materialCategory) return false;
    if (Array.isArray(matcher.types) && !matcher.types.includes(item.type)) return false;
    if (Array.isArray(matcher.purposeCategories) && !matcher.purposeCategories.includes(item.purposeCategory)) return false;
    if (Array.isArray(matcher.tags) && !matcher.tags.every(tag => (item.tags || []).includes(tag))) return false;
    return true;
  }

  getNextMainContractTemplate() {
    const completed = new Set(this.contractHistory
      .filter(contract => contract.category === "main" && contract.status === "completed")
      .map(contract => contract.templateId));
    const furthestCompletedIndex = MAIN_CONTRACT_CHAIN.reduce((furthest, templateId, index) => (
      completed.has(templateId) ? Math.max(furthest, index) : furthest
    ), -1);
    const active = new Set(this.activeContracts
      .filter(contract => contract.category === "main")
      .map(contract => contract.templateId));
    if (active.size > 0) return null;
    const nextId = MAIN_CONTRACT_CHAIN[furthestCompletedIndex + 1] || null;
    if (!nextId) return null;
    return EXPEDITION_CONTRACT_TEMPLATES[nextId] || null;
  }

  refreshContractBoard({ advanceCycle = false, reason = "manual" } = {}) {
    if (advanceCycle) this.contractCycle += 1;
    const activeTemplateIds = new Set(this.activeContracts.map(contract => contract.templateId));
    const completedThisCycle = new Set(this.contractHistory
      .filter(contract => contract.category === "side" && contract.completedCycle === this.contractCycle)
      .map(contract => contract.templateId));
    const sideTemplates = Object.values(EXPEDITION_CONTRACT_TEMPLATES)
      .filter(template => template.category === "side")
      .filter(template => !activeTemplateIds.has(template.id))
      .filter(template => !completedThisCycle.has(template.id))
      .filter(template => asInteger(this.contractOfferCooldowns[template.id]) <= this.contractCycle);
    const start = sideTemplates.length
      ? this.contractCycle % sideTemplates.length
      : 0;
    const rotatedSides = sideTemplates.length
      ? [...sideTemplates.slice(start), ...sideTemplates.slice(0, start)]
      : [];
    const nextMain = this.getNextMainContractTemplate();
    const templates = [
      ...(nextMain ? [nextMain] : []),
      ...rotatedSides,
    ];
    this.boardSerial += 1;
    this.contractBoard = templates.slice(0, this.contractBoardSize).map((template, index) => ({
      offerId: `contract-offer-${this.boardSerial}-${index + 1}`,
      templateId: template.id,
      category: template.category,
      title: template.title,
      description: template.description,
      reward: clone(template.reward),
      cycle: this.contractCycle,
      refreshReason: reason,
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
      acceptedCycle: this.contractCycle,
    };
    this.activeContracts.push(contract);
    this.contractBoard = this.contractBoard.filter(entry => entry.templateId !== template.id);
    this.refreshInventoryContractProgress();
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
        const locationMatches = !required || String(event.locationId) === String(required);
        const typeMatches = !requiredType || String(event.locationType) === String(requiredType);
        if (locationMatches && typeMatches) increment = 1;
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
    contract.completedCycle = this.contractCycle;
    this.activeContracts.splice(index, 1);
    this.contractHistory.push(clone(contract));
    this.stats.contractsCompleted += 1;
    this.refreshInventoryContractProgress();
    if (contract.category === "main") this.refreshContractBoard({ reason: "main-chain" });
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
    contract.status = "abandoned";
    contract.abandonedCycle = this.contractCycle;
    this.contractOfferCooldowns[contract.templateId] = this.contractCycle + 1;
    this.contractHistory.push(clone(contract));
    this.contractBoard = this.contractBoard.filter(entry => entry.templateId !== contract.templateId);
    return {
      success: true,
      contract: clone(contract),
      message: `已放弃“${contract.title}”；完成下一次远征后才会补充新委托`,
    };
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
      cycle: this.contractCycle,
      nextRefresh: "settlement",
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
        baseWarehouseCapacity: this.baseWarehouseCapacity,
        warehouseCapacity: this.warehouseCapacity,
        defaultBackpackCapacity: this.defaultBackpackCapacity,
        defaultSafetyBagCapacity: this.defaultSafetyBagCapacity,
        creditSettlementCurrency: this.creditSettlementCurrency,
        contractBoardSize: this.contractBoardSize,
      },
      capacityLevels: this.capacityLevels,
      serials: {
        item: this.itemSerial,
        contract: this.contractSerial,
        board: this.boardSerial,
        contractCycle: this.contractCycle,
        raid: this.raidSerial,
      },
      warehouse: this.warehouse,
      deliveryInbox: this.deliveryInbox,
      loadout: this.loadout,
      selectedLoadoutInsurance: this.selectedLoadoutInsurance,
      activeRaid: this.activeRaid,
      balances: this.balances,
      activeContracts: this.activeContracts,
      contractHistory: this.contractHistory,
      contractBoard: this.contractBoard,
      contractOfferCooldowns: this.contractOfferCooldowns,
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
    const incomingVersion = Math.max(0, asInteger(saved.version));

    this.reset();
    const savedCapacityLevels = saved.capacityLevels && typeof saved.capacityLevels === "object"
      ? saved.capacityLevels
      : {};
    this.capacityLevels = {
      warehouse: Math.max(0, Math.min(
        EXPEDITION_CAPACITY_UPGRADES.warehouse.length,
        asInteger(savedCapacityLevels.warehouse),
      )),
      backpack: Math.max(0, Math.min(
        EXPEDITION_CAPACITY_UPGRADES.backpack.length,
        asInteger(savedCapacityLevels.backpack),
      )),
      safetyBag: Math.max(0, Math.min(
        EXPEDITION_CAPACITY_UPGRADES.safetyBag.length,
        asInteger(savedCapacityLevels.safetyBag),
      )),
    };
    const legacyWarehouseCapacity = Math.max(
      4,
      asInteger(saved.config?.warehouseCapacity ?? saved.warehouseCapacity, this.defaultWarehouseCapacity),
    );
    this.baseWarehouseCapacity = Math.max(
      4,
      asInteger(saved.config?.baseWarehouseCapacity, legacyWarehouseCapacity),
    );
    this.defaultBackpackCapacity = Math.max(
      3,
      asInteger(saved.config?.defaultBackpackCapacity, this.defaultBackpackCapacity),
    );
    this.defaultSafetyBagCapacity = Math.max(
      1,
      asInteger(saved.config?.defaultSafetyBagCapacity, this.defaultSafetyBagCapacity),
    );
    this.recalculateFacilityCapacities();
    this.creditSettlementCurrency = saved.config?.creditSettlementCurrency ?? this.creditSettlementCurrency;
    this.contractBoardSize = Math.max(3, Math.min(5, asInteger(saved.config?.contractBoardSize, this.contractBoardSize)));
    this.itemSerial = clampNonNegative(saved.serials?.item ?? saved.itemSerial);
    this.contractSerial = clampNonNegative(saved.serials?.contract ?? saved.contractSerial);
    this.boardSerial = clampNonNegative(saved.serials?.board ?? saved.boardSerial);
    this.contractCycle = clampNonNegative(saved.serials?.contractCycle ?? saved.contractCycle);
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
    const equippedIds = new Set(this.getEquippedItems().map(item => String(item.instanceId)));
    this.selectedLoadoutInsurance = Object.fromEntries(Object.entries(
      saved.selectedLoadoutInsurance && typeof saved.selectedLoadoutInsurance === "object"
        ? saved.selectedLoadoutInsurance
        : {},
    ).filter(([instanceId]) => equippedIds.has(String(instanceId))));
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
    this.contractOfferCooldowns = saved.contractOfferCooldowns && typeof saved.contractOfferCooldowns === "object"
      ? Object.fromEntries(Object.entries(saved.contractOfferCooldowns)
        .map(([templateId, cycle]) => [templateId, clampNonNegative(cycle)]))
      : {};
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
    if (incomingVersion < 2 || !this.contractBoard.length) {
      this.refreshContractBoard({ reason: incomingVersion < 2 ? "v2-migration" : "restore-empty" });
    }
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
      capacities: this.getCapacityState(),
      crafting: {
        recipes: this.getCraftingRecipes(),
        materialCounts: Object.fromEntries(MATERIAL_PURPOSES.map(id => [id, this.getPurposeCount(id)])),
      },
      facilityUpgrades: this.getFacilityUpgrades(),
      loadout: this.loadout,
      insurance: {
        rate: 0.2,
        selected: Object.values(this.selectedLoadoutInsurance),
        activeRaidInsuredIds: this.activeRaid?.insuredLoadoutIds || [],
        voucherCount: this.getItemCount({ templateId: "insurance-voucher" }),
      },
      activeRaid: this.activeRaid,
      balances: this.balances,
      contracts: this.getContractState(),
      stats: this.stats,
      settlementCount: Object.keys(this.settlementLedger).length,
      migrations: this.migrations,
    });
  }
}
