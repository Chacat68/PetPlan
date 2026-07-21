/**
 * PetSystem - 宠物系统
 * 管理宠物收集、养成、编队和战斗
 */

import { MovementSystem } from "./movement-system.js?v=movement-20260702a";

let instance = null;
const PET_ASSET_VERSION = 'pet-actions-20260702a';
const PET_SAVE_SCHEMA_VERSION = 2;
const MAX_PET_LEVEL = 50;

export class PetSystem {
    constructor() {
        // 宠物模板数据库
        this.petTemplates = [
            {
                id: 1,
                name: '火焰犬',
                emoji: '🔥',
                type: 'fire',
                rarity: 'common',
                image: 'images/pets/fire_dog_table.png',
                idleSheet: 'images/sprites/pets/fire_dog_idle_sheet.png',
                requiredLevel: 1,
                cost: { coins: 500, rubies: 0 },
                baseStats: { attack: 15, hp: 80, defense: 5, attackSpeed: 1.0 },
                combatRole: { id: 'striker', label: '灼烧输出', guard: { hpScale: 0.08, defenseScale: 0.6 }, aura: { attackPercent: 3 } },
                skill: { name: '火球术', cooldown: 5000, damage: 50, effect: 'burn', burnDuration: 3000 },
                explorationTalent: {
                    id: 'heated-trail',
                    label: '灼热嗅觉',
                    searchMode: 'quick',
                    qualityBonus: 1,
                    detail: '快速搜索品质判定 +1'
                },
                baseRole: {
                    buildingType: 'training_ground',
                    label: '训练陪练',
                    detail: '强化实战训练产出的战备'
                }
            },
            {
                id: 2,
                name: '冰霜猫',
                emoji: '❄️',
                type: 'ice',
                rarity: 'common',
                image: 'images/pets/ice_cat_table.png',
                requiredLevel: 1,
                cost: { coins: 500, rubies: 0 },
                baseStats: { attack: 12, hp: 70, defense: 8, attackSpeed: 1.2 },
                combatRole: { id: 'controller', label: '寒霜控场', guard: { hpScale: 0.1, defenseScale: 0.9 }, aura: { damageReduction: 0.02 } },
                skill: { name: '冰霜新星', cooldown: 6000, damage: 40, effect: 'slow', slowPercent: 0.35, slowDuration: 2500 },
                explorationTalent: {
                    id: 'calm-scout',
                    label: '冷静侦察',
                    searchMode: 'pet',
                    threatReduction: 3,
                    detail: '宠物侦察威胁 -3'
                },
                baseRole: {
                    buildingType: 'temple',
                    label: '仪式守护',
                    detail: '强化守护仪式产出的战备'
                }
            },
            {
                id: 3,
                name: '雷电鸟',
                emoji: '⚡',
                type: 'thunder',
                rarity: 'uncommon',
                image: 'images/pets/thunder_bird_table.png',
                requiredLevel: 5,
                cost: { coins: 2000, rubies: 50 },
                baseStats: { attack: 20, hp: 60, defense: 3, attackSpeed: 1.5 },
                combatRole: { id: 'burst', label: '连锁爆发', guard: { hpScale: 0.06, defenseScale: 0.5 }, aura: { critChance: 0.025 } },
                skill: { name: '连锁闪电', cooldown: 7000, damage: 60, effect: 'chain', chainTargets: 3 },
                explorationTalent: {
                    id: 'static-sense',
                    label: '电磁感应',
                    searchMode: 'thorough',
                    supplyChanceBonus: 0.12,
                    detail: '仔细搜刮补给发现率 +12%'
                },
                baseRole: {
                    buildingType: 'crystal_mine',
                    label: '矿脉勘探',
                    detail: '提高主动开采的水晶产量'
                }
            },
            {
                id: 4,
                name: '大地熊',
                emoji: '🌍',
                type: 'earth',
                rarity: 'uncommon',
                image: 'images/pets/earth_bear_table.png',
                requiredLevel: 8,
                cost: { coins: 3000, rubies: 100 },
                baseStats: { attack: 18, hp: 150, defense: 15, attackSpeed: 0.8 },
                combatRole: { id: 'guardian', label: '大地护卫', guard: { hpScale: 0.28, defenseScale: 1.8 }, aura: { damageReduction: 0.06 } },
                skill: { name: '地震', cooldown: 8000, damage: 80, effect: 'stun', stunDuration: 900 },
                explorationTalent: {
                    id: 'steady-step',
                    label: '稳重步伐',
                    searchMode: 'pet',
                    ambushChanceReduction: 0.08,
                    detail: '宠物侦察伏击率 -8%'
                },
                baseRole: {
                    buildingType: 'barracks',
                    label: '驻地教官',
                    detail: '强化战备演练产出的战备'
                }
            },
            {
                id: 5,
                name: '风暴龙',
                emoji: '🌪️',
                type: 'wind',
                rarity: 'rare',
                image: 'images/pets/storm_dragon_table.png',
                requiredLevel: 15,
                cost: { coins: 10000, rubies: 300 },
                baseStats: { attack: 35, hp: 120, defense: 10, attackSpeed: 1.3 },
                combatRole: { id: 'skirmisher', label: '风暴游击', guard: { hpScale: 0.1, defenseScale: 0.7 }, aura: { moveSpeedPercent: 4 } },
                skill: { name: '龙卷风', cooldown: 10000, damage: 120, effect: 'pull', pullRadius: 180 },
                explorationTalent: {
                    id: 'wind-sweep',
                    label: '风场扫掠',
                    searchMode: 'thorough',
                    lootCountBonus: 1,
                    detail: '仔细搜刮额外发现 1 件战利品'
                },
                baseRole: {
                    buildingType: 'library',
                    label: '路线推演',
                    detail: '强化路线研究产出的战备'
                }
            },
            {
                id: 6,
                name: '光明独角兽',
                emoji: '✨',
                type: 'light',
                rarity: 'epic',
                image: 'images/pets/unicorn_table.png',
                requiredLevel: 20,
                cost: { coins: 20000, rubies: 500 },
                baseStats: { attack: 25, hp: 100, defense: 12, attackSpeed: 1.0 },
                combatRole: { id: 'healer', label: '圣光支援', guard: { hpScale: 0.16, defenseScale: 1.1 }, aura: { healingPercent: 12 } },
                skill: { name: '圣光祝福', cooldown: 12000, damage: 0, heal: 50, effect: 'heal', healTarget: 'player' },
                explorationTalent: {
                    id: 'guiding-light',
                    label: '寻路圣光',
                    searchMode: 'pet',
                    supplyChanceBonus: 0.15,
                    detail: '宠物侦察补给发现率 +15%'
                },
                baseRole: {
                    buildingType: 'temple',
                    label: '圣所司祭',
                    detail: '强化守护仪式产出的战备'
                }
            },
            {
                id: 7,
                name: '暗影狼',
                emoji: '🌑',
                type: 'dark',
                rarity: 'epic',
                image: 'images/pets/shadow_wolf_table.png',
                requiredLevel: 25,
                cost: { coins: 25000, rubies: 600 },
                baseStats: { attack: 45, hp: 90, defense: 8, attackSpeed: 1.4 },
                combatRole: { id: 'assassin', label: '暗影处决', guard: { hpScale: 0.07, defenseScale: 0.6 }, aura: { critDamagePercent: 8 } },
                skill: { name: '暗影突袭', cooldown: 6000, damage: 150, effect: 'execute', executeThreshold: 0.2 },
                explorationTalent: {
                    id: 'silent-paw',
                    label: '无声潜行',
                    searchMode: 'quick',
                    ambushChanceReduction: 0.1,
                    detail: '快速搜索伏击率 -10%'
                },
                baseRole: {
                    buildingType: 'training_ground',
                    label: '突袭陪练',
                    detail: '强化实战训练产出的战备'
                }
            },
            {
                id: 8,
                name: '凤凰',
                emoji: '🔥',
                type: 'phoenix',
                rarity: 'legendary',
                image: 'images/pets/phoenix_table.png',
                requiredLevel: 30,
                cost: { coins: 50000, rubies: 1000 },
                baseStats: { attack: 50, hp: 200, defense: 15, attackSpeed: 1.2 },
                combatRole: { id: 'rescuer', label: '涅槃救援', guard: { hpScale: 0.2, defenseScale: 1.2 }, aura: { damageReduction: 0.03 } },
                skill: {
                    name: '浴火重生',
                    cooldown: 30000,
                    damage: 0,
                    effect: 'rescue',
                    rescue: { oncePerExpedition: true, triggerHpRatio: 0, restoreHpRatio: 0.45, invulnerabilityMs: 1800 }
                },
                explorationTalent: {
                    id: 'ashes-memory',
                    label: '余烬记忆',
                    searchMode: 'thorough',
                    qualityBonus: 1,
                    detail: '仔细搜刮品质判定 +1'
                },
                baseRole: {
                    buildingType: 'workshop',
                    label: '炉火监工',
                    detail: '强化制作补给产出的战备'
                }
            }
        ];
        
        // 稀有度配置
        this.rarityConfig = {
            common: { color: '#9e9e9e', name: '普通', stars: 1 },
            uncommon: { color: '#4caf50', name: '优秀', stars: 2 },
            rare: { color: '#2196f3', name: '稀有', stars: 3 },
            epic: { color: '#9c27b0', name: '史诗', stars: 4 },
            legendary: { color: '#ff9800', name: '传说', stars: 5 }
        };
        
        // 已解锁的宠物
        this.unlockedPets = [];
        
        // 装备的宠物 (最多3只)
        this.equippedPets = [];
        
        // 宠物图片缓存
        this.petImages = {};
        this.petAnimationSheets = {};
        this.petBattleStates = new Map();
        this.elapsedTime = 0;
        this.movementSystem = new MovementSystem();
        this.combatStates = ['idle', 'move', 'attack'];
        
        // 系统引用
        this.resourceSystem = null;
        this.playerSystem = null;
        this.combatSystem = null;
        
        // 预加载图片
        this.preloadImages();
        
        console.log('[PetSystem] 初始化完成');
    }
    
    /**
     * 预加载宠物图片
     */
    preloadImages() {
        this.petTemplates.forEach(pet => {
            const img = new Image();
            img.onload = () => {
                this.petImages[pet.id] = img;
            };
            img.onerror = () => {
                console.warn(`[PetSystem] 图片加载失败: ${pet.image}`);
            };
            img.src = `${pet.image}?v=${PET_ASSET_VERSION}`;
            if (img.complete && img.naturalWidth > 0) {
                this.petImages[pet.id] = img;
            }

            this.petAnimationSheets[pet.id] = {};
            this.combatStates.forEach(state => {
                const spritePath = this.getPetSpritePath(pet, state);
                const sheet = new Image();
                sheet.onload = () => {
                    this.petAnimationSheets[pet.id][state] = sheet;
                };
                sheet.onerror = () => {
                    console.warn(`[PetSystem] 宠物 ${state} 序列帧加载失败: ${spritePath}`);
                };
                sheet.src = `${spritePath}?v=${PET_ASSET_VERSION}`;
                if (sheet.complete && sheet.naturalWidth > 0) {
                    this.petAnimationSheets[pet.id][state] = sheet;
                }
            });
        });
    }

    getPetSpritePath(pet, state) {
        return `images/sprites/battle/pets/${this.getPetSpriteKey(pet)}_${state}_sheet.png`;
    }

    getPetSpriteKey(pet) {
        const match = pet.image.match(/\/([^/]+)_table\.png$/);
        return match ? match[1] : `pet_${pet.id}`;
    }
    
    /**
     * 设置系统引用
     */
    setResourceSystem(resourceSystem) {
        this.resourceSystem = resourceSystem;
    }
    
    setPlayerSystem(playerSystem) {
        this.playerSystem = playerSystem;
    }

    setCombatSystem(combatSystem) {
        this.combatSystem = combatSystem;
    }
    
    /**
     * 解锁宠物
     */
    unlockPet(petId) {
        const template = this.petTemplates.find(p => p.id === petId);
        if (!template) {
            return { success: false, message: '宠物不存在' };
        }
        
        // 检查是否已解锁
        if (this.unlockedPets.find(p => p.templateId === petId)) {
            return { success: false, message: '已经拥有该宠物' };
        }
        
        // 检查等级
        const playerLevel = this.playerSystem?.player.level || 1;
        if (playerLevel < template.requiredLevel) {
            return { success: false, message: `需要等级 ${template.requiredLevel}` };
        }
        
        // 检查并扣除资源
        if (!this.resourceSystem) {
            return { success: false, message: '资源系统未初始化' };
        }
        
        if (!this.resourceSystem.hasEnoughCoins(template.cost.coins)) {
            return { success: false, message: '金币不足' };
        }
        
        if (template.cost.rubies > 0 && !this.resourceSystem.hasEnoughRubies(template.cost.rubies)) {
            return { success: false, message: '红宝石不足' };
        }
        
        // 扣除资源
        this.resourceSystem.spendCoins(template.cost.coins);
        if (template.cost.rubies > 0) {
            this.resourceSystem.spendRubies(template.cost.rubies);
        }
        
        // 创建宠物实例
        const petInstance = {
            instanceId: Date.now(),
            templateId: petId,
            level: 1,
            exp: 0,
            friendship: 0,
            equipped: false
        };
        
        this.unlockedPets.push(petInstance);
        
        return { success: true, message: `解锁了 ${template.name}！`, pet: petInstance };
    }
    
    /**
     * 装备宠物
     */
    equipPet(instanceId) {
        if (this.equippedPets.length >= 3) {
            return { success: false, message: '最多只能装备3只宠物' };
        }
        
        const pet = this.unlockedPets.find(p => p.instanceId === instanceId);
        if (!pet) {
            return { success: false, message: '宠物不存在' };
        }
        
        if (pet.equipped) {
            return { success: false, message: '宠物已装备' };
        }
        
        pet.equipped = true;
        this.equippedPets.push(pet);
        
        const template = this.petTemplates.find(t => t.id === pet.templateId);
        return { success: true, message: `${template.name} 已装备` };
    }
    
    /**
     * 卸下宠物
     */
    unequipPet(instanceId) {
        const index = this.equippedPets.findIndex(p => p.instanceId === instanceId);
        if (index === -1) {
            return { success: false, message: '宠物未装备' };
        }
        
        const pet = this.equippedPets[index];
        pet.equipped = false;
        this.equippedPets.splice(index, 1);
        
        const template = this.petTemplates.find(t => t.id === pet.templateId);
        return { success: true, message: `${template.name} 已卸下` };
    }

    trainEquippedPets(levelGain = 1) {
        if (this.equippedPets.length === 0) {
            return { success: false, message: '没有装备宠物' };
        }

        const gain = Math.max(1, Math.floor(levelGain));
        this.equippedPets.forEach(pet => {
            pet.level += gain;
        });

        return {
            success: true,
            message: `装备宠物 Lv +${gain}`,
            count: this.equippedPets.length
        };
    }

    getEquippedPetLevelTotal() {
        return this.equippedPets.reduce((total, pet) => total + (pet.level || 1), 0);
    }

    getFriendshipTier(friendship = 0) {
        const value = Math.max(0, Math.min(100, Number(friendship) || 0));
        if (value >= 80) {
            return { level: 3, label: '挚友', min: 80, nextAt: 100, value };
        }
        if (value >= 40) {
            return { level: 2, label: '默契', min: 40, nextAt: 80, value };
        }
        return { level: 1, label: '熟悉', min: 0, nextAt: 40, value };
    }

    getExplorationSearchBonuses(searchMode) {
        const bonuses = {
            qualityBonus: 0,
            lootCountBonus: 0,
            threatReduction: 0,
            supplyChanceBonus: 0,
            ambushChanceReduction: 0,
            contributors: []
        };

        this.equippedPets.forEach(pet => {
            const template = this.getTemplate(pet.templateId);
            const talent = template?.explorationTalent;
            if (!talent || talent.searchMode !== searchMode) return;

            bonuses.qualityBonus += Number(talent.qualityBonus) || 0;
            bonuses.lootCountBonus += Number(talent.lootCountBonus) || 0;
            bonuses.threatReduction += Number(talent.threatReduction) || 0;
            bonuses.supplyChanceBonus += Number(talent.supplyChanceBonus) || 0;
            bonuses.ambushChanceReduction += Number(talent.ambushChanceReduction) || 0;
            bonuses.contributors.push({
                petName: template.name,
                label: talent.label,
                detail: talent.detail
            });
        });

        return {
            ...bonuses,
            qualityBonus: Math.min(2, bonuses.qualityBonus),
            lootCountBonus: Math.min(1, bonuses.lootCountBonus),
            threatReduction: Math.min(6, bonuses.threatReduction),
            supplyChanceBonus: Math.min(0.25, bonuses.supplyChanceBonus),
            ambushChanceReduction: Math.min(0.2, bonuses.ambushChanceReduction)
        };
    }

    getBaseSupport(buildingType) {
        const candidates = this.equippedPets
            .map(pet => ({ pet, template: this.getTemplate(pet.templateId) }))
            .filter(({ template }) => template?.baseRole?.buildingType === buildingType)
            .sort((left, right) => (right.pet.friendship || 0) - (left.pet.friendship || 0));
        const selected = candidates[0];
        if (!selected) return null;

        const { pet, template } = selected;
        const friendship = Math.max(0, Math.min(100, Number(pet.friendship) || 0));
        const role = template.baseRole;
        const tier = this.getFriendshipTier(friendship);
        return {
            buildingType,
            petName: template.name,
            roleLabel: role.label,
            friendship,
            tier: tier.level,
            tierLabel: tier.label,
            nextTierAt: tier.nextAt
        };
    }

    getPetExperienceRequirement(level = 1) {
        const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
        return 50 + safeLevel * 25;
    }

    /**
     * Authoritative expedition progression entry point. Combat should call this
     * once when a run settles. `applyExpeditionBond` remains as a compatibility
     * alias for saves/controllers created before pet experience was introduced.
     */
    awardExpeditionProgress(settlement = {}) {
        const depth = Math.max(0, Math.floor(Number(settlement.depth ?? settlement.bestDepth) || 0));
        const kills = Math.max(0, Math.floor(Number(settlement.kills ?? settlement.totalKills) || 0));
        const bossKills = Math.max(0, Math.floor(Number(settlement.bossKills) || 0));
        const extracted = Boolean(settlement.extracted);
        const explicitPetExp = Number(settlement.petExp);
        const calculatedExp = depth * 12 + kills * 2 + bossKills * 24 + (extracted ? 24 : 8);
        const plannedExperience = Math.max(
            1,
            Math.floor(Number.isFinite(explicitPetExp) ? explicitPetExp : calculatedExp * (extracted ? 1 : 0.45))
        );
        const plannedFriendship = extracted
            ? Math.max(2, Math.min(12, depth * 2 + (bossKills > 0 ? 1 : 0)))
            : Math.max(1, Math.min(4, Math.floor(depth / 2) || 1));
        const participantIds = Array.isArray(settlement.participantIds)
            ? new Set(settlement.participantIds.map(String))
            : null;
        const participants = this.equippedPets.filter(pet => (
            !participantIds || participantIds.has(String(pet.instanceId))
        ));

        const pets = participants.map(pet => {
            pet.level = Math.max(1, Math.min(MAX_PET_LEVEL, Math.floor(Number(pet.level) || 1)));
            pet.exp = Math.max(0, Math.floor(Number(pet.exp) || 0));
            const levelBefore = pet.level;
            const expBefore = pet.exp;
            const friendshipBefore = Math.max(0, Math.min(100, Number(pet.friendship) || 0));

            if (pet.level < MAX_PET_LEVEL) {
                pet.exp += plannedExperience;
                while (pet.level < MAX_PET_LEVEL) {
                    const requirement = this.getPetExperienceRequirement(pet.level);
                    if (pet.exp < requirement) break;
                    pet.exp -= requirement;
                    pet.level += 1;
                }
                if (pet.level >= MAX_PET_LEVEL) pet.exp = 0;
            }
            pet.friendship = Math.min(100, friendshipBefore + plannedFriendship);
            const template = this.getTemplate(pet.templateId);
            return {
                instanceId: pet.instanceId,
                templateId: pet.templateId,
                petName: template?.name || '宠物',
                combatRole: template?.combatRole?.id || 'support',
                experienceGain: pet.level >= MAX_PET_LEVEL && levelBefore >= MAX_PET_LEVEL
                    ? 0
                    : plannedExperience,
                expBefore,
                exp: pet.exp,
                levelBefore,
                level: pet.level,
                levelsGained: pet.level - levelBefore,
                gain: pet.friendship - friendshipBefore,
                friendshipGain: pet.friendship - friendshipBefore,
                friendship: pet.friendship
            };
        });

        return {
            plannedGain: plannedFriendship,
            plannedFriendship,
            plannedExperience,
            totalGain: pets.reduce((total, pet) => total + pet.friendshipGain, 0),
            totalExperience: pets.reduce((total, pet) => total + pet.experienceGain, 0),
            levelsGained: pets.reduce((total, pet) => total + pet.levelsGained, 0),
            count: pets.length,
            gainedCount: pets.filter(pet => pet.friendshipGain > 0 || pet.experienceGain > 0).length,
            cappedCount: pets.filter(pet => pet.friendship >= 100).length,
            pets
        };
    }

    applyExpeditionBond(settlement) {
        return this.awardExpeditionProgress(settlement);
    }

    getPetCombatStats(petOrId) {
        const pet = typeof petOrId === 'object'
            ? petOrId
            : this.unlockedPets.find(candidate => String(candidate.instanceId) === String(petOrId));
        if (!pet) return null;
        const template = this.getTemplate(pet.templateId);
        if (!template) return null;
        const level = Math.max(1, Math.floor(Number(pet.level) || 1));
        const friendship = Math.max(0, Math.min(100, Number(pet.friendship) || 0));
        const growth = 1 + (level - 1) * 0.1;
        const bond = 1 + friendship * 0.002;
        return {
            attack: Math.floor(template.baseStats.attack * growth * bond),
            hp: Math.floor(template.baseStats.hp * growth * bond),
            defense: Math.floor(template.baseStats.defense * growth * bond),
            attackSpeed: template.baseStats.attackSpeed,
            level,
            friendship
        };
    }

    /**
     * Stable data contract consumed by CombatSystem at expedition start.
     * Pet hp/defense become guard capacity and mitigation instead of display-only
     * values; special skills expose semantic effects rather than name matching.
     */
    getExpeditionSquadSnapshot() {
        const auras = {};
        let guardCapacity = 0;
        let damageReduction = 0;
        let rescue = null;
        const members = this.equippedPets.map(pet => {
            const template = this.getTemplate(pet.templateId);
            const stats = this.getPetCombatStats(pet);
            if (!template || !stats) return null;
            const role = template?.combatRole || { id: 'support', label: '协同支援', guard: {} };
            const guard = role.guard || {};
            const memberGuard = Math.max(0, Math.floor(
                stats.hp * (Number(guard.hpScale) || 0) +
                stats.defense * (Number(guard.defenseScale) || 0)
            ));
            guardCapacity += memberGuard;
            damageReduction += Math.min(0.035, stats.defense / 1200);
            Object.entries(role.aura || {}).forEach(([key, value]) => {
                auras[key] = (auras[key] || 0) + (Number(value) || 0);
            });
            if (!rescue && template.skill?.effect === 'rescue' && template.skill.rescue) {
                rescue = {
                    petInstanceId: pet.instanceId,
                    petName: template.name,
                    skillName: template.skill.name,
                    ...template.skill.rescue
                };
            }
            return {
                instanceId: pet.instanceId,
                templateId: pet.templateId,
                name: template.name,
                role: { ...role },
                stats,
                guardCapacity: memberGuard,
                skill: { ...template.skill }
            };
        }).filter(Boolean);
        damageReduction += Number(auras.damageReduction) || 0;
        return {
            members,
            count: members.length,
            guardCapacity,
            guardHp: guardCapacity,
            damageReduction: Math.min(0.28, damageReduction),
            auras,
            rescue
        };
    }

    getCombatSupportSnapshot() {
        return this.getExpeditionSquadSnapshot();
    }

    tryExpeditionRescue({ maxHp = 1, rescueUsed = false } = {}) {
        const rescue = this.getExpeditionSquadSnapshot().rescue;
        if (!rescue || rescueUsed) return { rescued: false, hp: 0, rescue };
        return {
            rescued: true,
            hp: Math.max(1, Math.floor(Math.max(1, Number(maxHp) || 1) * rescue.restoreHpRatio)),
            invulnerabilityMs: Math.max(0, Math.floor(Number(rescue.invulnerabilityMs) || 0)),
            rescue
        };
    }
    
    /**
     * 获取宠物总战力加成
     */
    getTotalPowerBonus() {
        let attack = 0;
        let defense = 0;
        
        this.equippedPets.forEach(pet => {
            const template = this.petTemplates.find(t => t.id === pet.templateId);
            if (template) {
                const stats = this.getPetCombatStats(pet);
                attack += stats.attack;
                defense += stats.defense;
            }
        });
        
        return { attack: Math.floor(attack), defense: Math.floor(defense) };
    }
    
    /**
     * 获取模板
     */
    getTemplate(petId) {
        return this.petTemplates.find(t => t.id === petId);
    }
    
    /**
     * 获取稀有度配置
     */
    getRarityConfig(rarity) {
        return this.rarityConfig[rarity] || this.rarityConfig.common;
    }

    update(deltaTime, playerX, playerY) {
        this.elapsedTime += deltaTime;

        if (!this.combatSystem || this.equippedPets.length === 0) {
            return;
        }

        // 竖版塔防由 CombatSystem 统一处理锁敌、射击和技能效果。
        // PetSystem 只保留养成数据与宠物塔动画，避免旧冲刺 AI 重复造成伤害。
        if (this.combatSystem.mode === 'towerDefense') {
            return;
        }

        const activeIds = new Set(this.equippedPets.map(pet => pet.instanceId));
        for (const id of this.petBattleStates.keys()) {
            if (!activeIds.has(id)) {
                this.petBattleStates.delete(id);
            }
        }

        this.equippedPets.forEach((pet, index) => {
            const template = this.petTemplates.find(t => t.id === pet.templateId);
            if (!template) return;

            const state = this.getPetBattleState(pet.instanceId);
            const idlePosition = this.getIdlePosition(playerX, playerY, index);
            this.ensurePetPosition(state, idlePosition);

            if (state.phase === 'idle') {
                this.updatePetCruise(state, template, idlePosition, deltaTime);
                return;
            }

            if (state.phase === 'move' && (!state.target || !this.combatSystem.monsters.includes(state.target))) {
                this.startPetCruise(state, template);
            }

            if (state.phase === 'move') {
                this.updatePetCharge(state, template, pet, deltaTime);
            } else if (state.phase === 'attack') {
                this.updatePetAttack(state, template, deltaTime);
            }
        });
    }

    getPetBattleState(instanceId) {
        if (!this.petBattleStates.has(instanceId)) {
            this.petBattleStates.set(instanceId, {
                phase: 'idle',
                combatState: 'idle',
                cooldown: 350,
                phaseTime: 0,
                attackTimer: 0,
                attackDuration: 260,
                animationOffset: Math.random() * 400,
                x: 0,
                y: 0,
                startX: 0,
                startY: 0,
                returnX: 0,
                returnY: 0,
                target: null,
                hasHit: false
            });
        }

        return this.petBattleStates.get(instanceId);
    }

    resetBattleStates() {
        this.petBattleStates.clear();
    }

    getIdlePosition(playerX, playerY, index) {
        const angle = (index * 120 + this.elapsedTime * 0.02) * Math.PI / 180;
        const radius = 58;
        return {
            x: playerX + Math.cos(angle) * radius,
            y: playerY + Math.sin(angle) * radius * 0.5
        };
    }

    ensurePetPosition(state, fallbackPosition) {
        if (state.x === 0 && state.y === 0) {
            state.x = fallbackPosition.x;
            state.y = fallbackPosition.y;
        }
    }

    updatePetCruise(state, template, idlePosition, deltaTime) {
        state.cooldown -= deltaTime;

        if (state.cooldown <= 0) {
            const target = typeof this.combatSystem.acquireTarget === 'function'
                ? this.combatSystem.acquireTarget(
                    { x: state.x, y: state.y },
                    {
                        strategy: 'nearest',
                        maxRange: this.combatSystem.config?.petAcquireRange || 430
                    }
                )
                : this.combatSystem.getNearestMonster(state.x, state.y);
            if (target) {
                this.startPetCharge(state, target);
                return;
            }
        }

        const movement = this.movePetToward(
            state,
            idlePosition.x,
            idlePosition.y,
            this.getPetCruiseSpeed(template),
            deltaTime
        );
        state.combatState = movement.moved ? 'move' : 'idle';
    }

    startPetCharge(state, target) {
        state.phase = 'move';
        state.combatState = 'move';
        state.phaseTime = 0;
        state.startX = state.x;
        state.startY = state.y;
        state.target = target;
        state.hasHit = false;
    }

    updatePetCharge(state, template, pet, deltaTime) {
        state.phaseTime += deltaTime;

        const targetX = state.target.x + state.target.width / 2;
        const targetY = state.target.y + state.target.height / 2;
        const hitDistance = Math.max(22, Math.min(34, state.target.width * 0.55));
        const movement = this.movePetToward(
            state,
            targetX,
            targetY,
            this.getPetChargeSpeed(template),
            deltaTime
        );
        state.combatState = 'move';

        if (!state.hasHit && movement.distance <= hitDistance) {
            state.hasHit = true;
            this.resolvePetHit(state, template, pet);
            this.startPetAttack(state, template);
        }
    }

    startPetAttack(state, template) {
        state.phase = 'attack';
        state.combatState = 'attack';
        state.phaseTime = 0;
        state.attackDuration = Math.max(210, 360 / template.baseStats.attackSpeed);
        state.attackTimer = state.attackDuration;
    }

    updatePetAttack(state, template, deltaTime) {
        state.phaseTime += deltaTime;
        state.attackTimer = Math.max(0, state.attackTimer - deltaTime);
        state.combatState = 'attack';

        if (state.attackTimer <= 0) {
            this.startPetCruise(state, template);
        }
    }

    resolvePetHit(state, template, pet) {
        const levelMultiplier = 1 + (pet.level - 1) * 0.1;
        const damage = Math.max(1, Math.floor(template.baseStats.attack * levelMultiplier));
        const isCrit = Math.random() < 0.08;
        const finalDamage = isCrit ? Math.floor(damage * 1.6) : damage;

        this.combatSystem.applyPetDamage(state.target, finalDamage, isCrit);
    }

    startPetCruise(state, template) {
        state.phase = 'idle';
        state.combatState = 'idle';
        state.phaseTime = 0;
        state.cooldown = Math.max(180, 900 / template.baseStats.attackSpeed);
        state.target = null;
        state.hasHit = false;
    }

    getPetChargeSpeed(template) {
        return 260 + template.baseStats.attackSpeed * 180;
    }

    getPetCruiseSpeed(template) {
        return 180 + template.baseStats.attackSpeed * 80;
    }

    movePetToward(state, targetX, targetY, speed, deltaTime) {
        return this.movementSystem.moveToward(state, targetX, targetY, speed, deltaTime, {
            maxDeltaTime: 50
        });
    }

    getPetStateSheet(templateId, state) {
        return this.petAnimationSheets[templateId]?.[state] || this.petAnimationSheets[templateId]?.idle;
    }

    getPetAnimationState(state) {
        if (state.combatState === 'attack' || state.phase === 'attack') return 'attack';
        if (state.combatState === 'move' || state.phase === 'move') return 'move';
        return 'idle';
    }

    getPetFrameDuration(state) {
        if (state === 'attack') return 80;
        if (state === 'move') return 110;
        return 170;
    }

    renderTowerDefense(ctx) {
        const towers = this.combatSystem?.getTowerRenderData?.() || [];
        const baseSize = Math.max(48, this.combatSystem?.getTowerSlotRadius?.() * 1.72 || 58);

        towers.forEach((tower, index) => {
            const template = this.petTemplates.find(item => item.id === tower.templateId);
            if (!template) return;

            const animationState = tower.attackAnimationTimer > 0 ? 'attack' : 'idle';
            const sheet = this.getPetStateSheet(template.id, animationState);
            const image = this.petImages[template.id];
            const size = animationState === 'attack' ? baseSize * 1.12 : baseSize;

            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (tower.selected || animationState === 'attack') {
                ctx.shadowColor = tower.role?.color || '#ffd167';
                ctx.shadowBlur = tower.selected ? 16 : 10;
            }

            if (sheet && sheet.complete && sheet.naturalWidth > 0) {
                const frameSize = 512;
                const frameDuration = this.getPetFrameDuration(animationState);
                const frameIndex = (Math.floor((this.elapsedTime + index * 83) / frameDuration) + index) % 4;
                ctx.drawImage(
                    sheet,
                    frameIndex * frameSize,
                    0,
                    frameSize,
                    frameSize,
                    tower.x - size / 2,
                    tower.y - size / 2,
                    size,
                    size
                );
            } else if (image && image.complete && image.naturalWidth > 0) {
                ctx.drawImage(image, tower.x - size / 2, tower.y - size / 2, size, size);
            } else {
                ctx.fillStyle = tower.role?.color || '#ffd167';
                ctx.beginPath();
                ctx.arc(tower.x, tower.y, size * 0.28, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    }
    
    /**
     * 渲染装备的宠物
     */
    render(ctx, playerX, playerY) {
        if (this.combatSystem?.mode === 'towerDefense') {
            this.renderTowerDefense(ctx);
            return;
        }

        this.equippedPets.forEach((pet, index) => {
            const template = this.petTemplates.find(t => t.id === pet.templateId);
            if (!template) return;
            
            const img = this.petImages[pet.templateId];
            
            const state = this.getPetBattleState(pet.instanceId);
            const idlePosition = this.getIdlePosition(playerX, playerY, index);
            this.ensurePetPosition(state, idlePosition);
            const petX = state.x;
            const petY = state.y;
            const animationState = this.getPetAnimationState(state);
            const activeSheet = this.getPetStateSheet(pet.templateId, animationState);
            
            const size = animationState === 'attack' ? 72 : animationState === 'move' ? 60 : 52;
            if (activeSheet && activeSheet.complete && activeSheet.naturalWidth > 0) {
                const frameSize = 512;
                const frameIndex = (Math.floor((this.elapsedTime + state.animationOffset) / this.getPetFrameDuration(animationState)) + index) % 4;

                ctx.save();
                ctx.imageSmoothingEnabled = false;
                if (animationState === 'attack') {
                    ctx.shadowColor = '#ffd167';
                    ctx.shadowBlur = 14;
                } else if (animationState === 'move') {
                    ctx.shadowColor = 'rgba(255, 209, 103, 0.55)';
                    ctx.shadowBlur = 8;
                }
                ctx.drawImage(
                    activeSheet,
                    frameIndex * frameSize,
                    0,
                    frameSize,
                    frameSize,
                    petX - size / 2,
                    petY - size / 2,
                    size,
                    size
                );
                ctx.restore();
            } else if (img && img.complete && img.naturalWidth > 0) {
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                if (animationState === 'attack') {
                    ctx.shadowColor = '#ffd167';
                    ctx.shadowBlur = 14;
                }
                ctx.drawImage(img, petX - size / 2, petY - size / 2, size, size);
                ctx.restore();
            }
            // 图片未加载完成时不显示任何内容（不使用 emoji）
        });
    }
    
    /**
     * 存档接口
     */
    getSaveData() {
        return {
            schemaVersion: PET_SAVE_SCHEMA_VERSION,
            unlockedPets: this.unlockedPets,
            equippedPets: this.equippedPets.map(p => p.instanceId)
        };
    }
    
    loadSaveData(data) {
        if (!data) return;
        
        this.unlockedPets = Array.isArray(data.unlockedPets)
            ? data.unlockedPets.map(pet => ({
                ...pet,
                level: Math.min(MAX_PET_LEVEL, Math.max(1, Math.floor(Number(pet.level) || 1))),
                exp: Math.max(0, Math.floor(Number(pet.exp ?? pet.experience) || 0)),
                friendship: Math.max(0, Math.min(100, Number(pet.friendship) || 0)),
                equipped: false
            }))
            : [];
        
        // 恢复装备状态
        this.equippedPets = [];
        if (data.equippedPets) {
            data.equippedPets.forEach(id => {
                const pet = this.unlockedPets.find(p => String(p.instanceId) === String(id));
                if (pet) {
                    pet.equipped = true;
                    this.equippedPets.push(pet);
                }
            });
        }
    }
}

/**
 * 获取单例实例
 */
export function getPetSystemInstance() {
    if (!instance) {
        instance = new PetSystem();
    }
    return instance;
}
