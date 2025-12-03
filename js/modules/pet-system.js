/**
 * 宠物系统模块
 * 负责宠物收集、升级、编队、战斗、养成等功能
 */

class PetSystem {
    constructor(gameCore, resourceSystem) {
        this.gameCore = gameCore;
        this.resourceSystem = resourceSystem;
        this.combatSystem = null; // 战斗系统引用，稍后设置
        
        // 宠物槽位配置（前排3个，后排3个）
        this.slots = {
            front: [null, null, null],  // 前排槽位
            back: [null, null, null]    // 后排槽位
        };
        
        // 玩家拥有的宠物（背包）
        this.ownedPets = [];
        
        // 宠物图鉴数据库
        this.petDatabase = this.initPetDatabase();
        
        // 战斗相关
        this.petAttackTimers = {}; // 每个宠物的攻击计时器
        this.petSkillTimers = {};  // 每个宠物的技能CD计时器
        this.petBullets = [];      // 宠物发射的子弹
        this.petSkillEffects = []; // 宠物技能特效
        
        console.log('宠物系统初始化完成');
    }
    
    /**
     * 设置战斗系统引用
     */
    setCombatSystem(combatSystem) {
        this.combatSystem = combatSystem;
        console.log('宠物系统已连接到战斗系统');
    }
    
    /**
     * 初始化宠物图鉴数据库
     */
    initPetDatabase() {
        return {
            // 普通宠物
            1: {
                id: 1,
                name: '火焰犬',
                rarity: 'common', // common, uncommon, rare, epic, legendary
                type: 'fire',
                baseAttack: 15,
                baseHp: 80,
                baseDefense: 5,
                attackSpeed: 1.0,
                skill: {
                    id: 'fireball',
                    name: '火球术',
                    cooldown: 5000, // 5秒CD
                    damage: 50,
                    description: '发射火球造成范围伤害'
                },
                image: '🔥🐕',
                description: '忠诚的火系伙伴，能发射火球攻击敌人',
                unlockLevel: 1,
                unlockCost: { coins: 500, gems: 0 }
            },
            2: {
                id: 2,
                name: '冰霜猫',
                rarity: 'common',
                type: 'ice',
                baseAttack: 12,
                baseHp: 60,
                baseDefense: 3,
                attackSpeed: 1.2,
                skill: {
                    id: 'frost_nova',
                    name: '冰霜新星',
                    cooldown: 6000,
                    damage: 40,
                    slow: 0.5, // 减速50%
                    description: '冰冻周围敌人并减速'
                },
                image: '❄️🐱',
                description: '灵活的冰系猫咪，攻击速度快',
                unlockLevel: 1,
                unlockCost: { coins: 500, gems: 0 }
            },
            3: {
                id: 3,
                name: '雷电鸟',
                rarity: 'uncommon',
                type: 'thunder',
                baseAttack: 20,
                baseHp: 50,
                baseDefense: 2,
                attackSpeed: 1.5,
                skill: {
                    id: 'chain_lightning',
                    name: '连锁闪电',
                    cooldown: 7000,
                    damage: 60,
                    targets: 3, // 连锁3个目标
                    description: '释放连锁闪电攻击多个敌人'
                },
                image: '⚡🦅',
                description: '迅捷的雷系飞鸟，可以连续攻击',
                unlockLevel: 5,
                unlockCost: { coins: 2000, gems: 50 }
            },
            4: {
                id: 4,
                name: '大地熊',
                rarity: 'uncommon',
                type: 'earth',
                baseAttack: 10,
                baseHp: 150,
                baseDefense: 15,
                attackSpeed: 0.8,
                skill: {
                    id: 'earthquake',
                    name: '地震',
                    cooldown: 8000,
                    damage: 80,
                    stun: 1000, // 眩晕1秒
                    description: '制造地震震晕敌人'
                },
                image: '🌍🐻',
                description: '强壮的大地守护者，防御力极高',
                unlockLevel: 8,
                unlockCost: { coins: 3000, gems: 100 }
            },
            5: {
                id: 5,
                name: '风暴龙',
                rarity: 'rare',
                type: 'wind',
                baseAttack: 35,
                baseHp: 120,
                baseDefense: 10,
                attackSpeed: 1.3,
                skill: {
                    id: 'tornado',
                    name: '龙卷风',
                    cooldown: 10000,
                    damage: 120,
                    duration: 3000, // 持续3秒
                    description: '召唤龙卷风持续伤害敌人'
                },
                image: '🌪️🐉',
                description: '传说中的风暴之子，攻击力强大',
                unlockLevel: 15,
                unlockCost: { coins: 10000, gems: 300 }
            },
            6: {
                id: 6,
                name: '光明独角兽',
                rarity: 'epic',
                type: 'light',
                baseAttack: 30,
                baseHp: 100,
                baseDefense: 12,
                attackSpeed: 1.1,
                skill: {
                    id: 'holy_light',
                    name: '圣光祝福',
                    cooldown: 12000,
                    heal: 50, // 治疗量
                    buff: 1.2, // 增伤20%
                    duration: 5000,
                    description: '治疗友军并提升攻击力'
                },
                image: '✨🦄',
                description: '神圣的光明使者，能治疗和增强队友',
                unlockLevel: 20,
                unlockCost: { coins: 20000, gems: 500 }
            },
            7: {
                id: 7,
                name: '暗影狼',
                rarity: 'epic',
                type: 'dark',
                baseAttack: 40,
                baseHp: 90,
                baseDefense: 8,
                attackSpeed: 1.6,
                skill: {
                    id: 'shadow_strike',
                    name: '暗影突袭',
                    cooldown: 6000,
                    damage: 150,
                    crit: 0.5, // 50%暴击率
                    description: '从暗影中突袭，高暴击'
                },
                image: '🌑🐺',
                description: '潜行的暗影杀手，暴击伤害极高',
                unlockLevel: 25,
                unlockCost: { coins: 25000, gems: 600 }
            },
            8: {
                id: 8,
                name: '凤凰',
                rarity: 'legendary',
                type: 'phoenix',
                baseAttack: 50,
                baseHp: 150,
                baseDefense: 20,
                attackSpeed: 1.4,
                skill: {
                    id: 'rebirth',
                    name: '浴火重生',
                    cooldown: 30000,
                    revive: true, // 复活能力
                    damage: 200,
                    description: '死亡时复活并造成爆炸伤害'
                },
                image: '🔥🦅',
                description: '不死的传说，拥有重生之力',
                unlockLevel: 30,
                unlockCost: { coins: 50000, gems: 1000 }
            }
        };
    }
    
    /**
     * 获取宠物稀有度配置
     */
    getRarityConfig(rarity) {
        const configs = {
            common: { color: '#9e9e9e', name: '普通', star: 1 },
            uncommon: { color: '#4caf50', name: '优秀', star: 2 },
            rare: { color: '#2196f3', name: '稀有', star: 3 },
            epic: { color: '#9c27b0', name: '史诗', star: 4 },
            legendary: { color: '#ff9800', name: '传说', star: 5 }
        };
        return configs[rarity] || configs.common;
    }
    
    /**
     * 创建宠物实例
     */
    createPet(petId, level = 1) {
        const template = this.petDatabase[petId];
        if (!template) {
            console.error('宠物模板不存在:', petId);
            return null;
        }
        
        const pet = {
            instanceId: Date.now() + Math.random(), // 唯一实例ID
            templateId: petId,
            ...JSON.parse(JSON.stringify(template)), // 深拷贝模板数据
            
            // 等级相关
            level: level,
            exp: 0,
            expToNext: 100,
            
            // 当前属性（会随等级变化）
            attack: template.baseAttack + (level - 1) * 5,
            hp: template.baseHp + (level - 1) * 20,
            maxHp: template.baseHp + (level - 1) * 20,
            defense: template.baseDefense + (level - 1) * 2,
            
            // 养成属性
            friendship: 0,      // 好感度 0-100
            hunger: 100,        // 饥饿度 0-100
            energy: 100,        // 精力 0-100
            lastFeedTime: Date.now(),
            lastTrainTime: Date.now(),
            
            // 战斗状态
            position: null,     // { type: 'front'|'back', index: 0-2 }
            isInBattle: false,
            currentHp: template.baseHp + (level - 1) * 20,
            buffs: [],          // 增益效果
            debuffs: []         // 减益效果
        };
        
        return pet;
    }
    
    /**
     * 解锁宠物（添加到背包）
     */
    unlockPet(petId) {
        const template = this.petDatabase[petId];
        if (!template) {
            return { success: false, message: '宠物不存在' };
        }
        
        // 检查是否已拥有
        if (this.ownedPets.find(p => p.templateId === petId)) {
            return { success: false, message: '已拥有该宠物' };
        }
        
        // 检查解锁条件
        const playerLevel = this.getPlayerLevel();
        if (playerLevel < template.unlockLevel) {
            return { success: false, message: `需要${template.unlockLevel}级解锁` };
        }
        
        // 检查资源
        const cost = template.unlockCost;
        const hasCoins = this.resourceSystem.hasEnoughCoins(cost.coins || 0);
        const hasRubies = this.resourceSystem.hasEnoughRubies(cost.gems || 0);
        if (!hasCoins || !hasRubies) {
            return { success: false, message: '资源不足' };
        }
        
        // 扣除资源
        if (cost.coins) this.resourceSystem.spendCoins(cost.coins);
        if (cost.gems) this.resourceSystem.spendRubies(cost.gems);
        
        // 创建宠物并添加到背包
        const pet = this.createPet(petId, 1);
        this.ownedPets.push(pet);
        
        console.log('解锁宠物:', template.name);
        return { success: true, message: `成功解锁 ${template.name}!`, pet: pet };
    }
    
    /**
     * 装备宠物到槽位
     */
    equipPet(petInstanceId, position, slotIndex) {
        const pet = this.ownedPets.find(p => p.instanceId === petInstanceId);
        if (!pet) {
            return { success: false, message: '宠物不存在' };
        }
        
        // 验证槽位
        if ((position !== 'front' && position !== 'back') || slotIndex < 0 || slotIndex > 2) {
            return { success: false, message: '无效的槽位' };
        }
        
        // 如果宠物已装备，先卸下
        if (pet.position) {
            this.slots[pet.position.type][pet.position.index] = null;
        }
        
        // 如果目标槽位有宠物，先卸下
        const existingPet = this.slots[position][slotIndex];
        if (existingPet) {
            existingPet.position = null;
            existingPet.isInBattle = false;
        }
        
        // 装备宠物
        pet.position = { type: position, index: slotIndex };
        pet.isInBattle = true;
        pet.currentHp = pet.maxHp; // 恢复满血
        this.slots[position][slotIndex] = pet;
        
        // 初始化战斗计时器
        this.petAttackTimers[pet.instanceId] = 0;
        this.petSkillTimers[pet.instanceId] = 0;
        
        console.log(`${pet.name} 已装备到 ${position} 槽位 ${slotIndex}`);
        return { success: true, message: `${pet.name} 已上阵` };
    }
    
    /**
     * 卸下宠物
     */
    unequipPet(petInstanceId) {
        const pet = this.ownedPets.find(p => p.instanceId === petInstanceId);
        if (!pet || !pet.position) {
            return { success: false, message: '宠物未装备' };
        }
        
        // 从槽位移除
        this.slots[pet.position.type][pet.position.index] = null;
        pet.position = null;
        pet.isInBattle = false;
        
        // 清理计时器
        delete this.petAttackTimers[pet.instanceId];
        delete this.petSkillTimers[pet.instanceId];
        
        console.log(`${pet.name} 已卸下`);
        return { success: true, message: `${pet.name} 已下阵` };
    }
    
    /**
     * 升级宠物
     */
    upgradePet(petInstanceId) {
        const pet = this.ownedPets.find(p => p.instanceId === petInstanceId);
        if (!pet) {
            return { success: false, message: '宠物不存在' };
        }
        
        // 检查经验是否足够
        if (pet.exp < pet.expToNext) {
            return { success: false, message: '经验不足' };
        }
        
        // 升级
        pet.level++;
        pet.exp -= pet.expToNext;
        pet.expToNext = Math.floor(pet.expToNext * 1.5);
        
        // 提升属性
        pet.attack += 5;
        pet.maxHp += 20;
        pet.hp += 20;
        pet.currentHp = Math.min(pet.currentHp + 20, pet.maxHp);
        pet.defense += 2;
        
        console.log(`${pet.name} 升级到 ${pet.level} 级`);
        return { success: true, message: `${pet.name} 升级到 ${pet.level} 级!` };
    }
    
    /**
     * 喂食宠物
     */
    feedPet(petInstanceId) {
        const pet = this.ownedPets.find(p => p.instanceId === petInstanceId);
        if (!pet) {
            return { success: false, message: '宠物不存在' };
        }
        
        // 检查饥饿度
        if (pet.hunger >= 100) {
            return { success: false, message: '宠物不饿' };
        }
        
        // 喂食成本
        const cost = 50 * pet.level;
        if (!this.resourceSystem.hasEnoughCoins(cost)) {
            return { success: false, message: '金币不足' };
        }
        
        // 扣除金币
        this.resourceSystem.spendCoins(cost);
        
        // 恢复饥饿度和精力
        pet.hunger = Math.min(100, pet.hunger + 30);
        pet.energy = Math.min(100, pet.energy + 20);
        pet.friendship = Math.min(100, pet.friendship + 2);
        pet.lastFeedTime = Date.now();
        
        console.log(`喂食 ${pet.name}`);
        return { success: true, message: `${pet.name} 吃饱了，好感度+2` };
    }
    
    /**
     * 训练宠物
     */
    trainPet(petInstanceId) {
        const pet = this.ownedPets.find(p => p.instanceId === petInstanceId);
        if (!pet) {
            return { success: false, message: '宠物不存在' };
        }
        
        // 检查精力
        if (pet.energy < 20) {
            return { success: false, message: '宠物精力不足' };
        }
        
        // 训练成本
        const cost = 100 * pet.level;
        if (!this.resourceSystem.hasEnoughCoins(cost)) {
            return { success: false, message: '金币不足' };
        }
        
        // 扣除金币和精力
        this.resourceSystem.spendCoins(cost);
        pet.energy -= 20;
        
        // 获得经验
        const expGain = 20 + pet.level * 5;
        pet.exp += expGain;
        pet.friendship = Math.min(100, pet.friendship + 1);
        pet.lastTrainTime = Date.now();
        
        // 检查是否升级
        let leveledUp = false;
        while (pet.exp >= pet.expToNext) {
            this.upgradePet(petInstanceId);
            leveledUp = true;
        }
        
        console.log(`训练 ${pet.name}，获得 ${expGain} 经验`);
        return { 
            success: true, 
            message: `${pet.name} 获得 ${expGain} 经验${leveledUp ? '，等级提升！' : ''}` 
        };
    }
    
    /**
     * 更新宠物系统
     */
    update(deltaTime) {
        // 更新宠物状态（饥饿度、精力等）
        this.updatePetStates(deltaTime);
        
        // 更新宠物战斗
        this.updatePetCombat(deltaTime);
        
        // 更新宠物子弹
        this.updatePetBullets(deltaTime);
        
        // 更新技能特效
        this.updateSkillEffects(deltaTime);
    }
    
    /**
     * 更新宠物状态
     */
    updatePetStates(deltaTime) {
        const currentTime = Date.now();
        
        this.ownedPets.forEach(pet => {
            // 每10分钟减少10点饥饿度
            const timeSinceFeed = currentTime - pet.lastFeedTime;
            const hungerDecrease = Math.floor(timeSinceFeed / 600000) * 10;
            pet.hunger = Math.max(0, 100 - hungerDecrease);
            
            // 每小时恢复20点精力
            const timeSinceTrain = currentTime - pet.lastTrainTime;
            const energyRecover = Math.floor(timeSinceTrain / 3600000) * 20;
            pet.energy = Math.min(100, pet.energy + energyRecover);
            
            // 好感度影响战斗属性（0-20%加成）
            const friendshipBonus = pet.friendship / 500; // 0-0.2
            
            // 饥饿度影响战斗效率（低于30会减弱）
            const hungerPenalty = pet.hunger < 30 ? 0.7 : 1.0;
        });
    }
    
    /**
     * 更新宠物战斗
     */
    updatePetCombat(deltaTime) {
        // 遍历所有装备的宠物
        ['front', 'back'].forEach(position => {
            this.slots[position].forEach((pet, index) => {
                if (!pet) return;
                
                // 更新普通攻击计时器
                this.petAttackTimers[pet.instanceId] = (this.petAttackTimers[pet.instanceId] || 0) + deltaTime;
                
                // 攻击间隔（基于攻击速度）
                const attackInterval = 1000 / pet.attackSpeed;
                
                if (this.petAttackTimers[pet.instanceId] >= attackInterval) {
                    this.petNormalAttack(pet, position, index);
                    this.petAttackTimers[pet.instanceId] = 0;
                }
                
                // 更新技能CD
                this.petSkillTimers[pet.instanceId] = (this.petSkillTimers[pet.instanceId] || 0) + deltaTime;
                
                if (this.petSkillTimers[pet.instanceId] >= pet.skill.cooldown) {
                    this.petUseSkill(pet, position, index);
                    this.petSkillTimers[pet.instanceId] = 0;
                }
            });
        });
    }
    
    /**
     * 宠物普通攻击
     */
    petNormalAttack(pet, position, slotIndex) {
        // 获取最近的怪物（从战斗系统）
        const target = this.findNearestMonster(pet, position, slotIndex);
        if (!target) return;
        
        // 计算宠物位置（在Canvas上）
        const petPos = this.getPetPosition(position, slotIndex);
        
        // 发射子弹
        const bullet = {
            petId: pet.instanceId,
            x: petPos.x,
            y: petPos.y,
            targetX: target.x + target.width / 2,
            targetY: target.y + target.height / 2,
            damage: pet.attack,
            speed: 300,
            type: pet.type,
            size: 6,
            life: 3000
        };
        
        this.petBullets.push(bullet);
    }
    
    /**
     * 宠物使用技能
     */
    petUseSkill(pet, position, slotIndex) {
        const skill = pet.skill;
        console.log(`${pet.name} 使用技能: ${skill.name}`);
        
        // 根据技能类型创建特效
        const petPos = this.getPetPosition(position, slotIndex);
        
        const effect = {
            petId: pet.instanceId,
            skillId: skill.id,
            x: petPos.x,
            y: petPos.y,
            type: pet.type,
            damage: skill.damage,
            duration: skill.duration || 1000,
            life: skill.duration || 1000,
            targets: skill.targets || 1,
            ...skill
        };
        
        this.petSkillEffects.push(effect);
        
        // 立即应用技能效果
        this.applySkillEffect(effect);
    }
    
    /**
     * 应用技能效果
     */
    applySkillEffect(effect) {
        // 这里需要与战斗系统交互
        // 暂时留空，后面在集成时实现
        console.log('应用技能效果:', effect.skillId);
    }
    
    /**
     * 查找最近的怪物
     */
    findNearestMonster(pet, position, slotIndex) {
        if (!this.combatSystem) return null;
        
        const monsters = this.combatSystem.getMonsters();
        if (!monsters || monsters.length === 0) return null;
        
        const petPos = this.getPetPosition(position, slotIndex);
        let nearestMonster = null;
        let minDistance = Infinity;
        
        monsters.forEach(monster => {
            const dx = monster.x + monster.width / 2 - petPos.x;
            const dy = monster.y + monster.height / 2 - petPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestMonster = monster;
            }
        });
        
        return nearestMonster;
    }
    
    /**
     * 获取宠物在Canvas上的位置
     */
    getPetPosition(position, slotIndex) {
        const mapSize = this.gameCore.getMapSize();
        
        // 前排在左侧，后排在更左侧
        const baseX = position === 'front' ? 100 : 60;
        const baseY = mapSize.height - 100;
        
        // 垂直排列
        const spacing = 40;
        const y = baseY - (slotIndex * spacing);
        
        return { x: baseX, y: y };
    }
    
    /**
     * 更新宠物子弹
     */
    updatePetBullets(deltaTime) {
        for (let i = this.petBullets.length - 1; i >= 0; i--) {
            const bullet = this.petBullets[i];
            
            // 计算移动方向
            const dx = bullet.targetX - bullet.x;
            const dy = bullet.targetY - bullet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 10) {
                // 子弹到达目标
                this.petBullets.splice(i, 1);
                // 这里需要对怪物造成伤害（后面集成）
                continue;
            }
            
            // 移动子弹
            const moveDistance = bullet.speed * (deltaTime / 1000);
            bullet.x += (dx / distance) * moveDistance;
            bullet.y += (dy / distance) * moveDistance;
            
            // 生命周期
            bullet.life -= deltaTime;
            if (bullet.life <= 0) {
                this.petBullets.splice(i, 1);
            }
        }
    }
    
    /**
     * 更新技能特效
     */
    updateSkillEffects(deltaTime) {
        for (let i = this.petSkillEffects.length - 1; i >= 0; i--) {
            const effect = this.petSkillEffects[i];
            effect.life -= deltaTime;
            
            if (effect.life <= 0) {
                this.petSkillEffects.splice(i, 1);
            }
        }
    }
    
    /**
     * 渲染宠物系统
     */
    render(ctx) {
        // 渲染宠物
        this.renderPets(ctx);
        
        // 渲染宠物子弹
        this.renderPetBullets(ctx);
        
        // 渲染技能特效
        this.renderSkillEffects(ctx);
    }
    
    /**
     * 渲染宠物
     */
    renderPets(ctx) {
        ['front', 'back'].forEach(position => {
            this.slots[position].forEach((pet, index) => {
                if (!pet) return;
                
                const pos = this.getPetPosition(position, index);
                
                // 绘制宠物图标（水平翻转朝右）
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.scale(-1, 1);
                ctx.font = '24px Arial';
                ctx.fillText(pet.image, -12, 8);
                ctx.restore();
                
                // 绘制生命值条
                const hpBarWidth = 40;
                const hpBarHeight = 4;
                const hpPercent = pet.currentHp / pet.maxHp;
                
                ctx.fillStyle = '#333';
                ctx.fillRect(pos.x - 20, pos.y - 20, hpBarWidth, hpBarHeight);
                ctx.fillStyle = hpPercent > 0.5 ? '#4caf50' : hpPercent > 0.25 ? '#ff9800' : '#f44336';
                ctx.fillRect(pos.x - 20, pos.y - 20, hpBarWidth * hpPercent, hpBarHeight);
            });
        });
    }
    
    /**
     * 渲染宠物子弹
     */
    renderPetBullets(ctx) {
        this.petBullets.forEach(bullet => {
            // 根据宠物类型设置子弹颜色
            const colors = {
                fire: '#ff5722',
                ice: '#03a9f4',
                thunder: '#ffeb3b',
                earth: '#8d6e63',
                wind: '#9ccc65',
                light: '#fff176',
                dark: '#9e9e9e',
                phoenix: '#ff6f00'
            };
            
            ctx.fillStyle = colors[bullet.type] || '#ffffff';
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
            ctx.fill();
            
            // 添加光晕效果
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        });
    }
    
    /**
     * 渲染技能特效
     */
    renderSkillEffects(ctx) {
        this.petSkillEffects.forEach(effect => {
            const opacity = effect.life / effect.duration;
            ctx.globalAlpha = opacity;
            
            // 根据技能类型绘制不同特效
            switch (effect.skillId) {
                case 'fireball':
                    this.renderFireball(ctx, effect);
                    break;
                case 'frost_nova':
                    this.renderFrostNova(ctx, effect);
                    break;
                case 'chain_lightning':
                    this.renderChainLightning(ctx, effect);
                    break;
                // 其他技能特效...
            }
            
            ctx.globalAlpha = 1;
        });
    }
    
    /**
     * 渲染火球术特效
     */
    renderFireball(ctx, effect) {
        // 火球特效已移除视觉显示
        // 保留函数以避免错误
    }
    
    /**
     * 渲染冰霜新星特效
     */
    renderFrostNova(ctx, effect) {
        ctx.strokeStyle = '#03a9f4';
        ctx.lineWidth = 3;
        const radius = 50 * (1 - effect.life / effect.duration);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    /**
     * 渲染连锁闪电特效
     */
    renderChainLightning(ctx, effect) {
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 2;
        // 简单的闪电效果
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(effect.x + 50, effect.y - 20);
        ctx.lineTo(effect.x + 80, effect.y + 10);
        ctx.stroke();
    }
    
    /**
     * 获取所有装备的宠物
     */
    getEquippedPets() {
        const equipped = [];
        ['front', 'back'].forEach(position => {
            this.slots[position].forEach(pet => {
                if (pet) equipped.push(pet);
            });
        });
        return equipped;
    }
    
    /**
     * 获取总战力加成
     */
    getTotalPowerBonus() {
        const equipped = this.getEquippedPets();
        let totalAttack = 0;
        let totalDefense = 0;
        
        equipped.forEach(pet => {
            totalAttack += pet.attack;
            totalDefense += pet.defense;
        });
        
        return { attack: totalAttack, defense: totalDefense };
    }
    
    /**
     * 获取玩家等级（从其他系统）
     */
    getPlayerLevel() {
        // 尝试从GameCore获取PlayerSystem
        if (this.gameCore) {
            // 检查gameCore是否有playerSystem引用
            if (this.gameCore.playerSystem) {
                const playerData = this.gameCore.playerSystem.getPlayerData();
                return playerData ? playerData.level : 1;
            }
            // 如果没有，尝试从全局game对象获取
            if (window.game && window.game.playerSystem) {
                const playerData = window.game.playerSystem.getPlayerData();
                return playerData ? playerData.level : 1;
            }
        }
        return 1;
    }
    
    /**
     * 获取存档数据
     */
    getSaveData() {
        return {
            ownedPets: this.ownedPets.map(pet => ({
                instanceId: pet.instanceId,
                templateId: pet.templateId,
                level: pet.level,
                exp: pet.exp,
                expToNext: pet.expToNext,
                attack: pet.attack,
                hp: pet.hp,
                maxHp: pet.maxHp,
                defense: pet.defense,
                friendship: pet.friendship,
                hunger: pet.hunger,
                energy: pet.energy,
                lastFeedTime: pet.lastFeedTime,
                lastTrainTime: pet.lastTrainTime,
                position: pet.position
            })),
            slots: {
                front: this.slots.front.map(p => p ? p.instanceId : null),
                back: this.slots.back.map(p => p ? p.instanceId : null)
            }
        };
    }
    
    /**
     * 加载存档数据
     */
    loadSaveData(data) {
        if (!data) return;
        
        // 恢复宠物数据
        this.ownedPets = data.ownedPets.map(savedPet => {
            const template = this.petDatabase[savedPet.templateId];
            return {
                ...savedPet,
                ...template, // 合并模板数据
                currentHp: savedPet.hp,
                isInBattle: false,
                buffs: [],
                debuffs: []
            };
        });
        
        // 恢复槽位
        if (data.slots) {
            ['front', 'back'].forEach(position => {
                data.slots[position].forEach((instanceId, index) => {
                    if (instanceId) {
                        const pet = this.ownedPets.find(p => p.instanceId === instanceId);
                        if (pet) {
                            this.equipPet(instanceId, position, index);
                        }
                    }
                });
            });
        }
        
        console.log('宠物系统数据已加载');
    }
    
    /**
     * 清空所有数据（用于测试）
     */
    resetAll() {
        this.ownedPets = [];
        this.slots = {
            front: [null, null, null],
            back: [null, null, null]
        };
        this.petBullets = [];
        this.petSkillEffects = [];
        this.petAttackTimers = {};
        this.petSkillTimers = {};
    }
}

// 单例模式
let petSystemInstance = null;

export function getPetSystemInstance(gameCore, resourceSystem) {
    if (!petSystemInstance && gameCore && resourceSystem) {
        petSystemInstance = new PetSystem(gameCore, resourceSystem);
    }
    return petSystemInstance;
}

export default PetSystem;
