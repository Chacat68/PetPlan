import assert from "node:assert/strict";

import { ProgressionSystem } from "../js/modules/progression-system.js";
import { SaveSystem } from "../js/modules/save-system.js";
import { SceneRouter } from "../js/modules/scene-router.js";
import { TerritorySystem } from "../js/modules/territory-system.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

function createSystemStub(saveData = {}) {
  return {
    loaded: null,
    getSaveData: () => saveData,
    loadSaveData(data) {
      this.loaded = data;
    },
  };
}

function createResourceStub() {
  return {
    coins: 1000,
    crystals: 100,
    hasEnoughCoins(amount) {
      return this.coins >= amount;
    },
    hasEnoughCrystals(amount) {
      return this.crystals >= amount;
    },
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
    addCoins(amount) {
      this.coins += amount;
    },
    addCrystals(amount) {
      this.crystals += amount;
    },
  };
}

function testProgressionGuide() {
  const progression = new ProgressionSystem();

  assert.deepEqual(
    {
      id: progression.getFirstSessionGuide({}).id,
      current: progression.getFirstSessionGuide({}).current,
    },
    { id: "flip", current: 1 }
  );
  assert.equal(
    progression.getFirstSessionGuide({ totalFlips: 8 }).current,
    2
  );
  assert.equal(
    progression.getFirstSessionGuide({
      totalFlips: 8,
      fateCoins: 2,
      assistants: 1,
      expeditionDepth: 1,
      extractions: 1,
      buildings: 1,
    }).complete,
    true
  );

  const outOfOrder = progression.getFirstSessionGuide({
    fateCoins: 2,
    assistants: 1,
    expeditionDepth: 1,
    extractions: 1,
    buildings: 1,
  });
  assert.equal(outOfOrder.id, "flip");
  assert.equal(outOfOrder.current, 1);
  assert.equal(outOfOrder.completedCount, 5);

  const path = progression.getPathSummary({ assistants: 2 });
  assert.equal(path.leadingPath?.id, "companion");
  assert.equal(progression.getRecommendationBoost("assistant", path), 14);
}

function testTerritoryPacingAndPersistence() {
  const resource = createResourceStub();
  const territory = new TerritorySystem(resource, null);

  territory.setProgressContext({ equippedPets: 1 });
  let summary = territory.getProgressSummary();
  assert.equal(summary.pulse, 0);
  assert.equal(summary.stage, 0);
  assert.equal(summary.unlockedSlots, 1);

  territory.setProgressContext({ totalFlips: 8, equippedPets: 1 });
  summary = territory.getProgressSummary();
  assert.equal(summary.pulse, 8);
  assert.equal(summary.stage, 0);
  assert.equal(summary.unlockedSlots, 1);

  territory.setProgressContext({
    totalFlips: 50,
    fateCoins: 2,
    assistants: 1,
    equippedPets: 1,
  });
  summary = territory.getProgressSummary();
  assert.equal(summary.pulse, 66);
  assert.equal(summary.stage, 0);
  assert.equal(summary.unlockedSlots, 1);

  let persistCalls = 0;
  territory.setOnPersist(() => {
    persistCalls += 1;
  });
  const buildResult = territory.buildBuilding("main_base", 0);
  assert.equal(buildResult.success, true);
  assert.equal(territory.getProgressSummary().rank, 1);
  assert.equal(territory.getProgressSummary().unlockedSlots, 4);
  assert.equal(persistCalls, 1);
}

async function testSaveMigration() {
  globalThis.localStorage = new MemoryStorage();

  const resource = createSystemStub({ coins: 5 });
  const territory = createSystemStub({ buildings: [] });
  const player = createSystemStub({ player: { level: 1 } });
  player.player = { level: 1 };
  const combat = createSystemStub({});
  const pet = createSystemStub({ unlockedPets: [] });
  const fate = createSystemStub({ fateCoins: 1 });
  const progression = createSystemStub({ claimedAchievementIds: [] });
  progression.loaded = { claimedAchievementIds: ["stale"] };

  const saveSystem = new SaveSystem();
  saveSystem.setGameSystems({
    player,
    resource,
    combat,
    pet,
    territory,
    fate,
    progression,
  });

  localStorage.setItem(
    "petplan_save_slot1",
    JSON.stringify({
      version: "1.0.0",
      timestamp: 100,
      player: { player: { level: 3 } },
      resources: { coins: 321, rubies: 4, crystals: 5 },
      combat: { currentWave: 2 },
      pets: { unlockedPets: [] },
      territory: { buildings: [], unlockedSlots: 1 },
    })
  );

  assert.equal(await saveSystem.loadGame(1), true);
  assert.equal(resource.loaded.coins, 321);
  assert.deepEqual(fate.loaded, {});
  assert.deepEqual(progression.loaded, {});

  const migrated = JSON.parse(localStorage.getItem("petplan_save_1"));
  assert.equal(migrated.version, "1.5.0");
  assert.equal(migrated.data.resource.coins, 321);
  assert.ok(localStorage.getItem("petplan_save_slot1"));

  localStorage.setItem(
    "petplan_save_2",
    JSON.stringify({
      version: "1.0.0",
      timestamp: 200,
      resources: { coins: 222 },
      player: { player: { level: 2 } },
    })
  );
  assert.equal(await saveSystem.loadGame(2), true);
  assert.ok(localStorage.getItem("petplan_save_2_legacy_backup"));

  assert.equal(
    saveSystem.normalizeSaveData({ version: "1.0.0", timestamp: 1 }, 3),
    null
  );
  assert.equal(await saveSystem.saveGame(3), true);
  const modern = JSON.parse(localStorage.getItem("petplan_save_3"));
  assert.ok(modern.data.progression);
}

function testSceneNormalization() {
  let currentUrl = new URL(
    "http://localhost:4174/index.html?scene=bogus&debug=1#status"
  );
  let replaceCalls = 0;

  const syncLocation = () => {
    window.location.href = currentUrl.href;
    window.location.pathname = currentUrl.pathname;
    window.location.search = currentUrl.search;
    window.location.hash = currentUrl.hash;
  };

  globalThis.window = {
    location: {},
    history: {
      pushState(_state, _title, nextLocation) {
        currentUrl = new URL(nextLocation, currentUrl);
        syncLocation();
      },
      replaceState(_state, _title, nextLocation) {
        replaceCalls += 1;
        currentUrl = new URL(nextLocation, currentUrl);
        syncLocation();
      },
    },
    addEventListener() {},
  };
  globalThis.document = { querySelectorAll: () => [] };
  syncLocation();

  const router = new SceneRouter();
  assert.equal(
    router.getRequestedScene("fate", { normalize: true }),
    "fate"
  );
  assert.equal(replaceCalls, 1);
  assert.equal(currentUrl.searchParams.has("scene"), false);
  assert.equal(currentUrl.searchParams.get("debug"), "1");
  assert.equal(currentUrl.hash, "#status");

  router.writeSceneToLocation("territory");
  assert.equal(currentUrl.searchParams.get("scene"), "territory");
}

testProgressionGuide();
testTerritoryPacingAndPersistence();
await testSaveMigration();
testSceneNormalization();

console.log("phase-one smoke: ok");
