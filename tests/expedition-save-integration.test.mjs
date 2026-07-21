import assert from "node:assert/strict";
import test from "node:test";

const { SaveSystem } = await import("../js/modules/save-system.js");
const { ExpeditionMetaSystem } = await import("../js/modules/expedition-meta-system.js");
const { SettingsController } = await import("../js/controllers/settings-controller.js");

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test("1.5 存档持久化局外仓库，并在恢复战斗前先恢复 Meta", async () => {
  const previousStorage = globalThis.localStorage;
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  try {
    const meta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
    meta.depositItem({ name: "测试机械件", type: "component", quantity: 1, score: 20 });
    const save = new SaveSystem();
    save.setGameSystems({
      player: { player: { level: 3 }, getSaveData() { return { level: 3 }; } },
      combat: { getSaveData() { return { meta: { contractFragments: 0 } }; } },
      expeditionMeta: meta,
    });
    assert.equal(await save.saveGame(1), true);
    const stored = JSON.parse(storage.getItem("petplan_save_1"));
    assert.equal(stored.version, "1.5.0");
    assert.equal(stored.data.expeditionMeta.warehouse.length, 1);

    const restoredMeta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
    const order = [];
    const restoredSave = new SaveSystem();
    restoredSave.setGameSystems({
      expeditionMeta: {
        loadSaveData(data) { order.push("meta"); return restoredMeta.loadSaveData(data); },
      },
      combat: {
        loadSaveData() {
          order.push("combat");
          assert.equal(restoredMeta.getState().warehouseUsed, 1);
        },
      },
    });
    assert.equal(await restoredSave.loadGame(1), true);
    assert.deepEqual(order, ["meta", "combat"]);
  } finally {
    globalThis.localStorage = previousStorage;
  }
});
test("旧 Combat 长期材料计数迁移成真实仓库物品", async () => {
  const previousStorage = globalThis.localStorage;
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  try {
    storage.setItem("petplan_save_2", JSON.stringify({
      version: "1.4.0",
      timestamp: Date.now(),
      data: {
        combat: { meta: { contractFragments: 3, deepMaterials: 2 } },
      },
    }));
    const meta = new ExpeditionMetaSystem({ creditSettlementCurrency: false });
    const save = new SaveSystem();
    save.setGameSystems({ expeditionMeta: meta, combat: { loadSaveData() {} } });
    assert.equal(await save.loadGame(2), true);
    assert.equal(meta.getItemCount({ templateId: "contract-fragment" }), 3);
    assert.equal(meta.getItemCount({ templateId: "deep-material" }), 2);
    const migrated = JSON.parse(storage.getItem("petplan_save_2"));
    assert.equal(migrated.version, "1.5.0");
    assert.ok(migrated.data.expeditionMeta);
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("活动远征中快速读档会被拦截，避免回档复制战利品", async () => {
  let loadCalls = 0;
  const toasts = [];
  const controller = new SettingsController({
    combatSystem: { runSystem: { active: true } },
    saveSystem: { async loadGame() { loadCalls += 1; return true; } },
    uiSystem: { showToast(message) { toasts.push(message); } },
  });
  assert.equal(await controller.quickLoad(), false);
  assert.equal(loadCalls, 0);
  assert.match(toasts[0], /远征进行中不能读取旧存档/);
});
