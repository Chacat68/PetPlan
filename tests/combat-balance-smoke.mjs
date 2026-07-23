import assert from "node:assert/strict";
import test from "node:test";

globalThis.Image = class ImageStub {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
  }
  set src(value) { this._src = value; }
  get src() { return this._src; }
};

const { CombatSystem } = await import("../js/modules/combat-system.js");
const { PlayerSystem } = await import("../js/modules/player-system.js");

function createHarness({ player = {} } = {}) {
  let territory = { attack: 3, defense: 2, expBonus: 0 };
  const resources = { coins: 0, crystals: 0 };
  const playerSystem = new PlayerSystem();
  Object.assign(playerSystem.player, player);
  playerSystem.addExperience = () => {};
  playerSystem.player.x = 0;
  playerSystem.player.y = 0;
  playerSystem.player.crit = 0;
  const combat = new CombatSystem({
    random: () => 0.5,
    runOptions: { maxDepth: 4, minExtractionDepth: 1 },
  });
  combat.setPlayerSystem(playerSystem);
  playerSystem.setCombatSystem(combat);
  combat.setTerritorySystem({
    calculateBonuses() { return { ...territory }; },
  });
  combat.setResourceSystem({
    addCoins(value) { resources.coins += value; },
    addCrystals(value) { resources.crystals += value; },
  });
  combat.setPetSystem({
    equippedPets: [],
    resetBattleStates() {},
    applyExpeditionBond() { return { totalGain: 0, pets: [] }; },
  });
  combat.resetBattle();
  combat.isPaused = false;
  return { combat, playerSystem, resources, setTerritory(value) { territory = value; } };
}

test("远征每帧只由 CombatSystem 推进一次玩家位移", () => {
  const { combat, playerSystem } = createHarness();
  assert.equal(combat.startRun().success, true);
  combat.setMovementInput(1, 0);
  const before = playerSystem.player.x;

  playerSystem.update(100);
  assert.equal(playerSystem.player.x, before, "PlayerSystem 不得抢占远征位移权威");
  combat.update(100);

  const expected = combat.config.heroMoveSpeed * 0.1;
  assert.ok(Math.abs(playerSystem.player.x - before - expected) < 0.01);
  assert.equal(playerSystem.getAnimationState(), "move");

  const moveFrameDuration = playerSystem.playerSprites.move.frameDuration;
  playerSystem.update(moveFrameDuration + 1);
  assert.equal(
    playerSystem.getAnimationState(),
    "move",
    "PlayerSystem 更新属性时不得重置 CombatSystem 管理的远征动画状态",
  );
  assert.equal(playerSystem.stateAnimationTime, moveFrameDuration + 1);

  combat.clearMovementInput();
  combat.update(16);
  assert.equal(playerSystem.getAnimationState(), "idle");
});

test("移动射击不降伤害，障碍仍会阻断视线和弹道", () => {
  const { combat, playerSystem } = createHarness();
  assert.equal(combat.startRun().success, true);
  assert.equal(combat.config.movingDamageMultiplier, 1);
  assert.equal(combat.config.movingAttackIntervalMultiplier, 1);
  assert.equal(combat.config.heroMovingAttackRange, combat.config.heroAttackRange);
  const baseDamage = combat.getPlayerAttackDamage();
  combat.setMovementInput(1, 0);
  combat.monsters = [{
    id: 99, x: 300, y: 120, width: 36, height: 36, hp: 100, maxHp: 100,
  }];
  playerSystem.player.x = 80;
  playerSystem.player.y = 120;
  combat.worldSystem.obstacles = [{ x: 150, y: 100, width: 80, height: 100, type: "rock" }];
  const hero = combat.getHeroCenter();
  const target = combat.getEntityCenter(combat.monsters[0]);
  assert.equal(combat.isLineBlocked(hero, target), true);
  assert.equal(combat.fireAtNearestMonsters(), undefined);
  assert.equal(combat.bullets.length, 0, "隔着障碍不能锁定并开火");

  combat.worldSystem.obstacles = [];
  const bullet = combat.fireBullet(combat.monsters[0]);
  assert.equal(bullet.damage, baseDamage);
  combat.worldSystem.obstacles = [{ x: bullet.x + 18, y: bullet.y - 30, width: 50, height: 60, type: "rock" }];
  const hpBefore = combat.monsters[0].hp;
  combat.updateBullets(100);
  assert.equal(combat.bullets.length, 0);
  assert.equal(combat.monsters[0].hp, hpBefore, "子弹撞上障碍不能继续追踪命中");
});

test("撤离离圈只暂停进度并持续生成增援", () => {
  const { combat, playerSystem } = createHarness();
  assert.equal(combat.startRun().success, true);
  combat.runSystem.phase = "extracting";
  combat.currentEncounter = { type: "extraction", depth: 2 };
  combat.encounterQueue = [];
  combat.monsters = [];
  combat.extractionTimer = 500;
  combat.extractionTotalDuration = 1000;
  combat.extractionOutOfZoneTimer = combat.config.extractionOutOfZoneGraceMs + 1;
  combat.extractionReinforcementTimer = 1;
  playerSystem.player.x = combat.worldSystem.width - 100;
  playerSystem.player.y = combat.worldSystem.height - 100;

  combat.update(100);
  assert.equal(combat.extractionTimer, 500, "离圈后进度必须暂停而不是回退");
  assert.ok(combat.monsters.length > 0, "撤离期间必须持续补充守点压力");
});

test("敌人包含远程、冲锋和 Boss 范围前摇差异", () => {
  const { combat, playerSystem } = createHarness();
  assert.equal(combat.startRun().success, true);
  combat.runSystem.phase = "combat";
  combat.worldSystem.obstacles = [];
  const hero = combat.getHeroCenter();
  const ranged = combat.spawnMonster({ templateId: "bat", depth: 2 }, 2);
  const charger = combat.spawnMonster({ templateId: "goblin", depth: 2 }, 2);
  const boss = combat.spawnMonster({ templateId: "dragon", boss: true, depth: 5 }, 5);
  assert.equal(ranged.combatStyle, "ranged");
  assert.equal(charger.combatStyle, "charger");
  assert.equal(boss.combatStyle, "boss");

  charger.x = hero.x + 180;
  charger.y = hero.y;
  charger.chargeCooldown = 0;
  boss.x = hero.x + 220;
  boss.y = hero.y;
  boss.bossAbilityTimer = 0;
  playerSystem.player.hp = 100;
  combat.updateMonsters(50);
  assert.ok(charger.chargeTelegraph > 0, "冲锋怪应先显示冲锋前摇");
  assert.ok(boss.bossTelegraphTimer > 0, "Boss 范围技能应先显示危险区域");
  assert.ok(boss.bossTarget, "Boss 前摇需锁存落点供玩家躲避");
});

test("怪物只在攻击距离内造成伤害，远程怪过近时会后撤", () => {
  const { combat } = createHarness();
  assert.equal(combat.startRun().success, true);
  combat.runSystem.phase = "combat";
  combat.worldSystem.obstacles = [];
  const hero = combat.getHeroCenter();

  const melee = combat.spawnMonster({ templateId: "slime", depth: 1 }, 1);
  melee.x = hero.x + 500;
  melee.y = hero.y;
  melee.attackCooldown = 0;
  const hpBefore = combat.runHp;
  const meleeDistanceBefore = Math.hypot(
    combat.getEntityCenter(melee).x - hero.x,
    combat.getEntityCenter(melee).y - hero.y,
  );

  combat.updateMonsters(100);

  const meleeDistanceAfter = Math.hypot(
    combat.getEntityCenter(melee).x - hero.x,
    combat.getEntityCenter(melee).y - hero.y,
  );
  assert.equal(combat.runHp, hpBefore, "远距离近战怪不得隔空造成伤害");
  assert.ok(meleeDistanceAfter < meleeDistanceBefore, "距离外怪物应向玩家追击");
  assert.equal(melee.combatState, "move");

  const ranged = combat.spawnMonster({ templateId: "bat", depth: 1 }, 1);
  ranged.x = hero.x + 80;
  ranged.y = hero.y;
  const rangedDistanceBefore = Math.hypot(
    combat.getEntityCenter(ranged).x - hero.x,
    combat.getEntityCenter(ranged).y - hero.y,
  );

  combat.monsters = [ranged];
  combat.updateMonsters(100);

  const rangedDistanceAfter = Math.hypot(
    combat.getEntityCenter(ranged).x - hero.x,
    combat.getEntityCenter(ranged).y - hero.y,
  );
  assert.ok(rangedDistanceAfter > rangedDistanceBefore, "远程怪过近时应远离玩家");
  assert.equal(ranged.combatState, "move");
});

test("同深度同威胁的怪物生命不再随玩家等级膨胀", () => {
  const novice = createHarness({ player: { level: 1 } }).combat;
  const veteran = createHarness({ player: { level: 50 } }).combat;
  assert.equal(novice.startRun().success, true);
  assert.equal(veteran.startRun().success, true);
  novice.runSystem.threat = 40;
  veteran.runSystem.threat = 40;

  const noviceMonster = novice.spawnMonster({ templateId: "skeleton", depth: 3 }, 3);
  const veteranMonster = veteran.spawnMonster({ templateId: "skeleton", depth: 3 }, 3);
  assert.equal(veteranMonster.maxHp, noviceMonster.maxHp);
});

test("远征开始后玩家与领地属性使用局内快照", () => {
  const { combat, playerSystem, setTerritory } = createHarness();
  playerSystem.player.attack = 20;
  assert.equal(combat.startRun().success, true);
  assert.equal(combat.getPlayerAttackDamage(), 23);

  playerSystem.player.attack = 200;
  playerSystem.player.defense = 99;
  setTerritory({ attack: 50, defense: 50, expBonus: 100 });
  assert.equal(combat.getPlayerAttackDamage(), 23, "局外升级不能即时污染运行中的远征");
  assert.equal(combat.damageHero(20), Math.floor(20 - (0 + 2) * 0.32));
});

test("远征不再自然回血，恢复属性改为小幅强化补给", () => {
  const { combat } = createHarness({ player: { hpRegen: 10 } });
  assert.equal(combat.startRun().success, true);
  combat.runHp = 50;
  combat.timeSinceDamage = 2000;
  for (let index = 0; index < 100; index += 1) combat.update(100);
  assert.equal(combat.runHp, 50, "大地图行进不能依靠等待无限回满");

  const supply = combat.useSupply();
  assert.equal(supply.success, true);
  assert.equal(supply.regenBonusPercent, 10);
  const baseHeal = Math.ceil(combat.runMaxHp * supply.healRatio);
  assert.ok(combat.runHp > 50 + baseHeal, "恢复属性应提升单次补给治疗量");
  assert.equal(combat.useSupply().success, false, "补给不能在冷却内连续使用");

  combat.skillCooldowns.set("pet", 1000);
  combat.runSystem.phase = "route";
  combat.update(100);
  assert.equal(combat.skillCooldowns.get("pet"), 1000, "路线等待不能刷新战斗技能");
  combat.runSystem.phase = "combat";
  combat.update(100);
  assert.equal(combat.skillCooldowns.get("pet"), 900);
});

test("宠物生命防御形成护卫，救援技能可在单局触发一次", () => {
  const { combat } = createHarness();
  combat.setPetSystem({
    equippedPets: [{ instanceId: 7 }],
    resetBattleStates() {},
    getCombatSupportSnapshot() {
      return {
        members: [{ instanceId: 7 }],
        guardCapacity: 20,
        damageReduction: 0,
        rescue: { petName: "凤凰", skillName: "浴火重生", restoreHpRatio: 0.5, invulnerabilityMs: 1000 },
      };
    },
    awardExpeditionProgress() { return { totalGain: 0, pets: [] }; },
  });
  assert.equal(combat.startRun().success, true);
  const hpBefore = combat.runHp;
  const received = combat.damageHero(20);
  assert.equal(combat.petGuardHp, 10);
  assert.equal(combat.runHp, hpBefore - received);
  assert.ok(received < 20);

  combat.damageHero(9999);
  assert.equal(combat.petRescueUsed, true);
  assert.equal(combat.runHp, Math.floor(combat.runMaxHp * 0.5));
  assert.ok(combat.petRescueInvulnerabilityTimer > 0);
});

test("局内只暴露队长主动技能，完整宠物编队的被动加成仍保留", () => {
  const { combat } = createHarness();
  const pets = [
    { instanceId: "leader", templateId: 1, level: 1 },
    { instanceId: "support", templateId: 2, level: 1 },
  ];
  combat.setPetSystem({
    equippedPets: pets,
    resetBattleStates() {},
    getTemplate(templateId) {
      return {
        name: templateId === 1 ? "队长" : "支援",
        type: "light",
        emoji: "●",
        baseStats: { attack: 10 },
        skill: { name: "协同治疗", heal: 20, cooldown: 1000 },
      };
    },
    getCombatSupportSnapshot() {
      return {
        members: pets.map(pet => ({ ...pet })),
        count: 2,
        guardCapacity: 0,
        damageReduction: 0,
        auras: { attackPercent: 20 },
      };
    },
    awardExpeditionProgress() { return { totalGain: 0, pets: [] }; },
  });
  assert.equal(combat.startRun().success, true);
  combat.runSystem.phase = "combat";
  combat.currentEncounter = { type: "combat", depth: 1 };
  combat.runHp = 50;

  assert.equal(combat.petSquadSnapshot.members.length, 2, "被动快照必须保留完整编队");
  const boostedDamage = combat.getWeaponShotDamage();
  combat.petSquadSnapshot.auras.attackPercent = 0;
  const baseDamage = combat.getWeaponShotDamage();
  combat.petSquadSnapshot.auras.attackPercent = 20;
  assert.ok(Math.abs(boostedDamage - baseDamage * 1.2) < 0.001, "全队被动光环仍需参与战斗计算");
  assert.deepEqual(combat.getPetSkillsState().map(skill => skill.instanceId), ["leader"]);
  assert.equal(combat.usePetSkill("support").code, "leader-skill-only");
  assert.equal(combat.usePetSkill("leader").success, true);
});

test("战斗中主动放弃按战败高风险结算", () => {
  const { combat, resources } = createHarness();
  assert.equal(combat.startRun().success, true);
  combat.runSystem.phase = "combat";
  combat.currentEncounter = { type: "combat", depth: 1 };
  combat.encounterRewards = { coins: 100, crystals: 5, exp: 50, kills: 2 };
  combat.encounterRewardsCommitted = false;

  const result = combat.abandonRun();
  assert.equal(result.success, true);
  assert.equal(result.settlement.reason, "defeated");
  assert.equal(result.settlement.abandonmentPenalty, false);
  assert.equal(result.settlement.coins, 10);
  assert.equal(result.settlement.crystals, 0);
  assert.deepEqual(resources, { coins: 10, crystals: 0 });
});

test("撤离守点中主动退出同样按战败结算", () => {
  const { combat } = createHarness();
  assert.equal(combat.startRun().success, true);
  combat.runSystem.phase = "extracting";
  combat.currentEncounter = { type: "extraction", depth: 2 };
  const result = combat.abandonRun();
  assert.equal(result.success, true);
  assert.equal(result.settlement.reason, "defeated");
  assert.equal(result.settlement.abandonmentPenalty, false);
});

test("安全阶段主动放弃仍按保底撤退结算", () => {
  const { combat, resources } = createHarness();
  assert.equal(combat.startRun().success, true);
  combat.runSystem.phase = "route";
  combat.runSystem.addPendingRewards({ coins: 100, exp: 50 });

  const result = combat.abandonRun();
  assert.equal(result.success, true);
  assert.equal(result.settlement.reason, "abandoned");
  assert.equal(result.settlement.abandonmentPenalty, true);
  assert.equal(result.settlement.coins, 30);
  assert.deepEqual(resources, { coins: 30, crystals: 0 });
});
