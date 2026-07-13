/**
 * CombatSystem - 宠物远征（单局 RPG 搜打撤）
 *
 * ExpeditionRunSystem 负责路线和结算，本类负责战斗实体、主动技能与 Canvas 渲染。
 */

import { ExpeditionRunSystem } from './expedition-run-system.js?v=pet-loop-20260713a';
import { ExpeditionWorldSystem } from './expedition-world-system.js?v=world-exploration-20260712b';
import { CameraSystem } from './camera-system.js?v=world-exploration-20260712b';
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
    constructor({ random = Math.random, runOptions = {}, worldOptions = {} } = {}) {
        this.mode = 'extractionRpg';
        this.isPaused = true;
        this.random = typeof random === 'function' ? random : Math.random;
        this.targetingSystem = new TargetingSystem();
        this.runSystem = new ExpeditionRunSystem({ random: this.random, ...runOptions });
        this.worldSystem = new ExpeditionWorldSystem(worldOptions);
        this.cameraSystem = new CameraSystem({
            worldWidth: this.worldSystem.width,
            worldHeight: this.worldSystem.height,
            viewportWidth: 750,
            viewportHeight: 900
        });
        this.movementInput = { x: 0, y: 0 };
        this.nearbyLocation = null;
        this.lastNearbyLocationId = null;
        this.worldRevision = 0;
        this.runPreparation = { attack: 0, defense: 0, supplies: 0, expBonus: 0 };

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
            skillGuardReduction: 0.42,
            heroMoveSpeed: 235,
            heroAttackRange: 520,
            petAcquireRange: 430
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

    setViewportSize(width, height) {
        this.mapWidth = Math.max(1, Math.floor(Number(width) || 1));
        this.mapHeight = Math.max(1, Math.floor(Number(height) || 1));
        this.cameraSystem.setViewportSize(this.mapWidth, this.mapHeight);
        if (this.playerSystem?.player && this.worldSystem.initialized) {
            const center = this.getHeroCenter();
            this.cameraSystem.snapTo(center.x, center.y);
        }
    }

    getWorldBounds() {
        return {
            minX: 18,
            minY: 18,
            maxX: this.worldSystem.width - 18,
            maxY: this.worldSystem.height - 18,
            width: this.worldSystem.width,
            height: this.worldSystem.height
        };
    }

    canMoveHero() {
        return Boolean(
            this.runSystem.active &&
            ['route', 'combat', 'extraction-ready', 'extracting'].includes(this.runSystem.phase)
        );
    }

    setMovementInput(x = 0, y = 0) {
        const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
        const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
        const length = Math.hypot(safeX, safeY);
        this.movementInput = length > 1
            ? { x: safeX / length, y: safeY / length }
            : { x: safeX, y: safeY };
        return { ...this.movementInput };
    }

    clearMovementInput() {
        this.movementInput = { x: 0, y: 0 };
        return { ...this.movementInput };
    }

    updateHeroMovement(player, deltaTime) {
        if (!player || this.isPaused || !this.canMoveHero()) {
            return { moved: false, blockedX: false, blockedY: false };
        }
        const length = Math.hypot(this.movementInput.x, this.movementInput.y);
        if (length <= 0.001) {
            this.updateWorldAwareness();
            return { moved: false, blockedX: false, blockedY: false };
        }

        const safeDelta = Math.max(0, Math.min(Number(deltaTime) || 0, 100));
        const speed = this.config.heroMoveSpeed + (player.attackSpeed || 1) * 12;
        const scale = (speed * safeDelta) / 1000;
        const result = this.worldSystem.moveEntity(
            player,
            this.movementInput.x * scale,
            this.movementInput.y * scale
        );
        this.updateWorldAwareness();
        return result;
    }

    updateWorldAwareness() {
        if (!this.playerSystem?.player || !this.worldSystem.initialized) return null;
        const center = this.getHeroCenter();
        const nearby = this.worldSystem.updatePlayerPosition(center.x, center.y);
        const nearbyId = nearby?.id || null;
        this.nearbyLocation = nearby;
        if (nearbyId !== this.lastNearbyLocationId) {
            this.lastNearbyLocationId = nearbyId;
            this.worldRevision += 1;
            if (nearby) this.addStatusText(center.x, center.y - 54, `发现：${nearby.name}`, nearby.color || '#ffd167');
        }
        return nearby;
    }

    syncWorldWithRunState() {
        const run = this.runSystem.getState();
        this.worldSystem.syncRouteChoices(run.routeChoices);
        this.worldSystem.setExtractionUnlocked(run.depth >= run.minExtractionDepth);
        if (run.phase === 'extraction-ready') {
            this.worldSystem.trackLocation('extraction-beacon');
        }
        this.worldRevision += 1;
        this.updateWorldAwareness();
        return this.worldSystem.getState(this.getHeroCenter());
    }

    trackLocation(nodeId) {
        const result = this.worldSystem.trackLocation(nodeId);
        if (result.success) {
            const center = this.getHeroCenter();
            const distance = this.worldSystem.getDistanceToLocation(result.location.id, center.x, center.y);
            result.message = `已追踪 ${result.location.name}，距离 ${Math.round(distance)} 米`;
            this.worldRevision += 1;
            this.notifyStateChange();
        }
        return result;
    }

    interactWithNearbyLocation() {
        if (!this.runSystem.active) return { success: false, message: '请先开始远征' };
        const nearby = this.updateWorldAwareness();
        if (!nearby) return { success: false, message: '附近没有可交互地点' };
        if (nearby.kind === 'extraction') {
            if (!this.runSystem.canExtract()) {
                return { success: false, message: `至少清理 ${this.runSystem.minExtractionDepth} 个区域后才能撤离` };
            }
            return this.requestExtraction();
        }
        if (this.runSystem.phase !== 'route') {
            return { success: false, message: '请先完成当前地点事件' };
        }
        return this.chooseRoute(nearby.nodeId, { requireProximity: true });
    }

    screenToWorld(x, y) {
        return this.cameraSystem.screenToWorld(x, y);
    }

    getInteractionState() {
        const center = this.getHeroCenter();
        const nearby = this.nearbyLocation;
        if (!nearby) {
            const target = this.worldSystem.getState(center).navigationTarget;
            return {
                available: false,
                label: '靠近地点后交互',
                detail: target ? `追踪 ${target.name} · ${target.distance}m` : 'WASD / 方向键移动',
                location: null
            };
        }
        const extractionBlocked = nearby.kind === 'extraction' && !this.runSystem.canExtract();
        const validPhase = nearby.kind === 'extraction'
            ? ['route', 'extraction-ready'].includes(this.runSystem.phase)
            : this.runSystem.phase === 'route';
        return {
            available: !extractionBlocked && validPhase,
            label: extractionBlocked
                ? '撤离信标尚未解锁'
                : nearby.kind === 'extraction'
                    ? '启动撤离信标'
                    : `进入 ${nearby.name}`,
            detail: extractionBlocked
                ? `还需清理 ${Math.max(0, this.runSystem.minExtractionDepth - this.runSystem.depth)} 个区域`
                : '按 E 或点击交互',
            location: { ...nearby }
        };
    }

    prepareBattle() {
        if (!this.battleInitialized) this.resetBattle();
        else {
            this.updateWorldAwareness();
            this.notifyStateChange();
        }
        return this.getBattleState();
    }

    resetBattle() {
        this.clearEncounter();
        this.petSystem?.resetBattleStates?.();
        this.runSystem.reset();
        this.worldSystem.reset();
        this.clearMovementInput();
        this.nearbyLocation = null;
        this.lastNearbyLocationId = null;
        this.runMaxHp = this.calculateRunMaxHp();
        this.runHp = this.runMaxHp;
        this.skillCooldowns.clear();
        this.guardTimer = 0;
        this.lastSettlement = null;
        this.settled = false;
        this.battleInitialized = true;
        this.placeHeroAtCamp({ force: true });
        this.notifyStateChange();
        return { success: true, message: '远征终端已就绪' };
    }

    startRun() {
        if (!this.battleInitialized) this.resetBattle();
        const phase = this.runSystem.phase;
        if (phase === 'extracted' || phase === 'defeat') this.resetBattle();

        const permanentBonuses = this.territorySystem?.calculateBonuses?.() || {};
        const preparedBonuses = this.territorySystem?.getPreparedBonuses?.()
            || { attack: 0, defense: 0, supplies: 0, expBonus: 0 };
        const result = this.runSystem.startRun({
            supplies: 2 + (permanentBonuses.supplyBonus || 0) + (preparedBonuses.supplies || 0),
            backpackCapacity: 8
        });
        if (!result.success) return result;
        this.runPreparation = this.territorySystem?.consumePreparedBonuses?.()
            || { ...preparedBonuses };

        this.clearEncounter();
        this.petSystem?.resetBattleStates?.();
        this.runMaxHp = this.calculateRunMaxHp();
        this.runHp = this.runMaxHp;
        this.skillCooldowns.clear();
        this.lastSettlement = null;
        this.settled = false;
        this.worldSystem.startRun(this.runSystem.getState().routeChoices);
        this.placeHeroAtCamp({ force: true });
        this.syncWorldWithRunState();
        this.addBannerText('远征开始', '#ffd167');
        this.notifyStateChange();
        return result;
    }

    startExpedition() {
        return this.startRun();
    }

    chooseRoute(nodeId, { requireProximity = false } = {}) {
        if (requireProximity && this.nearbyLocation?.nodeId !== nodeId) {
            return { success: false, message: '请先走到目标地点附近' };
        }
        const result = this.runSystem.chooseNode(nodeId);
        if (result.success) {
            this.worldSystem.engageLocation(nodeId);
            this.worldRevision += 1;
            if (result.encounter) this.beginEncounter(result.encounter);
        }
        this.notifyStateChange();
        return result;
    }

    searchArea(mode) {
        const result = this.runSystem.resolveSearch(mode, {
            hasPet: Boolean(this.petSystem?.equippedPets?.length),
            searchBonuses: this.petSystem?.getExplorationSearchBonuses?.(mode) || {}
        });
        if (result.success && result.encounter) this.beginEncounter(result.encounter);
        else if (result.success) {
            this.worldSystem.completeActiveLocation();
            this.syncWorldWithRunState();
        }
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
            this.worldSystem.completeActiveLocation();
            this.syncWorldWithRunState();
        }
        this.notifyStateChange();
        return result;
    }

    leaveCamp() {
        const result = this.runSystem.leaveCamp();
        if (result.success) {
            this.worldSystem.completeActiveLocation();
            this.syncWorldWithRunState();
        }
        this.notifyStateChange();
        return result;
    }

    requestExtraction() {
        const nearby = this.updateWorldAwareness();
        if (this.worldSystem.initialized && nearby?.kind !== 'extraction') {
            return { success: false, message: '请返回入口撤离信标附近' };
        }
        const result = this.runSystem.startExtraction();
        if (result.success) {
            this.worldSystem.activateExtraction();
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

        const targets = this.getTargets(this.getHeroCenter(), {
            strategy: 'nearest',
            limit: 4,
            maxRange: this.config.petAcquireRange
        });
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

        const cooldownReduction = Math.min(
            0.2,
            Math.max(0, (this.territorySystem?.calculateBonuses?.().petCooldownReduction || 0) / 100)
        );
        const cooldown = Math.max(
            3000,
            Math.floor((template.skill?.cooldown || 6000) * (1 - cooldownReduction))
        );
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

    selectTargetAt(x, y, { screenSpace = true } = {}) {
        if (!this.isCombatActive()) return { success: false, message: '' };
        const point = screenSpace ? this.screenToWorld(x, y) : { x, y };
        const target = this.monsters
            .map(monster => ({
                monster,
                distance: Math.hypot(
                    point.x - (monster.x + monster.width / 2),
                    point.y - (monster.y + monster.height / 2)
                )
            }))
            .filter(item => item.distance <= Math.max(34, item.monster.width))
            .sort((a, b) => a.distance - b.distance)[0]?.monster;
        if (!target) return { success: false, message: '' };
        this.focusTargetId = target.id;
        this.notifyStateChange();
        return { success: true, message: `已锁定 ${target.name}` };
    }

    selectTargetAtWorld(x, y) {
        return this.selectTargetAt(x, y, { screenSpace: false });
    }

    update(deltaTime) {
        if (!this.battleInitialized) this.resetBattle();
        const safeDelta = Math.max(0, Math.min(deltaTime, 100));
        this.updateSkillCooldowns(safeDelta);
        this.guardTimer = Math.max(0, this.guardTimer - safeDelta);
        this.uiNotifyTimer += safeDelta;
        this.updateHeroMovement(this.playerSystem?.player, safeDelta);

        if (this.isCombatActive()) {
            this.updateEncounterSpawns(safeDelta);
            this.updateAttack(safeDelta);
            this.updateMonsters(safeDelta);
            this.updateBullets(safeDelta);

            if (this.runSystem.phase === 'extracting') {
                if (this.isHeroInExtractionZone()) {
                    this.extractionTimer = Math.max(0, this.extractionTimer - safeDelta);
                }
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
        if (this.playerSystem?.player && this.worldSystem.initialized) {
            const center = this.getHeroCenter();
            this.cameraSystem.follow(center.x, center.y, safeDelta);
        }
        if (this.uiNotifyTimer >= 250) {
            this.uiNotifyTimer %= 250;
            this.notifyStateChange();
        }
    }

    isHeroInExtractionZone() {
        const location = this.worldSystem.getLocation('extraction-beacon');
        if (!location) return false;
        const hero = this.getHeroCenter();
        return Math.hypot(hero.x - location.x, hero.y - location.y)
            <= location.radius + this.worldSystem.interactionRadius;
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
        const activeLocation = this.worldSystem.getLocation(this.worldSystem.activeLocationId);
        const hero = this.getHeroCenter();
        const spawnOrigin = activeLocation
            ? { x: activeLocation.x, y: activeLocation.y }
            : hero;
        const spawnPosition = this.worldSystem.findOpenPositionNear(
            spawnOrigin,
            260 + this.random() * 170,
            this.random() * Math.PI * 2,
            size
        );

        const monster = {
            id: this.nextMonsterId++,
            templateId: template.id,
            name: template.name,
            x: spawnPosition.x,
            y: spawnPosition.y,
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
        const focus = this.monsters.find(monster => {
            if (monster.id !== this.focusTargetId || monster.hp <= 0) return false;
            const point = this.getEntityCenter(monster);
            return Math.hypot(point.x - origin.x, point.y - origin.y) <= this.config.heroAttackRange;
        });
        if (focus) targets.push(focus);
        this.getTargets(origin, {
            strategy: 'nearest',
            limit: limit + 1,
            maxRange: this.config.heroAttackRange
        }).forEach(target => {
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
        return baseAttack + (territoryBonuses.attack || 0) + (this.runPreparation.attack || 0);
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
            monster.progress = Math.max(0, Math.min(1, 1 - distance / Math.max(1, this.worldSystem.width)));
            if (distance > monster.engageRange) {
                const safeDistance = distance || 1;
                const travel = Math.min(distance - monster.engageRange, monster.speed * (monster.slowFactor || 1) * dt);
                this.worldSystem.moveEntity(
                    monster,
                    (dx / safeDistance) * travel,
                    (dy / safeDistance) * travel,
                    { padding: 10 }
                );
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
        let damage = Math.max(
            1,
            Math.floor(rawDamage - (playerDefense + territoryDefense + (this.runPreparation.defense || 0)) * 0.32)
        );
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
        this.worldSystem.completeActiveLocation();
        this.syncWorldWithRunState();
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
        const territoryBonuses = this.territorySystem?.calculateBonuses?.() || {};
        const territoryExpBonus = (territoryBonuses.expBonus || 0) + (this.runPreparation.expBonus || 0);
        const settlement = {
            ...baseSettlement,
            coins: Math.floor(baseSettlement.coins * (1 + (territoryBonuses.coinBonus || 0) / 100)),
            crystals: Math.floor(baseSettlement.crystals * (1 + (territoryBonuses.crystalBonus || 0) / 100)),
            exp: Math.floor(baseSettlement.exp * (1 + territoryExpBonus / 100))
        };
        settlement.petBond = this.petSystem?.applyExpeditionBond?.(settlement) || {
            plannedGain: 0,
            totalGain: 0,
            count: 0,
            gainedCount: 0,
            cappedCount: 0,
            pets: []
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
        this.runPreparation = { attack: 0, defense: 0, supplies: 0, expBonus: 0 };
        this.clearMovementInput();
        this.worldSystem.completeActiveLocation();
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
        return Math.max(
            80,
            Math.floor((player.maxHp || 100) + ((bonuses.defense || 0) + (this.runPreparation.defense || 0)) * 3)
        );
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
        const heroCenter = this.getHeroCenter();
        const world = this.worldSystem.getState(heroCenter);
        const camera = this.cameraSystem.getState();
        const interaction = this.getInteractionState();
        const nearExtraction = interaction.location?.kind === 'extraction';
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
            world: {
                ...world,
                revision: this.worldRevision,
                player: {
                    x: heroCenter.x,
                    y: heroCenter.y,
                    moving: Math.hypot(this.movementInput.x, this.movementInput.y) > 0.01
                },
                camera,
                canMove: this.canMoveHero()
            },
            interaction,
            petSkills: this.getPetSkillsState(),
            searchBonuses: {
                quick: this.petSystem?.getExplorationSearchBonuses?.('quick') || {},
                thorough: this.petSystem?.getExplorationSearchBonuses?.('thorough') || {},
                pet: this.petSystem?.getExplorationSearchBonuses?.('pet') || {}
            },
            extraction: {
                unlocked: run.depth >= run.minExtractionDepth,
                canExtract: run.canExtract && nearExtraction,
                inZone: this.isHeroInExtractionZone(),
                remainingMs: this.extractionTimer,
                remainingSeconds: Math.ceil(this.extractionTimer / 1000)
            },
            actions: {
                canStart: phase === 'briefing' || phase === 'extracted' || phase === 'defeat',
                canChooseRoute: phase === 'route',
                canTrackMap: phase === 'route' || phase === 'extraction-ready',
                canSearch: phase === 'search',
                canRest: phase === 'camp',
                canExtract: run.canExtract && nearExtraction,
                canInteract: interaction.available,
                canMove: this.canMoveHero(),
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
            route: '大地图探索',
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
            x: this.worldSystem.spawnPoint.x - width / 2,
            y: this.worldSystem.spawnPoint.y - height / 2,
            width,
            height
        };
    }

    getBasePosition() {
        const hero = this.getHeroPosition();
        return { x: hero.x + hero.width / 2, y: hero.y + hero.height / 2 };
    }

    placeHeroAtCamp({ force = false } = {}) {
        if (!this.playerSystem?.player) return;
        if (!force && this.runSystem.active && this.worldSystem.initialized) return;
        const position = this.getHeroPosition();
        this.playerSystem.player.x = position.x;
        this.playerSystem.player.y = position.y;
        if (this.worldSystem.initialized) {
            this.worldSystem.updatePlayerPosition(
                position.x + position.width / 2,
                position.y + position.height / 2
            );
        }
        this.cameraSystem.snapTo(
            position.x + position.width / 2,
            position.y + position.height / 2
        );
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
        this.renderExplorationFrame(ctx);
    }

    renderExplorationFrame(ctx) {
        this.renderBattlefieldBackground(ctx);
        const camera = this.cameraSystem.getState();
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        this.renderWorldTerrain(ctx);
        this.renderWorldLocations(ctx);
        this.playerSystem?.render?.(ctx);
        this.renderWorld(ctx);
        if (this.petSystem && this.playerSystem?.player) {
            const player = this.playerSystem.player;
            this.petSystem.render(
                ctx,
                player.x + player.width / 2,
                player.y + player.height / 2
            );
        }
        this.renderFloatingTexts(ctx, { screenSpace: false });
        ctx.restore();
        this.renderScreenOverlay(ctx);
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
    }

    renderWorldTerrain(ctx) {
        const width = this.worldSystem.width;
        const height = this.worldSystem.height;
        ctx.fillStyle = '#172522';
        ctx.fillRect(0, 0, width, height);

        const tile = 96;
        ctx.strokeStyle = 'rgba(123, 215, 255, 0.045)';
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

        this.renderWorldPaths(ctx);
        this.renderWorldObstacles(ctx);
    }

    renderWorld(ctx) {
        this.renderFocusTarget(ctx);
        this.monsters.forEach(monster => this.renderMonster(ctx, monster));
        this.bullets.forEach(bullet => this.renderBullet(ctx, bullet));
        this.explosions.forEach(explosion => this.renderExplosion(ctx, explosion));
    }

    renderFloatingTexts(ctx, { screenSpace = false } = {}) {
        this.combatTexts
            .filter(text => Boolean(text.banner) === Boolean(screenSpace))
            .forEach(text => {
                if (screenSpace) {
                    this.renderCombatText(ctx, {
                        ...text,
                        x: this.mapWidth / 2,
                        y: this.mapHeight * 0.25
                    });
                } else {
                    this.renderCombatText(ctx, text);
                }
            });
    }

    renderWorldPaths(ctx) {
        const locations = Array.from(this.worldSystem.locations.values())
            .filter(location => location.kind === 'route' && location.state !== 'missed')
            .sort((a, b) => (a.depth || 0) - (b.depth || 0) || (a.branch || 0) - (b.branch || 0));
        const depthCenters = new Map();
        locations.forEach(location => {
            const depth = location.depth || 0;
            if (!depthCenters.has(depth)) depthCenters.set(depth, []);
            depthCenters.get(depth).push(location);
        });
        const points = [{ ...this.worldSystem.spawnPoint }];
        for (const [, group] of Array.from(depthCenters.entries()).sort((a, b) => a[0] - b[0])) {
            points.push({
                x: group.reduce((sum, location) => sum + location.x, 0) / group.length,
                y: group.reduce((sum, location) => sum + location.y, 0) / group.length
            });
        }
        if (points.length < 2) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 58;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(92, 72, 55, 0.8)';
        ctx.lineWidth = 48;
        ctx.stroke();
        ctx.setLineDash([12, 18]);
        ctx.strokeStyle = 'rgba(255, 209, 103, 0.18)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    renderWorldObstacles(ctx) {
        this.worldSystem.obstacles.forEach(obstacle => {
            ctx.save();
            if (obstacle.type === 'water') {
                ctx.fillStyle = '#183844';
                ctx.strokeStyle = '#2e6570';
            } else if (obstacle.type === 'rocks') {
                ctx.fillStyle = '#343a3d';
                ctx.strokeStyle = '#5b6265';
            } else {
                ctx.fillStyle = '#302725';
                ctx.strokeStyle = '#705044';
            }
            ctx.lineWidth = 4;
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            for (let x = obstacle.x + 14; x < obstacle.x + obstacle.width; x += 34) {
                ctx.fillRect(x, obstacle.y + 12, 8, Math.max(8, obstacle.height - 24));
            }
            ctx.restore();
        });
    }

    renderWorldLocations(ctx) {
        const pulse = 1 + Math.sin(Date.now() / 260) * 0.08;
        for (const location of this.worldSystem.locations.values()) {
            if (location.state === 'missed') continue;
            const isTarget = location.id === this.worldSystem.navigationTargetId;
            if (!location.discovered && !isTarget && location.kind !== 'extraction') continue;
            const isLocked = location.state === 'locked';
            const isCleared = location.state === 'cleared';
            const radius = location.radius * (isTarget ? pulse : 1);

            ctx.save();
            ctx.globalAlpha = isLocked ? 0.38 : isCleared ? 0.45 : 1;
            if (isTarget && !isLocked) {
                ctx.strokeStyle = location.color || '#ffd167';
                ctx.lineWidth = 3;
                ctx.setLineDash([9, 7]);
                ctx.beginPath();
                ctx.arc(location.x, location.y, radius + 22, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(7, 10, 14, 0.9)';
            ctx.strokeStyle = isCleared ? '#59616a' : (location.color || '#ffd167');
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(location.x, location.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = isCleared ? '#7f8790' : (location.color || '#ffd167');
            ctx.font = `bold ${Math.max(22, radius * 0.62)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(isCleared ? '✓' : isLocked ? '×' : (location.icon || '◇'), location.x, location.y);

            if (location.discovered || isTarget || location.kind === 'extraction') {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px Arial';
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 4;
                ctx.fillText(location.name, location.x, location.y + radius + 22);
            }
            ctx.restore();
        }
    }

    renderScreenOverlay(ctx) {
        this.renderFogOfWar(ctx);
        this.renderNavigationGuide(ctx);
        this.renderMinimap(ctx);
        this.renderExtractionProgress(ctx);
        this.renderPhasePrompt(ctx);
        this.renderFloatingTexts(ctx, { screenSpace: true });
    }

    renderFogOfWar(ctx) {
        if (!this.runSystem.active) return;
        const hero = this.getHeroCenter();
        const screen = this.cameraSystem.worldToScreen(hero.x, hero.y);
        const outerRadius = Math.max(this.mapWidth, this.mapHeight) * 0.78;
        const gradient = ctx.createRadialGradient(
            screen.x,
            screen.y,
            95,
            screen.x,
            screen.y,
            outerRadius
        );
        gradient.addColorStop(0, 'rgba(4, 8, 12, 0)');
        gradient.addColorStop(0.42, 'rgba(4, 8, 12, 0.04)');
        gradient.addColorStop(0.74, 'rgba(4, 8, 12, 0.24)');
        gradient.addColorStop(1, 'rgba(4, 8, 12, 0.58)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.mapWidth, this.mapHeight);
    }

    renderNavigationGuide(ctx) {
        if (!this.runSystem.active) return;
        const state = this.worldSystem.getState(this.getHeroCenter());
        const target = state.navigationTarget;
        if (!target) return;
        const screen = this.cameraSystem.worldToScreen(target.x, target.y);
        const margin = 54;
        const visible = (
            screen.x >= margin && screen.x <= this.mapWidth - margin &&
            screen.y >= margin && screen.y <= this.mapHeight - margin
        );
        if (visible) return;

        const centerX = this.mapWidth / 2;
        const centerY = this.mapHeight / 2;
        const angle = Math.atan2(screen.y - centerY, screen.x - centerX);
        const radiusX = Math.max(20, this.mapWidth / 2 - margin);
        const radiusY = Math.max(20, this.mapHeight / 2 - margin);
        const scale = Math.min(
            Math.abs(radiusX / (Math.cos(angle) || 0.0001)),
            Math.abs(radiusY / (Math.sin(angle) || 0.0001))
        );
        const x = centerX + Math.cos(angle) * scale;
        const y = centerY + Math.sin(angle) * scale;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = target.color || '#ffd167';
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, -11);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-12, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    renderMinimap(ctx) {
        if (!this.worldSystem.initialized) return;
        const width = Math.min(190, Math.max(126, this.mapWidth * 0.19));
        const height = width * 0.62;
        const x = this.mapWidth - width - 14;
        const y = 112;
        const scaleX = width / this.worldSystem.width;
        const scaleY = height / this.worldSystem.height;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.86)';
        ctx.strokeStyle = '#72d7ff';
        ctx.lineWidth = 2;
        ctx.fillRect(x - 6, y - 22, width + 12, height + 30);
        ctx.strokeRect(x - 6, y - 22, width + 12, height + 30);
        ctx.fillStyle = '#dff7ff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`探索 ${this.worldSystem.getExplorationPercent().toFixed(0)}%`, x, y - 7);
        ctx.fillStyle = '#0b1517';
        ctx.fillRect(x, y, width, height);

        ctx.fillStyle = '#17302d';
        this.worldSystem.revealedCells.forEach(cell => {
            const [column, row] = cell.split(',').map(Number);
            const cellX = column * this.worldSystem.cellSize;
            const cellY = row * this.worldSystem.cellSize;
            ctx.fillRect(
                x + cellX * scaleX,
                y + cellY * scaleY,
                Math.min(width - cellX * scaleX, this.worldSystem.cellSize * scaleX + 0.7),
                Math.min(height - cellY * scaleY, this.worldSystem.cellSize * scaleY + 0.7)
            );
        });

        this.worldSystem.obstacles.forEach(obstacle => {
            if (!this.worldSystem.isAreaRevealed(obstacle)) return;
            ctx.fillStyle = obstacle.type === 'water' ? '#285a68' : '#4b4542';
            ctx.fillRect(
                x + obstacle.x * scaleX,
                y + obstacle.y * scaleY,
                Math.max(2, obstacle.width * scaleX),
                Math.max(2, obstacle.height * scaleY)
            );
        });
        for (const location of this.worldSystem.locations.values()) {
            if (location.state === 'missed') continue;
            const isTarget = location.id === this.worldSystem.navigationTargetId;
            if (!location.discovered && !isTarget && location.kind !== 'extraction') continue;
            ctx.fillStyle = location.state === 'locked'
                ? '#5b6268'
                : location.state === 'cleared'
                    ? '#748078'
                    : (location.color || '#ffd167');
            ctx.beginPath();
            ctx.arc(x + location.x * scaleX, y + location.y * scaleY, location.kind === 'extraction' ? 4 : 3, 0, Math.PI * 2);
            ctx.fill();
        }
        const hero = this.getHeroCenter();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + hero.x * scaleX, y + hero.y * scaleY, 4, 0, Math.PI * 2);
        ctx.fill();

        const camera = this.cameraSystem.getState();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            x + camera.x * scaleX,
            y + camera.y * scaleY,
            Math.min(width, camera.width * scaleX),
            Math.min(height, camera.height * scaleY)
        );
        ctx.restore();
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
        ctx.fillText(
            state.extraction.inZone
                ? `撤离倒计时 ${state.extraction.remainingSeconds} 秒`
                : `离开信标范围 · 倒计时暂停 (${state.extraction.remainingSeconds} 秒)`,
            this.mapWidth / 2,
            y - 7
        );
        ctx.restore();
    }

    renderPhasePrompt(ctx) {
        if (this.isCombatActive() || this.runSystem.phase === 'route') return;
        const messages = {
            briefing: '开始远征：用 WASD / 方向键探索大地图，靠近地点后按 E 交互',
            search: '选择搜索方式：收益越高，伏击与威胁也越高',
            camp: '安全屋可以恢复生命并降低威胁',
            'extraction-ready': '核心区域已清理，返回地图西侧入口启动撤离信标',
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
