/**
 * CombatSystem - 宠物远征（单局 RPG 搜打撤）
 *
 * ExpeditionRunSystem 负责路线和结算，本类负责战斗实体、主动技能与 Canvas 渲染。
 */

import { ExpeditionRunSystem } from './expedition-run-system.js?v=extraction-rpg-20260711a';
import { TargetingSystem } from './targeting-system.js?v=tower-defense-20260710b';

let instance = null;
const MONSTER_ASSET_VERSION = 'extraction-rpg-20260711a';

const PET_ROLE_COLORS = Object.freeze({
    fire: '#ff7043',
    phoenix: '#ff8a50',
    ice: '#72d7ff',
    thunder: '#ffe66d',
    earth: '#b58b5a',
    wind: '#88f0d0',
    light: '#fff4a8',
    dark: '#c38cff',
    default: '#ffd167'
});

export class CombatSystem {
    constructor({ random = Math.random, runOptions = {} } = {}) {
        this.mode = 'extractionRpg';
        this.isPaused = true;
        this.random = typeof random === 'function' ? random : Math.random;
        this.targetingSystem = new TargetingSystem();
        this.runSystem = new ExpeditionRunSystem({ random: this.random, ...runOptions });

        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
        this.encounterQueue = [];
        this.currentEncounter = null;
        this.encounterRewards = this.createEmptyRewards();
        this.encounterRewardsCommitted = false;
        this.nextMonsterId = 1;
        this.nextBulletId = 1;
        this.encounterSpawnTimer = 0;
        this.attackTimer = 0;
        this.uiNotifyTimer = 0;
        this.extractionTimer = 0;
        this.guardTimer = 0;
        this.focusTargetId = null;

        this.monsterTemplates = [
            {
                id: 'slime', name: '史莱姆', image: 'images/monsters/slime_table.png',
                baseHp: 34, baseAttack: 7, speed: 54, coinReward: 8,
                crystalReward: 0, expReward: 5, size: 34, attackInterval: 1250
            },
            {
                id: 'bat', name: '疾风蝙蝠', image: 'images/monsters/bat_table.png',
                baseHp: 27, baseAttack: 8, speed: 82, coinReward: 11,
                crystalReward: 0, expReward: 7, size: 31, attackInterval: 950
            },
            {
                id: 'goblin', name: '哥布林', image: 'images/monsters/goblin_table.png',
                baseHp: 46, baseAttack: 10, speed: 62, coinReward: 14,
                crystalReward: 0, expReward: 9, size: 36, attackInterval: 1120
            },
            {
                id: 'skeleton', name: '重甲骷髅', image: 'images/monsters/skeleton_table.png',
                baseHp: 78, baseAttack: 14, speed: 42, coinReward: 20,
                crystalReward: 1, expReward: 14, size: 40, attackInterval: 1380
            },
            {
                id: 'demon', name: '深渊恶魔', image: 'images/monsters/demon_table.png',
                baseHp: 112, baseAttack: 19, speed: 48, coinReward: 32,
                crystalReward: 2, expReward: 24, size: 46, attackInterval: 1180
            },
            {
                id: 'dragon', name: '核心守卫', image: 'images/monsters/dragon_table.png',
                baseHp: 560, baseAttack: 45, speed: 35, coinReward: 150,
                crystalReward: 10, expReward: 120, size: 64, attackInterval: 1450, isBoss: true
            }
        ];

        this.monsterImages = {};
        this.monsterAnimationSheets = {};
        this.combatStates = ['idle', 'move', 'attack'];
        this.preloadImages();

        this.config = {
            attackInterval: 720,
            bulletSpeed: 560,
            maxMonsters: 32,
            spawnInterval: 460,
            heroEngageRange: 64,
            skillGuardReduction: 0.42
        };

        this.mapWidth = 750;
        this.mapHeight = 900;
        this.playerSystem = null;
        this.resourceSystem = null;
        this.territorySystem = null;
        this.petSystem = null;
        this.onStateChange = null;
        this.skillCooldowns = new Map();

        this.runHp = 100;
        this.runMaxHp = 100;
        this.lastSettlement = null;
        this.settled = false;
        this.battleInitialized = false;
        this.meta = {
            bestDepth: 0,
            extractions: 0,
            losses: 0
        };

        console.log('[CombatSystem] 宠物远征模式初始化完成');
    }

    preloadImages() {
        this.monsterTemplates.forEach(template => {
            const image = new Image();
            image.onload = () => {
                this.monsterImages[template.id] = image;
            };
            image.onerror = () => {
                console.warn(`[CombatSystem] 图片加载失败: ${template.image}`);
            };
            image.src = `${template.image}?v=${MONSTER_ASSET_VERSION}`;
            if (image.complete && image.naturalWidth > 0) this.monsterImages[template.id] = image;

            this.monsterAnimationSheets[template.id] = {};
            this.combatStates.forEach(state => {
                const spritePath = this.getMonsterSpritePath(template, state);
                const sheet = new Image();
                sheet.onload = () => {
                    this.monsterAnimationSheets[template.id][state] = sheet;
                };
                sheet.onerror = () => {
                    console.warn(`[CombatSystem] 怪物序列帧加载失败: ${spritePath}`);
                };
                sheet.src = `${spritePath}?v=${MONSTER_ASSET_VERSION}`;
                if (sheet.complete && sheet.naturalWidth > 0) {
                    this.monsterAnimationSheets[template.id][state] = sheet;
                }
            });
        });
    }

    getMonsterSpritePath(template, state) {
        return `images/sprites/battle/monsters/${template.id}_${state}_sheet.png`;
    }

    setPlayerSystem(playerSystem) {
        this.playerSystem = playerSystem;
    }

    setResourceSystem(resourceSystem) {
        this.resourceSystem = resourceSystem;
    }

    setTerritorySystem(territorySystem) {
        this.territorySystem = territorySystem;
    }

    setPetSystem(petSystem) {
        this.petSystem = petSystem;
    }

    setOnStateChange(callback) {
        this.onStateChange = typeof callback === 'function' ? callback : null;
    }

    prepareBattle() {
        if (!this.battleInitialized) this.resetBattle();
        else {
            if (!this.isCombatActive()) this.placeHeroAtCamp();
            this.notifyStateChange();
        }
        return this.getBattleState();
    }

    resetBattle() {
        this.clearEncounter();
        this.runSystem.reset();
        this.runMaxHp = this.calculateRunMaxHp();
        this.runHp = this.runMaxHp;
        this.skillCooldowns.clear();
        this.guardTimer = 0;
        this.lastSettlement = null;
        this.settled = false;
        this.battleInitialized = true;
        this.placeHeroAtCamp();
        this.notifyStateChange();
        return { success: true, message: '远征终端已就绪' };
    }

    startRun() {
        if (!this.battleInitialized) this.resetBattle();
        const phase = this.runSystem.phase;
        if (phase === 'extracted' || phase === 'defeat') this.resetBattle();

        const result = this.runSystem.startRun({ supplies: 2, backpackCapacity: 8 });
        if (!result.success) return result;

        this.clearEncounter();
        this.runMaxHp = this.calculateRunMaxHp();
        this.runHp = this.runMaxHp;
        this.skillCooldowns.clear();
        this.lastSettlement = null;
        this.settled = false;
        this.placeHeroAtCamp();
        this.addBannerText('远征开始', '#ffd167');
        this.notifyStateChange();
        return result;
    }

    startExpedition() {
        return this.startRun();
    }

    chooseRoute(nodeId) {
        const result = this.runSystem.chooseNode(nodeId);
        if (result.success && result.encounter) this.beginEncounter(result.encounter);
        else if (result.success) this.placeHeroAtCamp();
        this.notifyStateChange();
        return result;
    }

    searchArea(mode) {
        const result = this.runSystem.resolveSearch(mode, {
            hasPet: Boolean(this.petSystem?.equippedPets?.length)
        });
        if (result.success && result.encounter) this.beginEncounter(result.encounter);
        this.notifyStateChange();
        return result;
    }

    searchCurrentArea(mode = 'quick') {
        return this.searchArea(mode);
    }

    restAtCamp() {
        const result = this.runSystem.restAtCamp();
        if (result.success) {
            const heal = Math.max(1, Math.ceil(this.runMaxHp * result.healRatio));
            this.healHero(heal);
            this.placeHeroAtCamp();
        }
        this.notifyStateChange();
        return result;
    }

    leaveCamp() {
        const result = this.runSystem.leaveCamp();
        if (result.success) this.placeHeroAtCamp();
        this.notifyStateChange();
        return result;
    }

    requestExtraction() {
        const result = this.runSystem.startExtraction();
        if (result.success) {
            this.extractionTimer = result.durationMs;
            this.beginEncounter({ ...result.encounter, durationMs: result.durationMs });
            this.addBannerText('撤离信标启动', '#72d7ff');
        }
        this.notifyStateChange();
        return result;
    }

    useSupply() {
        if (this.runHp >= this.runMaxHp) return { success: false, message: '远征生命已满' };
        const result = this.runSystem.spendSupply();
        if (result.success) {
            const heal = Math.max(1, Math.ceil(this.runMaxHp * result.healRatio));
            const actualHeal = this.healHero(heal);
            result.message = `使用补给，恢复 ${actualHeal} 点生命`;
        }
        this.notifyStateChange();
        return result;
    }

    useMedkit() {
        return this.useSupply();
    }

    usePetSkill(instanceId) {
        if (!this.isCombatActive()) return { success: false, message: '宠物技能只能在战斗中使用' };
        const pet = this.petSystem?.equippedPets?.find(item => String(item.instanceId) === String(instanceId));
        if (!pet) return { success: false, message: '该宠物未上阵' };
        const template = this.petSystem?.getTemplate?.(pet.templateId);
        if (!template) return { success: false, message: '宠物数据不存在' };

        const remaining = this.skillCooldowns.get(pet.instanceId) || 0;
        if (remaining > 0) {
            return { success: false, message: `${template.skill.name}还需 ${(remaining / 1000).toFixed(1)} 秒` };
        }

        const targets = this.getTargets(this.getHeroCenter(), { strategy: 'nearest', limit: 4 });
        const type = template.type || 'default';
        const levelScale = 1 + Math.max(0, (pet.level || 1) - 1) * 0.1;
        const baseDamage = Math.max(
            1,
            Math.floor(((template.skill?.damage || template.baseStats?.attack * 2 || 20) * levelScale))
        );
        let affected = 0;

        if (type === 'light') {
            const heal = Math.max(12, Math.floor((template.skill?.heal || 50) * levelScale));
            affected = this.healHero(heal);
            this.addBannerText(`${template.name} · ${template.skill.name}`, PET_ROLE_COLORS.light);
        } else if (targets.length === 0) {
            return { success: false, message: '当前没有可攻击的目标' };
        } else if (type === 'fire' || type === 'phoenix') {
            targets.forEach((target, index) => {
                if (this.applyDamage(target, baseDamage * (index === 0 ? 1.25 : 0.72))) affected += 1;
            });
        } else if (type === 'ice') {
            targets.forEach(target => {
                if (this.applyDamage(target, baseDamage * 0.72)) affected += 1;
                target.slowFactor = 0.48;
                target.slowTimer = Math.max(target.slowTimer || 0, 3200);
            });
        } else if (type === 'earth') {
            targets.forEach(target => {
                if (this.applyDamage(target, baseDamage * 0.82)) affected += 1;
                target.stunTimer = Math.max(target.stunTimer || 0, 700);
            });
            this.guardTimer = 4200;
        } else if (type === 'thunder' || type === 'wind') {
            targets.slice(0, 3).forEach((target, index) => {
                if (this.applyDamage(target, baseDamage * Math.max(0.55, 1 - index * 0.2))) affected += 1;
                if (type === 'wind') target.stunTimer = Math.max(target.stunTimer || 0, 320);
            });
        } else if (type === 'dark') {
            const target = targets[0];
            const executeScale = target.hp / target.maxHp <= 0.35 ? 1.8 : 1;
            if (this.applyDamage(target, baseDamage * executeScale, { isCrit: executeScale > 1 })) affected = 1;
        } else if (this.applyDamage(targets[0], baseDamage)) {
            affected = 1;
        }

        const cooldown = Math.max(3000, Math.floor(template.skill?.cooldown || 6000));
        this.skillCooldowns.set(pet.instanceId, cooldown);
        const color = PET_ROLE_COLORS[type] || PET_ROLE_COLORS.default;
        this.addBannerText(`${template.name} · ${template.skill?.name || '伙伴技能'}`, color);
        this.notifyStateChange();
        return {
            success: true,
            message: type === 'light'
                ? `${template.skill.name}恢复 ${affected} 点生命`
                : `${template.skill?.name || '伙伴技能'}命中 ${affected} 个目标`
        };
    }

    abandonRun() {
        if (!this.runSystem.active) return { success: false, message: '当前没有进行中的远征' };
        const settlement = this.finishExpedition(false, 'abandoned');
        return { success: true, message: '已放弃本局并结算保底收益', settlement };
    }

    restartBattle() {
        if (this.runSystem.active) {
            return { success: false, message: '远征进行中，请先使用“放弃本局”' };
        }
        return this.resetBattle();
    }

    // 旧入口兼容：不再存在波次、塔位和基地升级。
    startNextWave() {
        return this.startRun();
    }

    upgradeSelectedTower() {
        return { success: false, message: '远征模式中请使用宠物主动技能' };
    }

    repairBase() {
        return this.useSupply();
    }

    selectTowerAt(x, y) {
        return this.selectTargetAt(x, y);
    }

    selectTargetAt(x, y) {
        if (!this.isCombatActive()) return { success: false, message: '' };
        const target = this.monsters
            .map(monster => ({
                monster,
                distance: Math.hypot(
                    x - (monster.x + monster.width / 2),
                    y - (monster.y + monster.height / 2)
                )
            }))
            .filter(item => item.distance <= Math.max(34, item.monster.width))
            .sort((a, b) => a.distance - b.distance)[0]?.monster;
        if (!target) return { success: false, message: '' };
        this.focusTargetId = target.id;
        this.notifyStateChange();
        return { success: true, message: `已锁定 ${target.name}` };
    }

    update(deltaTime) {
        if (!this.battleInitialized) this.resetBattle();
        const safeDelta = Math.max(0, Math.min(deltaTime, 100));
        this.updateSkillCooldowns(safeDelta);
        this.guardTimer = Math.max(0, this.guardTimer - safeDelta);
        this.uiNotifyTimer += safeDelta;

        if (this.isCombatActive()) {
            this.updateEncounterSpawns(safeDelta);
            this.updateAttack(safeDelta);
            this.updateMonsters(safeDelta);
            this.updateBullets(safeDelta);

            if (this.runSystem.phase === 'extracting') {
                this.extractionTimer = Math.max(0, this.extractionTimer - safeDelta);
                if (this.extractionTimer <= 0 && !this.settled) this.finishExpedition(true, 'extracted');
            } else if (
                this.runSystem.phase === 'combat' &&
                this.currentEncounter &&
                this.encounterQueue.length === 0 &&
                this.monsters.length === 0
            ) {
                this.finishEncounter();
            }
        }

        this.updateExplosions(safeDelta);
        this.updateCombatTexts(safeDelta);
        if (this.uiNotifyTimer >= 250) {
            this.uiNotifyTimer %= 250;
            this.notifyStateChange();
        }
    }

    beginEncounter(spec = {}) {
        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.focusTargetId = null;
        this.currentEncounter = { ...spec };
        this.encounterQueue = this.buildEncounterQueue(spec);
        this.encounterRewards = this.createEmptyRewards();
        this.encounterRewardsCommitted = false;
        this.encounterSpawnTimer = 0;
        this.attackTimer = 0;
        this.uiNotifyTimer = 0;
        this.placeHeroAtCamp();
        this.addBannerText(this.getEncounterTitle(spec.type), spec.boss ? '#ff7043' : '#ffd167');
    }

    buildEncounterQueue(spec = {}) {
        const depth = Math.max(1, Math.floor(spec.depth || 1));
        const enemyCount = Math.max(1, Math.floor(spec.enemyCount || 3));
        const eliteCount = Math.max(0, Math.floor(spec.eliteCount || 0));
        const available = ['slime', 'bat', 'goblin'];
        if (depth >= 3) available.push('skeleton');
        if (depth >= 5 || spec.type === 'elite' || spec.type === 'extraction') available.push('demon');

        const queue = [];
        const normalCount = Math.max(0, enemyCount - (spec.boss ? 1 : 0));
        for (let index = 0; index < normalCount; index += 1) {
            queue.push({
                templateId: available[Math.floor(this.random() * available.length)],
                elite: index < eliteCount,
                depth
            });
        }
        if (spec.boss) queue.push({ templateId: 'dragon', boss: true, depth });
        return queue;
    }

    updateEncounterSpawns(deltaTime) {
        if (this.encounterQueue.length === 0 || this.monsters.length >= this.config.maxMonsters) return;
        this.encounterSpawnTimer -= deltaTime;
        if (this.encounterSpawnTimer > 0) return;
        const spec = this.encounterQueue.shift();
        this.spawnMonster(spec, spec.depth);
        this.encounterSpawnTimer = this.config.spawnInterval;
        this.notifyStateChange();
    }

    spawnMonster(spec = null, depthNumber = null) {
        if (this.monsters.length >= this.config.maxMonsters) return null;
        const normalizedSpec = typeof spec === 'string' ? { templateId: spec } : (spec || { templateId: 'slime' });
        const template = this.monsterTemplates.find(item => item.id === normalizedSpec.templateId)
            || this.monsterTemplates[0];
        const depth = Math.max(1, depthNumber || normalizedSpec.depth || this.runSystem.depth + 1);
        const playerLevel = this.playerSystem?.player?.level || 1;
        const threat = this.runSystem.threat || 0;
        const depthScale = 1 + (depth - 1) * 0.16;
        const threatScale = 1 + threat * 0.006;
        const levelScale = 1 + Math.max(0, playerLevel - 1) * 0.045;
        const eliteScale = normalizedSpec.elite ? 1.65 : 1;
        const bossScale = template.isBoss ? 1 + Math.max(0, depth - 5) * 0.08 : 1;
        const size = template.size * (normalizedSpec.elite && !template.isBoss ? 1.14 : 1);
        const maxHp = Math.max(1, Math.floor(template.baseHp * depthScale * threatScale * levelScale * eliteScale * bossScale));
        const startX = this.mapWidth * (0.82 + this.random() * 0.1);
        const startY = this.mapHeight * (0.18 + this.random() * 0.64);

        const monster = {
            id: this.nextMonsterId++,
            templateId: template.id,
            name: template.name,
            x: startX - size / 2,
            y: startY - size / 2,
            width: size,
            height: size,
            hp: maxHp,
            maxHp,
            attack: Math.max(1, Math.floor(template.baseAttack * depthScale * threatScale * eliteScale)),
            speed: template.speed * (1 + Math.min(0.28, threat * 0.0025)),
            coinReward: Math.max(1, Math.floor(template.coinReward * depthScale * eliteScale)),
            crystalReward: Math.max(0, Math.floor((template.crystalReward || 0) * eliteScale)),
            expReward: Math.max(1, Math.floor(template.expReward * depthScale * eliteScale)),
            attackInterval: Math.max(620, template.attackInterval / (1 + threat * 0.002)),
            attackCooldown: 260 + this.random() * 420,
            engageRange: Math.max(42, size * 0.9),
            isBoss: Boolean(template.isBoss || normalizedSpec.boss),
            isElite: Boolean(normalizedSpec.elite),
            slowFactor: 1,
            slowTimer: 0,
            stunTimer: 0,
            animationOffset: this.random() * 400,
            combatState: 'move',
            progress: 0,
            rewardGranted: false
        };
        this.monsters.push(monster);
        return monster;
    }

    updateAttack(deltaTime) {
        if (!this.playerSystem || this.monsters.length === 0) return;
        const player = this.playerSystem.player;
        const attackInterval = this.config.attackInterval / Math.max(0.1, player.attackSpeed || 1);
        this.attackTimer += deltaTime;
        if (this.attackTimer < attackInterval) return;
        this.attackTimer %= attackInterval;
        this.fireAtNearestMonsters();
    }

    fireAtNearestMonsters() {
        if (!this.playerSystem) return;
        const player = this.playerSystem.player;
        const origin = this.getEntityCenter(player);
        const limit = Math.max(1, player.multiShot || 1);
        const targets = [];
        const focus = this.monsters.find(monster => monster.id === this.focusTargetId && monster.hp > 0);
        if (focus) targets.push(focus);
        this.getTargets(origin, { strategy: 'nearest', limit: limit + 1 }).forEach(target => {
            if (!targets.includes(target) && targets.length < limit) targets.push(target);
        });
        targets.forEach(target => this.fireBullet(target));
    }

    fireBullet(target) {
        if (!this.playerSystem || !target) return null;
        const player = this.playerSystem.player;
        const targetPoint = this.getEntityCenter(target);
        const origin = this.getPlayerBulletOrigin(targetPoint);
        const isCrit = this.random() * 100 < (player.crit || 0);
        let damage = this.getPlayerAttackDamage();
        if (isCrit) damage *= (player.critDamage || 150) / 100;
        this.playerSystem.playAttackAnimation?.();
        const bullet = {
            id: this.nextBulletId++,
            source: 'hero',
            x: origin.x,
            y: origin.y,
            targetId: target.id,
            speed: this.config.bulletSpeed,
            damage,
            isCrit,
            size: isCrit ? 9 : 7,
            color: isCrit ? '#ff7043' : '#ffd167',
            effects: {}
        };
        this.bullets.push(bullet);
        return bullet;
    }

    getPlayerBulletOrigin(targetPoint) {
        if (typeof this.playerSystem?.getGunMuzzlePosition === 'function') {
            return this.playerSystem.getGunMuzzlePosition(targetPoint);
        }
        return this.getHeroCenter();
    }

    getPlayerAttackDamage() {
        const baseAttack = this.playerSystem?.player?.attack || 1;
        const territoryBonuses = this.territorySystem?.calculateBonuses?.() || {};
        return baseAttack + (territoryBonuses.attack || 0);
    }

    updateMonsters(deltaTime) {
        const dt = deltaTime / 1000;
        const hero = this.getHeroCenter();
        this.monsters.slice().forEach(monster => {
            monster.slowTimer = Math.max(0, (monster.slowTimer || 0) - deltaTime);
            monster.stunTimer = Math.max(0, (monster.stunTimer || 0) - deltaTime);
            if (monster.slowTimer <= 0) monster.slowFactor = 1;
            if (monster.stunTimer > 0) {
                monster.combatState = 'idle';
                return;
            }

            const center = this.getEntityCenter(monster);
            const dx = hero.x - center.x;
            const dy = hero.y - center.y;
            const distance = Math.hypot(dx, dy);
            monster.progress = Math.max(0, Math.min(1, 1 - distance / Math.max(1, this.mapWidth)));
            if (distance > monster.engageRange) {
                const safeDistance = distance || 1;
                const travel = Math.min(distance - monster.engageRange, monster.speed * (monster.slowFactor || 1) * dt);
                monster.x += (dx / safeDistance) * travel;
                monster.y += (dy / safeDistance) * travel;
                monster.combatState = 'move';
                return;
            }

            monster.combatState = 'attack';
            monster.attackCooldown -= deltaTime;
            if (monster.attackCooldown <= 0) {
                monster.attackCooldown += monster.attackInterval;
                this.damageHero(monster.attack, monster);
            }
        });
    }

    damageHero(rawDamage, monster = null) {
        if (this.settled || this.runHp <= 0) return 0;
        const playerDefense = this.playerSystem?.player?.defense || 0;
        const territoryDefense = this.territorySystem?.calculateBonuses?.().defense || 0;
        let damage = Math.max(1, Math.floor(rawDamage - (playerDefense + territoryDefense) * 0.32));
        if (this.guardTimer > 0) damage = Math.max(1, Math.floor(damage * (1 - this.config.skillGuardReduction)));
        this.runHp = Math.max(0, this.runHp - damage);
        const hero = this.getHeroCenter();
        this.addStatusText(hero.x, hero.y - 34, `-${damage}`, '#ff667d', true);
        this.explosions.push({
            x: hero.x,
            y: hero.y,
            radius: monster?.isBoss ? 25 : 14,
            life: 340,
            color: '#ff4757'
        });
        if (this.runHp <= 0) this.finishExpedition(false, 'defeated');
        this.notifyStateChange();
        return damage;
    }

    damageBase(rawDamage, monster = null) {
        return this.damageHero(rawDamage, monster);
    }

    healHero(amount) {
        const previous = this.runHp;
        this.runHp = Math.min(this.runMaxHp, this.runHp + Math.max(0, Math.floor(amount || 0)));
        const actual = this.runHp - previous;
        if (actual > 0) {
            const hero = this.getHeroCenter();
            this.addStatusText(hero.x, hero.y - 34, `+${actual}`, '#8dffb5', true);
        }
        return actual;
    }

    updateBullets(deltaTime) {
        const dt = deltaTime / 1000;
        const remaining = [];
        this.bullets.forEach(bullet => {
            const target = this.monsters.find(monster => monster.id === bullet.targetId && monster.hp > 0);
            if (!target) return;
            const targetPoint = this.getEntityCenter(target);
            const dx = targetPoint.x - bullet.x;
            const dy = targetPoint.y - bullet.y;
            const distance = Math.hypot(dx, dy);
            const travel = bullet.speed * dt;
            if (distance <= travel + Math.max(5, target.width * 0.25)) {
                bullet.x = targetPoint.x;
                bullet.y = targetPoint.y;
                this.resolveBulletHit(bullet, target);
                return;
            }
            const safeDistance = distance || 1;
            bullet.vx = (dx / safeDistance) * bullet.speed;
            bullet.vy = (dy / safeDistance) * bullet.speed;
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            remaining.push(bullet);
        });
        this.bullets = remaining;
    }

    resolveBulletHit(bullet, target) {
        this.applyDamage(target, bullet.damage, { isCrit: bullet.isCrit });
        this.explosions.push({
            x: bullet.x,
            y: bullet.y,
            radius: bullet.isCrit ? 13 : 8,
            life: 260,
            color: bullet.color
        });
    }

    applyDamage(monster, damage, options = {}) {
        if (!monster || monster.hp <= 0 || !this.monsters.includes(monster)) return false;
        const finalDamage = Math.max(1, Math.floor(damage));
        monster.hp -= finalDamage;
        this.addCombatText(
            monster.x + monster.width / 2,
            monster.y,
            finalDamage,
            Boolean(options.isCrit)
        );
        if (monster.hp <= 0) {
            this.onMonsterKilled(monster);
            this.monsters = this.monsters.filter(item => item !== monster);
            if (this.focusTargetId === monster.id) this.focusTargetId = null;
        }
        return true;
    }

    applyPetDamage(monster, damage, isCrit = false) {
        return this.applyDamage(monster, damage, { isCrit });
    }

    onMonsterKilled(monster) {
        if (!monster || monster.rewardGranted) return;
        monster.rewardGranted = true;
        this.encounterRewards.coins += monster.coinReward || 0;
        this.encounterRewards.crystals += monster.crystalReward || 0;
        this.encounterRewards.exp += monster.expReward || 0;
        this.encounterRewards.kills += 1;
        this.explosions.push({
            x: monster.x + monster.width / 2,
            y: monster.y + monster.height / 2,
            radius: monster.isBoss ? 30 : 13,
            life: monster.isBoss ? 520 : 300,
            color: monster.isBoss ? '#ff7043' : '#ffd167'
        });
        this.notifyStateChange();
    }

    finishEncounter() {
        if (!this.currentEncounter || this.runSystem.phase !== 'combat') return null;
        const type = this.currentEncounter.type;
        const lootQuality = type === 'boss' ? 5 : type === 'elite' ? 3 : type === 'ambush' ? 1 : 0;
        const lootCount = type === 'boss' ? 3 : type === 'elite' ? 2 : 1;
        const rewards = { ...this.encounterRewards };
        const result = this.runSystem.completeCombat(rewards, { lootQuality, lootCount });
        this.encounterRewardsCommitted = true;
        this.currentEncounter = null;
        this.encounterQueue = [];
        this.bullets = [];
        this.addBannerText(type === 'boss' ? '核心守卫已击败' : '区域清理完成', '#8dffb5');
        this.placeHeroAtCamp();
        this.notifyStateChange();
        return result;
    }

    commitEncounterRewards() {
        if (this.encounterRewardsCommitted) return;
        if (this.encounterRewards.kills > 0) this.runSystem.addPendingRewards(this.encounterRewards);
        this.encounterRewardsCommitted = true;
    }

    finishExpedition(extracted, reason) {
        if (this.settled) return this.lastSettlement;
        this.commitEncounterRewards();
        this.settled = true;
        const baseSettlement = this.runSystem.finishRun({ extracted, reason });
        const territoryExpBonus = this.territorySystem?.calculateBonuses?.().expBonus || 0;
        const settlement = {
            ...baseSettlement,
            exp: Math.floor(baseSettlement.exp * (1 + territoryExpBonus / 100))
        };

        this.resourceSystem?.addCoins?.(settlement.coins);
        this.resourceSystem?.addCrystals?.(settlement.crystals);
        this.playerSystem?.addExperience?.(settlement.exp);
        this.meta.bestDepth = Math.max(this.meta.bestDepth, settlement.depth);
        if (settlement.extracted) this.meta.extractions += 1;
        else this.meta.losses += 1;
        this.lastSettlement = settlement;
        this.monsters = [];
        this.bullets = [];
        this.encounterQueue = [];
        this.currentEncounter = null;
        this.extractionTimer = 0;
        this.addBannerText(settlement.extracted ? '撤离成功！' : '远征失败', settlement.extracted ? '#72d7ff' : '#ff667d');
        this.notifyStateChange();
        return settlement;
    }

    clearEncounter() {
        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
        this.encounterQueue = [];
        this.currentEncounter = null;
        this.encounterRewards = this.createEmptyRewards();
        this.encounterRewardsCommitted = false;
        this.nextMonsterId = 1;
        this.nextBulletId = 1;
        this.encounterSpawnTimer = 0;
        this.attackTimer = 0;
        this.extractionTimer = 0;
        this.focusTargetId = null;
    }

    createEmptyRewards() {
        return { coins: 0, crystals: 0, exp: 0, kills: 0 };
    }

    calculateRunMaxHp() {
        const player = this.playerSystem?.player || {};
        const bonuses = this.territorySystem?.calculateBonuses?.() || {};
        return Math.max(80, Math.floor((player.maxHp || 100) + (bonuses.defense || 0) * 3));
    }

    getRunHeroState() {
        return {
            hp: this.runHp,
            maxHp: this.runMaxHp,
            guardActive: this.guardTimer > 0
        };
    }

    getPetSkillsState() {
        return (this.petSystem?.equippedPets || []).map(pet => {
            const template = this.petSystem?.getTemplate?.(pet.templateId);
            const cooldownMs = Math.max(0, this.skillCooldowns.get(pet.instanceId) || 0);
            return {
                instanceId: pet.instanceId,
                name: template?.name || '宠物',
                emoji: template?.emoji || '●',
                type: template?.type || 'default',
                color: PET_ROLE_COLORS[template?.type] || PET_ROLE_COLORS.default,
                skillName: template?.skill?.name || '伙伴技能',
                cooldownMs,
                cooldownSeconds: Math.ceil(cooldownMs / 1000),
                ready: cooldownMs <= 0 && this.isCombatActive()
            };
        });
    }

    updateSkillCooldowns(deltaTime) {
        for (const [instanceId, remaining] of this.skillCooldowns.entries()) {
            const next = Math.max(0, remaining - deltaTime);
            if (next <= 0) this.skillCooldowns.delete(instanceId);
            else this.skillCooldowns.set(instanceId, next);
        }
    }

    isCombatActive() {
        return this.runSystem.phase === 'combat' || this.runSystem.phase === 'extracting';
    }

    isWaveActive() {
        return this.isCombatActive();
    }

    getBattleState() {
        const run = this.runSystem.getState();
        const pendingRewards = {
            coins: run.pendingRewards.coins + (this.encounterRewardsCommitted ? 0 : this.encounterRewards.coins),
            crystals: run.pendingRewards.crystals + (this.encounterRewardsCommitted ? 0 : this.encounterRewards.crystals),
            exp: run.pendingRewards.exp + (this.encounterRewardsCommitted ? 0 : this.encounterRewards.exp),
            kills: run.pendingRewards.kills + (this.encounterRewardsCommitted ? 0 : this.encounterRewards.kills)
        };
        const pendingValue = pendingRewards.coins + run.backpackRewards.score;
        const phase = run.phase;
        return {
            mode: this.mode,
            phase,
            phaseLabel: this.getPhaseLabel(phase),
            depth: run.depth,
            maxDepth: run.maxDepth,
            currentWave: run.depth,
            totalWaves: run.maxDepth,
            hp: this.runHp,
            maxHp: this.runMaxHp,
            baseHp: this.runHp,
            baseMaxHp: this.runMaxHp,
            threat: run.threat,
            supplies: run.supplies,
            energy: run.supplies,
            activeEnemies: this.monsters.length,
            queuedEnemies: this.encounterQueue.length,
            backpack: run.backpack,
            backpackCount: run.backpack.length,
            backpackCapacity: run.backpackCapacity,
            backpackRewards: run.backpackRewards,
            pendingValue,
            rewards: pendingRewards,
            currentNode: run.currentNode,
            routeChoices: run.routeChoices,
            lastAction: run.lastAction,
            petSkills: this.getPetSkillsState(),
            extraction: {
                unlocked: run.depth >= run.minExtractionDepth,
                canExtract: run.canExtract,
                remainingMs: this.extractionTimer,
                remainingSeconds: Math.ceil(this.extractionTimer / 1000)
            },
            actions: {
                canStart: phase === 'briefing' || phase === 'extracted' || phase === 'defeat',
                canChooseRoute: phase === 'route',
                canSearch: phase === 'search',
                canRest: phase === 'camp',
                canExtract: run.canExtract,
                canHeal: run.active && run.supplies > 0 && this.runHp < this.runMaxHp,
                canAbandon: run.active,
                canRestart: !run.active
            },
            canStartWave: phase === 'briefing',
            isWaveActive: this.isCombatActive(),
            settlement: this.lastSettlement ? { ...this.lastSettlement } : null,
            meta: { ...this.meta }
        };
    }

    getPhaseLabel(phase = this.runSystem.phase) {
        const labels = {
            briefing: '远征整备',
            route: '选择路线',
            search: '搜索区域',
            camp: '安全休整',
            combat: '遭遇战斗',
            'extraction-ready': '等待撤离',
            extracting: '撤离守点',
            extracted: '撤离成功',
            defeat: '远征失败'
        };
        return labels[phase] || '远征终端';
    }

    getEncounterTitle(type) {
        const labels = {
            combat: '巡逻队来袭',
            elite: '精英遭遇',
            boss: '核心守卫出现',
            ambush: '搜索遭伏击',
            extraction: '撤离守点开始'
        };
        return labels[type] || '遭遇战斗';
    }

    notifyStateChange() {
        if (!this.onStateChange) return;
        try {
            this.onStateChange(this.getBattleState());
        } catch (error) {
            console.warn('[CombatSystem] 战斗状态回调失败:', error);
        }
    }

    acquireTarget(origin, options = {}) {
        return this.targetingSystem.acquireTarget(origin, this.monsters, options);
    }

    getTargets(origin, options = {}) {
        return this.targetingSystem.getTargets(origin, this.monsters, options);
    }

    getNearestMonster(x, y) {
        return this.acquireTarget({ x, y }, { strategy: 'nearest' });
    }

    getAliveMonsters() {
        return this.targetingSystem.getAliveTargets(this.monsters);
    }

    getEntityCenter(entity) {
        return {
            x: (Number.isFinite(entity?.x) ? entity.x : 0) + (entity?.width || 0) / 2,
            y: (Number.isFinite(entity?.y) ? entity.y : 0) + (entity?.height || 0) / 2
        };
    }

    getHeroCenter() {
        return this.getEntityCenter(this.playerSystem?.player || this.getHeroPosition());
    }

    getHeroPosition() {
        const width = this.playerSystem?.player?.width || 40;
        const height = this.playerSystem?.player?.height || 40;
        return {
            x: this.mapWidth * 0.18 - width / 2,
            y: this.mapHeight * 0.58 - height / 2,
            width,
            height
        };
    }

    getBasePosition() {
        const hero = this.getHeroPosition();
        return { x: hero.x + hero.width / 2, y: hero.y + hero.height / 2 };
    }

    placeHeroAtCamp() {
        if (!this.playerSystem?.player) return;
        const position = this.getHeroPosition();
        this.playerSystem.player.x = position.x;
        this.playerSystem.player.y = position.y;
    }

    placeHeroAtBase() {
        this.placeHeroAtCamp();
    }

    getTowerRenderData() {
        return [];
    }

    getTowerSlotRadius() {
        return 0;
    }

    checkCollisions() {
        return this.bullets.length;
    }

    isColliding(a, b) {
        const aCenter = this.getEntityCenter(a);
        const bCenter = this.getEntityCenter(b);
        const aRadius = (a.size || Math.max(a.width || 0, a.height || 0)) / 2;
        const bRadius = (b.size || Math.max(b.width || 0, b.height || 0)) / 2;
        return Math.hypot(aCenter.x - bCenter.x, aCenter.y - bCenter.y) <= aRadius + bRadius;
    }

    addCombatText(x, y, damage, isCrit = false) {
        this.combatTexts.push({
            x,
            y,
            text: isCrit ? `${damage}!` : String(damage),
            color: isCrit ? '#ff7043' : '#ffd167',
            life: 800,
            maxLife: 800,
            size: isCrit ? 18 : 14
        });
    }

    addStatusText(x, y, text, color = '#ffffff', large = false) {
        this.combatTexts.push({
            x,
            y,
            text,
            color,
            life: large ? 1050 : 800,
            maxLife: large ? 1050 : 800,
            size: large ? 22 : 15
        });
    }

    addBannerText(text, color = '#ffd167') {
        this.combatTexts.push({
            x: this.mapWidth / 2,
            y: this.mapHeight * 0.28,
            text,
            color,
            life: 1500,
            maxLife: 1500,
            size: Math.max(20, Math.min(34, this.mapWidth * 0.035)),
            banner: true
        });
    }

    updateExplosions(deltaTime) {
        this.explosions = this.explosions.filter(explosion => {
            explosion.life -= deltaTime;
            explosion.radius += deltaTime * 0.025;
            return explosion.life > 0;
        });
    }

    updateCombatTexts(deltaTime) {
        this.combatTexts = this.combatTexts.filter(text => {
            text.life -= deltaTime;
            if (!text.banner) text.y -= deltaTime * 0.035;
            return text.life > 0;
        });
    }

    render(ctx) {
        this.renderWorld(ctx);
        this.renderFloatingTexts(ctx);
    }

    renderBattlefieldBackground(ctx) {
        const width = this.mapWidth;
        const height = this.mapHeight;
        const threatRatio = (this.runSystem.threat || 0) / 100;
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#101b24');
        gradient.addColorStop(0.56, '#182726');
        gradient.addColorStop(1, threatRatio > 0.6 ? '#3a1d25' : '#211b24');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        const tile = Math.max(38, Math.floor(Math.min(width, height) / 10));
        ctx.strokeStyle = `rgba(123, 215, 255, ${0.06 + (1 - threatRatio) * 0.03})`;
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += tile) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += tile) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.42)';
        ctx.strokeStyle = 'rgba(255, 209, 103, 0.14)';
        ctx.lineWidth = 3;
        const roomMargin = Math.min(width, height) * 0.08;
        ctx.fillRect(roomMargin, height * 0.14, width - roomMargin * 2, height * 0.72);
        ctx.strokeRect(roomMargin, height * 0.14, width - roomMargin * 2, height * 0.72);
        ctx.restore();

        if (threatRatio > 0.35) {
            const danger = ctx.createRadialGradient(width * 0.82, height * 0.46, 0, width * 0.82, height * 0.46, width * 0.5);
            danger.addColorStop(0, `rgba(255, 71, 87, ${threatRatio * 0.15})`);
            danger.addColorStop(1, 'rgba(255, 71, 87, 0)');
            ctx.fillStyle = danger;
            ctx.fillRect(0, 0, width, height);
        }
    }

    renderWorld(ctx) {
        this.renderFocusTarget(ctx);
        this.monsters.forEach(monster => this.renderMonster(ctx, monster));
        this.bullets.forEach(bullet => this.renderBullet(ctx, bullet));
        this.explosions.forEach(explosion => this.renderExplosion(ctx, explosion));
        this.renderExtractionProgress(ctx);
        this.renderPhasePrompt(ctx);
    }

    renderFloatingTexts(ctx) {
        this.combatTexts.forEach(text => this.renderCombatText(ctx, text));
    }

    renderFocusTarget(ctx) {
        const target = this.monsters.find(monster => monster.id === this.focusTargetId);
        if (!target) return;
        const center = this.getEntityCenter(target);
        ctx.save();
        ctx.strokeStyle = '#fff1a7';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(center.x, center.y, Math.max(target.width, target.height) * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    renderMonster(ctx, monster) {
        const image = this.monsterImages[monster.templateId];
        const animationState = monster.stunTimer > 0 ? 'idle' : monster.combatState;
        const sheet = this.getMonsterStateSheet(monster.templateId, animationState);
        const visualScale = monster.isBoss ? 2.05 : (monster.isElite ? 1.8 : 1.58);
        const renderWidth = monster.width * visualScale;
        const renderHeight = monster.height * visualScale;
        const renderX = monster.x + monster.width / 2 - renderWidth / 2;
        const renderY = monster.y + monster.height / 2 - renderHeight / 2;

        if (sheet && sheet.complete && sheet.naturalWidth > 0) {
            const frameSize = 512;
            const frameIndex = Math.floor((Date.now() + monster.animationOffset) / this.getMonsterFrameDuration(animationState)) % 4;
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (monster.isBoss || monster.isElite) {
                ctx.shadowColor = monster.isBoss ? '#ff7043' : '#c38cff';
                ctx.shadowBlur = monster.isBoss ? 20 : 11;
            }
            ctx.drawImage(sheet, frameIndex * frameSize, 0, frameSize, frameSize, renderX, renderY, renderWidth, renderHeight);
            ctx.restore();
        } else if (image && image.complete && image.naturalWidth > 0) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(image, renderX, renderY, renderWidth, renderHeight);
            ctx.restore();
        } else {
            ctx.fillStyle = monster.isBoss ? '#ff7043' : (monster.isElite ? '#c38cff' : '#ff667d');
            ctx.beginPath();
            ctx.arc(monster.x + monster.width / 2, monster.y + monster.height / 2, monster.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        const barWidth = monster.isBoss ? monster.width * 1.5 : monster.width;
        const barHeight = monster.isBoss ? 7 : 5;
        const barX = monster.x + monster.width / 2 - barWidth / 2;
        const barY = monster.y - 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        ctx.fillStyle = monster.isBoss ? '#ff7043' : (monster.slowTimer > 0 ? '#72d7ff' : '#63d471');
        ctx.fillRect(barX, barY, barWidth * Math.max(0, monster.hp / monster.maxHp), barHeight);
        if (monster.isBoss || monster.isElite) {
            ctx.fillStyle = monster.isBoss ? '#ffb36b' : '#d5a8ff';
            ctx.font = `bold ${monster.isBoss ? 13 : 10}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(monster.isBoss ? 'BOSS' : '精英', monster.x + monster.width / 2, barY - 6);
        }
    }

    getMonsterStateSheet(templateId, state) {
        const sheets = this.monsterAnimationSheets[templateId];
        return sheets?.[state] || sheets?.move || sheets?.idle;
    }

    getMonsterFrameDuration(state) {
        if (state === 'attack') return 82;
        return state === 'move' ? 115 : 175;
    }

    renderBullet(ctx, bullet) {
        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        ctx.rotate(Math.atan2(bullet.vy || 0, bullet.vx || 1));
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(0, 0, bullet.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(-bullet.size * 2.2, -1.5, bullet.size * 1.5, 3);
        ctx.restore();
    }

    renderExplosion(ctx, explosion) {
        const alpha = Math.max(0, Math.min(1, explosion.life / 300));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = explosion.color || '#ff7043';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    renderCombatText(ctx, text) {
        const alpha = Math.max(0, Math.min(1, text.life / (text.maxLife || 800)));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${text.size}px Arial`;
        ctx.fillStyle = text.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(text.text, text.x, text.y);
        ctx.restore();
    }

    renderExtractionProgress(ctx) {
        if (this.runSystem.phase !== 'extracting') return;
        const state = this.getBattleState();
        const total = Math.max(1, this.currentEncounter?.durationMs || 1);
        const ratio = 1 - Math.min(1, this.extractionTimer / total);
        const width = Math.min(this.mapWidth * 0.54, 430);
        const x = (this.mapWidth - width) / 2;
        const y = this.mapHeight * 0.12;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.82)';
        ctx.fillRect(x - 12, y - 24, width + 24, 48);
        ctx.fillStyle = '#1f2935';
        ctx.fillRect(x, y, width, 10);
        ctx.fillStyle = '#72d7ff';
        ctx.fillRect(x, y, width * ratio, 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`撤离倒计时 ${state.extraction.remainingSeconds} 秒`, this.mapWidth / 2, y - 7);
        ctx.restore();
    }

    renderPhasePrompt(ctx) {
        if (this.isCombatActive()) return;
        const messages = {
            briefing: '开始远征：搜索物资，击败敌人，并选择合适时机撤离',
            route: this.runSystem.canExtract() ? '继续深入，或现在撤离带走战利品' : '在右侧终端选择下一处区域',
            search: '选择搜索方式：收益越高，伏击与威胁也越高',
            camp: '安全屋可以恢复生命并降低威胁',
            'extraction-ready': '已锁定撤离点，启动信标并守住倒计时',
            extracted: '撤离成功，奖励已经结算',
            defeat: '远征失败，点击“再次远征”重新整备'
        };
        const message = messages[this.runSystem.phase];
        if (!message) return;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.76)';
        const boxWidth = Math.min(this.mapWidth * 0.72, 560);
        const boxHeight = 58;
        const x = (this.mapWidth - boxWidth) / 2;
        const y = this.mapHeight * 0.43;
        ctx.fillRect(x, y, boxWidth, boxHeight);
        ctx.strokeStyle = this.runSystem.canExtract() ? '#72d7ff' : '#ffd167';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, boxWidth, boxHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(12, Math.min(17, this.mapWidth * 0.023))}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(message, this.mapWidth / 2, y + boxHeight / 2);
        ctx.restore();
    }

    getSaveData() {
        return {
            mode: this.mode,
            meta: { ...this.meta }
        };
    }

    loadSaveData(data) {
        if (data?.meta) {
            this.meta.bestDepth = Math.max(0, Number(data.meta.bestDepth ?? data.meta.bestWave) || 0);
            this.meta.extractions = Math.max(0, Number(data.meta.extractions ?? data.meta.victories) || 0);
            this.meta.losses = Math.max(0, Number(data.meta.losses ?? data.meta.defeats) || 0);
        }
        this.resetBattle();
    }
}

export function getCombatSystemInstance() {
    if (!instance) instance = new CombatSystem();
    return instance;
}
