import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

globalThis.Image = class ImageStub {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.onload = null;
    this.onerror = null;
  }

  set src(value) {
    this._src = value;
  }

  get src() {
    return this._src;
  }
};

const { ExpeditionRunSystem } = await import(
  "../js/modules/expedition-run-system.js"
);
const { CombatSystem } = await import("../js/modules/combat-system.js");
const { PetSystem } = await import("../js/modules/pet-system.js");
const { PlayerSystem } = await import("../js/modules/player-system.js");

const fixedRandom = () => 0.5;

test("全部战斗动作表保持 12 帧和 256 像素单帧协议", () => {
  const manifest = JSON.parse(readFileSync(
    new URL("../images/sprites/battle/animation-manifest.json", import.meta.url),
    "utf8",
  ));

  assert.equal(manifest.units.length, 45);
  assert.equal(manifest.frameCount, 12);
  assert.equal(manifest.frameSize, 256);
  assert.deepEqual(manifest.states, ["idle", "move", "attack"]);
  assert.equal(manifest.portraits.length, 15);

  manifest.units.forEach((entry) => {
    assert.equal(entry.frameCount, 12, entry.path);
    assert.equal(entry.frameSize, 256, entry.path);
    assert.equal(entry.frames.length, 12, entry.path);

    const png = readFileSync(new URL(`../${entry.path}`, import.meta.url));
    assert.equal(png.toString("ascii", 1, 4), "PNG", entry.path);
    assert.equal(png.readUInt32BE(16), 3072, entry.path);
    assert.equal(png.readUInt32BE(20), 256, entry.path);
  });

  manifest.portraits.forEach((entry) => {
    const png = readFileSync(new URL(`../${entry.path}`, import.meta.url));
    assert.equal(png.toString("ascii", 1, 4), "PNG", entry.path);
    assert.equal(png.readUInt32BE(16), 256, entry.path);
    assert.equal(png.readUInt32BE(20), 256, entry.path);
  });

  const heroMove = manifest.units.find((entry) => (
    entry.category === "hero" && entry.unit === "hero" && entry.state === "move"
  ));
  assert.ok(heroMove, "动作清单应包含主角跑步序列");
  const horizontalCenters = heroMove.frames.map((frame) => (
    (frame.bodyBounds[0] + frame.bodyBounds[2]) / 2
  ));
  const headAnchors = heroMove.frames.map((frame) => frame.bodyBounds[1]);
  assert.ok(
    Math.max(...horizontalCenters) - Math.min(...horizontalCenters) <= 1,
    "主角跑步水平中心漂移应控制在 1px 内",
  );
  assert.ok(
    Math.max(...headAnchors) - Math.min(...headAnchors) <= 3,
    "主角跑步头部锚点抖动应控制在 3px 内",
  );

  const movingUnits = manifest.units.filter((entry) => entry.state === "move");
  movingUnits.forEach((entry) => {
    const centers = entry.frames.map((frame) => (
      (frame.bodyBounds[0] + frame.bodyBounds[2]) / 2
    ));
    const tops = entry.frames.map((frame) => frame.bodyBounds[1]);
    assert.ok(
      Math.max(...centers) - Math.min(...centers) <= 4,
      `${entry.path} 跑动水平中心漂移应控制在 4px 内`,
    );
    assert.ok(
      Math.max(...tops) - Math.min(...tops) <= 5,
      `${entry.path} 跑动头部波动应控制在 5px 内`,
    );
  });

  const heroAttack = manifest.units.find((entry) => (
    entry.category === "hero" && entry.unit === "hero" && entry.state === "attack"
  ));
  const heroIdle = manifest.units.find((entry) => (
    entry.category === "hero" && entry.unit === "hero" && entry.state === "idle"
  ));
  const attackAnchors = heroAttack.frames.map((frame) => ({
    x: (frame.bodyBounds[0] + frame.bodyBounds[2]) / 2,
    y: frame.bodyBounds[1],
  }));
  const attackSteps = attackAnchors.slice(1).map((anchor, index) => Math.hypot(
    anchor.x - attackAnchors[index].x,
    anchor.y - attackAnchors[index].y,
  ));
  const idleAnchor = {
    x: (heroIdle.frames[0].bodyBounds[0] + heroIdle.frames[0].bodyBounds[2]) / 2,
    y: heroIdle.frames[0].bodyBounds[1],
  };
  const attackEnd = attackAnchors.at(-1);
  assert.ok(Math.max(...attackSteps) <= 12, "主角攻击单帧锚点跳动应控制在 12px 内");
  assert.ok(
    Math.hypot(attackEnd.x - idleAnchor.x, attackEnd.y - idleAnchor.y) <= 7,
    "主角攻击收尾应平滑衔接待机动作",
  );
});

function createLoot(id, score) {
  return {
    id,
    name: id,
    rarity: "common",
    rarityLabel: "普通",
    coins: score,
    crystals: 0,
    exp: 0,
    score,
  };
}

function createCombatHarness() {
  const resourceTotals = { coins: 0, crystals: 0 };
  const experience = { total: 0 };
  const playerSystem = {
    player: {
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      level: 1,
      hp: 100,
      maxHp: 100,
      attack: 24,
      defense: 2,
      attackSpeed: 1,
      crit: 0,
      critDamage: 150,
      multiShot: 1,
    },
    playAttackAnimation() {},
    getGunMuzzlePosition() {
      return {
        x: this.player.x + this.player.width / 2,
        y: this.player.y + this.player.height / 2,
      };
    },
    addExperience(amount) {
      experience.total += amount;
    },
  };
  const resourceSystem = {
    addCoins(amount) {
      resourceTotals.coins += amount;
    },
    addCrystals(amount) {
      resourceTotals.crystals += amount;
    },
  };
  const pet = {
    instanceId: 101,
    templateId: 1,
    level: 1,
    friendship: 0,
    equipped: true,
  };
  const petSystem = new PetSystem();
  petSystem.unlockedPets = [pet];
  petSystem.equippedPets = [pet];
  const territorySystem = {
    calculateBonuses() {
      return { attack: 3, defense: 4, expBonus: 10 };
    },
  };

  const combat = new CombatSystem({
    random: fixedRandom,
    runOptions: { maxDepth: 4, minExtractionDepth: 1 },
  });
  combat.mapWidth = 480;
  combat.mapHeight = 800;
  combat.setPlayerSystem(playerSystem);
  combat.setResourceSystem(resourceSystem);
  combat.setTerritorySystem(territorySystem);
  combat.setPetSystem(petSystem);
  combat.resetBattle();
  combat.isPaused = false;

  return {
    combat,
    playerSystem,
    resourceTotals,
    experience,
    petSystem,
  };
}

function startCombatEncounter(combat) {
  const startResult = combat.startRun();
  assert.equal(startResult.success, true);

  const combatNode = combat
    .getBattleState()
    .routeChoices.find((node) => node.type === "combat");
  assert.ok(combatNode, "首层路线应提供一个可验证的战斗节点");

  const routeResult = combat.chooseRoute(combatNode.id);
  assert.equal(routeResult.success, true);
  assert.equal(combat.getBattleState().phase, "combat");

  combat.update(1);
  assert.ok(combat.monsters.length > 0, "进入遭遇后应生成首个敌人");
  return combat.monsters[0];
}

test("角色、怪物和宠物统一使用 12 帧动作并让宠物攻击从首帧完整播放", () => {
  const playerSystem = new PlayerSystem();
  const petSystem = new PetSystem();
  const combatSystem = new CombatSystem({ random: fixedRandom });
  const attackState = {
    phaseTime: 0,
    attackDuration: 320,
    animationOffset: 0,
  };

  assert.equal(playerSystem.spriteFrameCount, 12);
  assert.equal(playerSystem.playerSprites.idle.frameCount, 12);
  assert.equal(playerSystem.playerSprites.move.frameCount, 12);
  assert.equal(playerSystem.playerSprites.attack.frameCount, 12);
  assert.match(playerSystem.playerImage.src, /images\/portraits\/hero\/hero\.png/);
  assert.match(playerSystem.playerImage.src, /stable-actions-20260721c/);
  assert.match(playerSystem.playerSprites.move.image.src, /stable-actions-20260721c/);
  assert.equal(playerSystem.playerSprites.idle.frameDuration, 96);
  assert.equal(playerSystem.attackAnimationDuration, 384);
  assert.equal(petSystem.spriteFrameCount, 12);
  assert.equal(combatSystem.monsterSpriteFrameCount, 12);
  assert.equal(combatSystem.monsterSpriteFrameSize, 256);
  assert.ok(petSystem.petTemplates.every((template) => template.image.startsWith("images/portraits/pets/")));
  assert.ok(combatSystem.monsterTemplates.every((template) => template.image.startsWith("images/portraits/monsters/")));
  assert.equal(petSystem.getPetFrameIndex(attackState, "attack"), 0);

  attackState.phaseTime = 160;
  assert.equal(petSystem.getPetFrameIndex(attackState, "attack"), 6);

  attackState.phaseTime = 319;
  assert.equal(petSystem.getPetFrameIndex(attackState, "attack"), 11);

  playerSystem.stateAnimationTime = 240;
  playerSystem.setCombatState("move");
  assert.equal(playerSystem.stateAnimationTime, 0);

  petSystem.elapsedTime = 1000;
  const movingPetState = {
    renderAnimationState: "idle",
    animationStartedAt: 0,
    attackDuration: 0,
  };
  assert.equal(petSystem.getPetFrameIndex(movingPetState, "move"), 0);
  petSystem.elapsedTime += 88;
  assert.equal(petSystem.getPetFrameIndex(movingPetState, "move"), 2);

  const animatedMonster = { combatState: "move", animationStateTime: 120 };
  combatSystem.setMonsterCombatState(animatedMonster, "attack");
  assert.equal(animatedMonster.animationStateTime, 0);
  animatedMonster.animationStateTime = 40;
  combatSystem.setMonsterCombatState(animatedMonster, "attack");
  assert.equal(animatedMonster.animationStateTime, 40);
});

test("远征状态机完成路线、搜索、战斗节点和撤离幂等结算", () => {
  const run = new ExpeditionRunSystem({
    random: fixedRandom,
    maxDepth: 4,
    minExtractionDepth: 2,
    backpackCapacity: 3,
  });

  assert.equal(run.getState().phase, "briefing");
  assert.equal(run.startRun({ supplies: 2, backpackCapacity: 3 }).success, true);
  assert.equal(run.startRun().success, false, "进行中的远征不能重复开始");

  const searchNode = run.getState().routeChoices.find(
    (node) => node.type === "search",
  );
  assert.ok(searchNode, "第一层应提供搜索路线");
  assert.equal(run.chooseNode(searchNode.id).success, true);
  assert.equal(run.getState().phase, "search");

  assert.equal(run.getSearchProfile("pet").id, "thorough");
  const searchResult = run.resolveSearch("pet", { hasPet: false });
  assert.equal(searchResult.success, true);
  assert.equal(searchResult.searchProfile.id, "thorough");
  assert.equal(searchResult.ambushed, false);
  assert.equal(run.getState().phase, "route");
  assert.equal(run.getState().depth, 1);
  assert.equal(run.getState().threat, 10);
  assert.equal(run.getState().backpack.length, 3);
  assert.equal(run.canExtract(), true, "入口撤离应在开局即可用");
  assert.equal(
    run.resolveSearch("quick").success,
    false,
    "同一搜索节点不能重复结算",
  );

  const combatNode = run.getState().routeChoices.find(
    (node) => node.type === "combat",
  );
  assert.ok(combatNode, "第二层应提供战斗路线");
  assert.equal(run.chooseNode(combatNode.id).success, true);
  assert.equal(run.getState().phase, "combat");
  assert.equal(
    run.completeCombat(
      { coins: 90, crystals: 2, exp: 30, kills: 3 },
      { lootQuality: 0, lootCount: 1 },
    ).success,
    true,
  );
  while (run.pendingLootChoice) {
    assert.equal(run.resolveLootChoice("leave").success, true);
  }

  const beforeExtraction = run.getState();
  assert.equal(beforeExtraction.depth, 2);
  assert.equal(beforeExtraction.canExtract, true);
  assert.equal(beforeExtraction.backpack.length, 3);

  const extraction = run.startExtraction();
  assert.equal(extraction.success, true);
  assert.equal(run.getState().phase, "extracting");
  assert.ok(extraction.durationMs >= 3500);

  const expectedCoins = beforeExtraction.pendingRewards.coins;
  const expectedCrystals = beforeExtraction.pendingRewards.crystals;
  const expectedExp = beforeExtraction.pendingRewards.exp;
  const firstSettlement = run.finishRun({ extracted: true });
  const secondSettlement = run.finishRun({
    extracted: false,
    reason: "duplicate-call",
  });

  assert.deepEqual(secondSettlement, firstSettlement);
  assert.equal(firstSettlement.extracted, true);
  assert.equal(firstSettlement.coins, expectedCoins);
  assert.equal(firstSettlement.crystals, expectedCrystals);
  assert.equal(firstSettlement.exp, expectedExp);
  assert.equal(firstSettlement.lootValue, beforeExtraction.backpackRewards.score);
  assert.equal(firstSettlement.lootExtracted, 3);
  assert.equal(run.getState().phase, "extracted");
  assert.equal(run.getState().active, false);
});

test("宠物探索天赋只强化匹配的搜索方式并受规则上限约束", () => {
  const petSystem = new PetSystem();
  const fireDog = {
    instanceId: 201,
    templateId: 1,
    level: 1,
    friendship: 20,
    equipped: true,
  };
  petSystem.unlockedPets = [fireDog];
  petSystem.equippedPets = [fireDog];

  const quickBonuses = petSystem.getExplorationSearchBonuses("quick");
  assert.equal(quickBonuses.qualityBonus, 1);
  assert.equal(quickBonuses.contributors[0].label, "灼热嗅觉");
  assert.equal(petSystem.getExplorationSearchBonuses("pet").contributors.length, 0);
  const baseSupport = petSystem.getBaseSupport("training_ground");
  assert.equal(baseSupport.roleLabel, "训练陪练");
  assert.equal(baseSupport.tier, 1);
  assert.equal(baseSupport.tierLabel, "熟悉");

  const training = petSystem.trainEquippedPets(1);
  assert.equal(training.success, true);
  assert.equal(fireDog.level, 2);
  assert.equal(fireDog.friendship, 20, "命运桌训练不能增加远征羁绊");

  fireDog.friendship = 100;
  const cappedBond = petSystem.applyExpeditionBond({ extracted: true, depth: 4 });
  assert.equal(cappedBond.plannedGain, 8);
  assert.equal(cappedBond.totalGain, 0);
  assert.equal(cappedBond.gainedCount, 1, "羁绊满值后仍应获得远征经验");
  assert.equal(cappedBond.cappedCount, 1);
  assert.equal(cappedBond.pets[0].gain, 0);
  assert.ok(cappedBond.pets[0].experienceGain > 0);
  fireDog.friendship = 20;

  const run = new ExpeditionRunSystem({ random: () => 0.3, maxDepth: 4 });
  run.startRun();
  const searchNode = run.getState().routeChoices.find(node => node.type === "search");
  assert.ok(searchNode);
  run.chooseNode(searchNode.id);
  const searchResult = run.resolveSearch("quick", {
    hasPet: true,
    searchBonuses: {
      ...quickBonuses,
      lootCountBonus: 9,
      threatReduction: 9,
      supplyChanceBonus: 1,
      ambushChanceReduction: 1,
    },
  });

  assert.equal(searchResult.success, true);
  assert.equal(searchResult.gainedLoot.length, 3, "快速搜索候选数量封顶为 3");
  assert.equal(run.getState().threat, 0, "威胁减免应在应用后保持非负");
  assert.equal(searchResult.supplyFound, true);
  assert.equal(searchResult.ambushed, false);
  assert.match(searchResult.message, /火焰犬·灼热嗅觉生效/);
});

test("背包满载时由玩家显式决定替换项，不按价值自动整理", () => {
  const run = new ExpeditionRunSystem({
    random: fixedRandom,
    backpackCapacity: 3,
  });
  run.startRun({ backpackCapacity: 3 });

  assert.equal(run.addLoot(createLoot("low", 10)).kept, true);
  assert.equal(run.addLoot(createLoot("middle", 20)).kept, true);
  assert.equal(run.addLoot(createLoot("high", 30)).kept, true);

  const rejected = run.addLoot(createLoot("too-low", 5));
  assert.equal(rejected.kept, false);
  assert.equal(rejected.pending, true);
  assert.equal(run.pendingLootChoice.incoming.id, "too-low");
  assert.equal(run.resolveLootChoice("leave").success, true);

  const upgraded = run.addLoot(createLoot("top", 40));
  assert.equal(upgraded.kept, false);
  assert.equal(upgraded.pending, true);
  assert.equal(run.resolveLootChoice("replace", "low").success, true);
  assert.deepEqual(
    run
      .getState()
      .backpack.map((item) => item.score)
      .sort((a, b) => a - b),
    [20, 30, 40],
  );
});

test("CombatSystem 遭遇生成、宠物技能冷却和主角承伤可回归", () => {
  const { combat } = createCombatHarness();
  const monster = startCombatEncounter(combat);
  const monsterHpBefore = monster.hp;

  combat.config.petAcquireRange = 5000;
  const skillResult = combat.usePetSkill(101);
  assert.equal(skillResult.success, true);
  assert.ok(monster.hp < monsterHpBefore, "火系宠物技能应对敌人造成伤害");
  assert.equal(combat.getPetSkillsState()[0].ready, false);
  assert.equal(
    combat.usePetSkill(101).success,
    false,
    "冷却中的宠物技能不能重复释放",
  );
  combat.updateSkillCooldowns(5000);
  assert.equal(combat.getPetSkillsState()[0].ready, true);

  const hpBefore = combat.runHp;
  const guardBefore = combat.petGuardHp;
  const damage = combat.damageHero(20, monster);
  assert.ok(damage > 0 && damage < 18, "玩家与领地防御、宠物减伤和护卫应共同降低承伤");
  assert.equal(combat.runHp, hpBefore - damage);
  assert.ok(combat.petGuardHp < guardBefore, "宠物 HP/防御形成的护卫值应真实吸收伤害");

  combat.applyDamage(monster, monster.hp + 100);
  const rewardsAfterKill = { ...combat.encounterRewards };
  combat.onMonsterKilled(monster);
  assert.deepEqual(
    combat.encounterRewards,
    rewardsAfterKill,
    "同一敌人的击杀奖励只能登记一次",
  );
});

test("基地一次性战备只在远征成功开始时消费并接入局内属性", () => {
  const { combat } = createCombatHarness();
  let consumeCalls = 0;
  const prepared = { attack: 6, defense: 4, supplies: 1, expBonus: 10 };
  combat.setTerritorySystem({
    calculateBonuses() {
      return { attack: 3, defense: 4, expBonus: 10, supplyBonus: 1 };
    },
    getPreparedBonuses() {
      return { ...prepared };
    },
    consumePreparedBonuses() {
      consumeCalls += 1;
      return { ...prepared };
    },
  });

  assert.equal(combat.startRun().success, true);
  assert.equal(consumeCalls, 1);
  assert.equal(combat.getBattleState().supplies, 4);
  assert.equal(combat.getPlayerAttackDamage(), 33 * 1.03, "火焰犬攻击光环应计入局内快照");
  assert.equal(combat.runMaxHp, 124);
  assert.equal(combat.startRun().success, false);
  assert.equal(consumeCalls, 1, "进行中的远征不能重复消费基地战备");
});

test("CombatSystem 撤离成功的资源、经验和长期记录只结算一次", () => {
  const { combat, resourceTotals, experience, petSystem } = createCombatHarness();
  startCombatEncounter(combat);

  combat.monsters = [];
  combat.encounterQueue = [];
  combat.encounterRewards = {
    coins: 100,
    crystals: 2,
    exp: 50,
    kills: 2,
  };
  const encounterResult = combat.finishEncounter();
  assert.equal(encounterResult.success, true);
  assert.equal(combat.getBattleState().extraction.canExtract, true);

  const extraction = combat.requestExtraction();
  assert.equal(extraction.success, true);
  combat.extractionTimer = 1;
  combat.update(1);

  const firstSettlement = combat.getBattleState().settlement;
  assert.equal(firstSettlement.extracted, true);
  assert.equal(firstSettlement.coins, 100, "现金奖励与仓库战利品应分开结算");
  assert.ok(firstSettlement.lootValue > 0, "成功撤离应把背包物品作为仓库价值带回");
  assert.deepEqual(resourceTotals, {
    coins: firstSettlement.coins,
    crystals: firstSettlement.crystals,
  });
  assert.equal(experience.total, firstSettlement.exp);
  assert.equal(combat.meta.extractions, 1);
  assert.equal(firstSettlement.petBond.totalGain, 4);
  assert.equal(firstSettlement.petBond.pets[0].gain, 4);
  assert.equal(petSystem.equippedPets[0].friendship, 4);

  const secondSettlement = combat.finishExpedition(true, "duplicate-call");
  assert.deepEqual(secondSettlement, firstSettlement);
  assert.deepEqual(resourceTotals, {
    coins: firstSettlement.coins,
    crystals: firstSettlement.crystals,
  });
  assert.equal(experience.total, firstSettlement.exp);
  assert.equal(combat.meta.extractions, 1);
  assert.equal(petSystem.equippedPets[0].friendship, 4, "重复结算不能重复增加羁绊");
});

test("CombatSystem 失败仅发放保底收益且重复失败不会再次发奖", () => {
  const { combat, resourceTotals, experience } = createCombatHarness();
  const monster = startCombatEncounter(combat);
  combat.encounterRewards = {
    coins: 100,
    crystals: 5,
    exp: 50,
    kills: 2,
  };
  combat.encounterRewardsCommitted = false;

  combat.damageHero(9999, monster);
  const firstSettlement = combat.getBattleState().settlement;
  assert.equal(firstSettlement.extracted, false);
  assert.equal(firstSettlement.reason, "defeated");
  assert.equal(firstSettlement.coins, 10);
  assert.equal(firstSettlement.crystals, 0);
  assert.equal(firstSettlement.exp, 11, "战败经验保留后应应用领地经验加成");
  assert.deepEqual(resourceTotals, { coins: 10, crystals: 0 });
  assert.equal(experience.total, 11);
  assert.equal(combat.meta.losses, 1);

  const secondSettlement = combat.finishExpedition(false, "duplicate-call");
  assert.deepEqual(secondSettlement, firstSettlement);
  assert.deepEqual(resourceTotals, { coins: 10, crystals: 0 });
  assert.equal(experience.total, 11);
  assert.equal(combat.meta.losses, 1);
});
