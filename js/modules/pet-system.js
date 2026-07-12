/**
 * PetSystem - 宠物系统
 * 管理宠物收集、养成、编队和战斗
 */

import { MovementSystem } from "./movement-system.js?v=movement-20260702a";

let instance = null;
const PET_ASSET_VERSION = 'pet-actions-20260702a';

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
                skill: { name: '火球术', cooldown: 5000, damage: 50 }
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
                skill: { name: '冰霜新星', cooldown: 6000, damage: 40 }
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
                skill: { name: '连锁闪电', cooldown: 7000, damage: 60 }
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
                skill: { name: '地震', cooldown: 8000, damage: 80 }
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
                skill: { name: '龙卷风', cooldown: 10000, damage: 120 }
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
                skill: { name: '圣光祝福', cooldown: 12000, damage: 0, heal: 50 }
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
                skill: { name: '暗影突袭', cooldown: 6000, damage: 150 }
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
                skill: { name: '浴火重生', cooldown: 30000, damage: 200 }
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
            pet.friendship = (pet.friendship || 0) + gain * 5;
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
    
    /**
     * 获取宠物总战力加成
     */
    getTotalPowerBonus() {
        let attack = 0;
        let defense = 0;
        
        this.equippedPets.forEach(pet => {
            const template = this.petTemplates.find(t => t.id === pet.templateId);
            if (template) {
                const levelMultiplier = 1 + (pet.level - 1) * 0.1;
                attack += template.baseStats.attack * levelMultiplier;
                defense += template.baseStats.defense * levelMultiplier;
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
            unlockedPets: this.unlockedPets,
            equippedPets: this.equippedPets.map(p => p.instanceId)
        };
    }
    
    loadSaveData(data) {
        if (!data) return;
        
        this.unlockedPets = data.unlockedPets || [];
        
        // 恢复装备状态
        this.equippedPets = [];
        if (data.equippedPets) {
            data.equippedPets.forEach(id => {
                const pet = this.unlockedPets.find(p => p.instanceId === id);
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
