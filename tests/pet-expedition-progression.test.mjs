import test from "node:test";
import assert from "node:assert/strict";

import { ACHIEVEMENT_DEFINITIONS } from "../js/modules/achievement-config.js";
import { AchievementSystem } from "../js/modules/achievement-system.js";
import { PetSystem } from "../js/modules/pet-system.js";
import { EXPEDITION_MILESTONE_REWARD_CONFIG } from "../js/modules/progression-config.js";
import { TerritorySystem } from "../js/modules/territory-system.js";

globalThis.Image ||= class ImageStub {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
  }
  set src(value) { this._src = value; }
  get src() { return this._src; }
};

const createResources = () => ({
  coins: 100_000,
  crystals: 100_000,
  rubies: 0,
  hasEnoughCoins(amount) { return this.coins >= amount; },
  hasEnoughCrystals(amount) { return this.crystals >= amount; },
  hasEnoughRubies(amount) { return this.rubies >= amount; },
  spendCoins(amount) { this.coins -= amount; return true; },
  spendCrystals(amount) { this.crystals -= amount; return true; },
  spendRubies(amount) { this.rubies -= amount; return true; },
  addCoins(amount) { this.coins += amount; },
  addCrystals(amount) { this.crystals += amount; },
  addRubies(amount) { this.rubies += amount; },
});

test("参战宠物从远征结算获得经验、等级与羁绊", () => {
  const pets = new PetSystem();
  pets.loadSaveData({
    unlockedPets: [
      { instanceId: "fire", templateId: 1, level: 1, exp: 60, friendship: 10 },
      { instanceId: "ice", templateId: 2, level: 2, experience: 5, friendship: 99 },
    ],
    equippedPets: ["fire", "ice"],
  });

  const result = pets.awardExpeditionProgress({
    extracted: true,
    depth: 5,
    kills: 10,
    bossKills: 1,
  });

  assert.equal(result.count, 2);
  assert.ok(result.plannedExperience > 0);
  assert.ok(result.levelsGained >= 1);
  assert.equal(pets.unlockedPets[0].level > 1, true);
  assert.equal(pets.unlockedPets[0].friendship > 10, true);
  assert.equal(pets.unlockedPets[1].friendship, 100);
  assert.equal(pets.getSaveData().schemaVersion, 2);
  assert.equal(Number.isFinite(pets.unlockedPets[1].exp), true, "旧 experience 字段应迁移为 exp");
});

test("宠物生命与防御生成护卫减伤，凤凰提供一次救援契约", () => {
  const pets = new PetSystem();
  pets.loadSaveData({
    unlockedPets: [
      { instanceId: "bear", templateId: 4, level: 6, exp: 0, friendship: 60 },
      { instanceId: "phoenix", templateId: 8, level: 8, exp: 0, friendship: 80 },
    ],
    equippedPets: ["bear", "phoenix"],
  });

  const snapshot = pets.getExpeditionSquadSnapshot();
  assert.equal(snapshot.members[0].role.id, "guardian");
  assert.ok(snapshot.guardCapacity > 0);
  assert.ok(snapshot.damageReduction > 0 && snapshot.damageReduction <= 0.28);
  assert.equal(snapshot.rescue.skillName, "浴火重生");
  assert.equal(snapshot.rescue.oncePerExpedition, true);
  assert.deepEqual(pets.tryExpeditionRescue({ maxHp: 200, rescueUsed: true }).rescued, false);
  const rescue = pets.tryExpeditionRescue({ maxHp: 200 });
  assert.equal(rescue.rescued, true);
  assert.equal(rescue.hp, 90);
  assert.ok(rescue.invulnerabilityMs > 0);
});

test("分阶段远征里程碑足以支撑完整宠物收集路线", () => {
  const petRubyCosts = new PetSystem().petTemplates.reduce(
    (total, pet) => total + (pet.cost.rubies || 0),
    0,
  );
  const milestoneRubies = ACHIEVEMENT_DEFINITIONS.reduce(
    (total, achievement) => total + (achievement.reward.rubies || 0),
    0,
  );
  assert.ok(milestoneRubies + 50 >= petRubyCosts);
  assert.ok(EXPEDITION_MILESTONE_REWARD_CONFIG.length >= 15);
  assert.ok(Math.max(...EXPEDITION_MILESTONE_REWARD_CONFIG.map(item => item.rubies)) <= 450);

  const earlyExpeditionRubies = ACHIEVEMENT_DEFINITIONS
    .filter(definition => {
      const limits = {
        bestExtractedDepth: 5,
        extractions: 10,
        bossKills: 1,
        flawlessExtractions: 1,
        bestValue: 1500,
        maxExpeditionPetCount: 3,
      };
      return definition.metric in limits && definition.target <= limits[definition.metric];
    })
    .reduce((total, definition) => total + (definition.reward.rubies || 0), 0);
  assert.ok(earlyExpeditionRubies >= 450, "中期前应能支付前三只付费宠物的累计红宝石成本");
});

test("远征深度、Boss、无伤、价值与宠物编队里程碑均可锁存", () => {
  const achievements = new AchievementSystem({ now: () => 123 });
  achievements.updateProgress({
    bestExtractedDepth: 8,
    extractions: 25,
    bossKills: 5,
    flawlessExtractions: 5,
    bestValue: 4000,
    maxExpeditionPetCount: 3,
  }, { notify: false });

  for (const id of [
    "extracted_depth_8",
    "extraction_25",
    "boss_5",
    "flawless_5",
    "value_4000",
    "expedition_pet_team",
  ]) assert.equal(achievements.getItem(id).completed, true, id);

  const legacy = new AchievementSystem();
  legacy.loadSaveData({
    schemaVersion: 1,
    highWaterMarks: { bestDepth: 5, extractions: 2, bossesDefeated: 1 },
  });
  legacy.updateProgress({}, { notify: false });
  assert.equal(legacy.getItem("extracted_depth_5").completed, true);
  assert.equal(legacy.getItem("boss_1").completed, true);
});

test("领地升阶只接受成功撤离深度，并兼容有撤离记录的旧上下文", () => {
  const territory = new TerritorySystem(createResources(), null);
  territory.setOnPersist(() => {});
  territory.debugBuildBuilding("main_base");
  territory.debugBuildBuilding("training_ground");
  territory.debugBuildBuilding("temple");
  territory.debugBuildBuilding("workshop");
  territory.setProgressContext({ bestDepth: 8, bestExtractedDepth: 2, extractions: 5 });
  assert.equal(territory.expandTerritory().success, true);
  territory.getBuildingByType("training_ground").level = 2;
  territory.getBuildingByType("temple").level = 2;
  territory.getBuildingByType("workshop").level = 2;

  let depthCheck = territory.getRankRequirementState(3).checks
    .find(check => check.metric === "bestExtractedDepth");
  assert.equal(depthCheck.value, 2);
  assert.equal(depthCheck.met, false, "失败到达区域 8 不得解锁升阶");

  territory.setProgressContext({ bestDepth: 8, bestExtractedDepth: 5, extractions: 5 });
  depthCheck = territory.getRankRequirementState(3).checks
    .find(check => check.metric === "bestExtractedDepth");
  assert.equal(depthCheck.met, true);

  const legacy = new TerritorySystem(createResources(), null);
  legacy.setProgressContext({ bestDepth: 6, extractions: 2 });
  assert.equal(legacy.progressContext.bestExtractedDepth, 6);
  const failedOnly = new TerritorySystem(createResources(), null);
  failedOnly.setProgressContext({ bestDepth: 8, extractions: 0 });
  assert.equal(failedOnly.progressContext.bestExtractedDepth, 0);
});
