/**
 * TerritorySystem - 领地系统
 * 管理领地建设、建筑升级和资源产出
 */

let instance = null;

export class TerritorySystem {
    constructor(resourceSystem = null, playerSystem = null) {
        // 系统引用
        this.resourceSystem = resourceSystem;
        this.playerSystem = playerSystem;
        
        // ==================== 建筑配置 ====================
        this.buildingData = {
            main_base: {
                name: '主基地',
                icon: '🏰',
                description: '领地核心，提供扩张与循环节奏锚点',
                baseCost: { coins: 0, crystals: 0 },
                costMultiplier: 2.0,
                maxLevel: 5,
                effects: {
                    type: 'slotUnlock',
                    value: 2  // 每级解锁2个额外地块
                },
                productionInterval: 0,  // 不产出资源
                unlock: {
                    stage: 1,
                    pulse: 0,
                    label: '初始开放'
                }
            },
            training_ground: {
                name: '训练场',
                icon: '🏋️',
                description: '把命运循环转化为主角攻击训练',
                baseCost: { coins: 500, crystals: 50 },
                costMultiplier: 1.5,
                maxLevel: 20,
                effects: {
                    type: 'attackBonus',
                    value: 5  // 每级+5攻击
                },
                productionInterval: 0,
                unlock: {
                    stage: 2,
                    pulse: 8,
                    label: '循环脉冲 8'
                }
            },
            temple: {
                name: '神庙',
                icon: '🏛️',
                description: '稳定循环收益，提升防御加成',
                baseCost: { coins: 500, crystals: 50 },
                costMultiplier: 1.5,
                maxLevel: 20,
                effects: {
                    type: 'defenseBonus',
                    value: 5  // 每级+5防御
                },
                productionInterval: 0,
                unlock: {
                    stage: 4,
                    pulse: 42,
                    label: '循环脉冲 42'
                }
            },
            barracks: {
                name: '兵营',
                icon: '⚔️',
                description: '战斗循环成型后开放，提升攻防',
                baseCost: { coins: 800, crystals: 80 },
                costMultiplier: 1.5,
                maxLevel: 15,
                effects: {
                    type: 'combatBonus',
                    attack: 3,
                    defense: 3
                },
                productionInterval: 0,
                unlock: {
                    stage: 5,
                    pulse: 64,
                    label: '循环脉冲 64'
                }
            },
            workshop: {
                name: '工坊',
                icon: '🔨',
                description: '第一座资源建筑，按节拍产出金币',
                baseCost: { coins: 1000, crystals: 100 },
                costMultiplier: 1.8,
                maxLevel: 10,
                effects: {
                    type: 'production',
                    resource: 'coins',
                    value: 50  // 基础产出
                },
                productionInterval: 45000,  // 45秒产出一次
                unlock: {
                    stage: 3,
                    pulse: 24,
                    label: '循环脉冲 24'
                }
            },
            crystal_mine: {
                name: '水晶矿',
                icon: '💎',
                description: '资源循环稳定后开放，按节拍产出水晶',
                baseCost: { coins: 2000, crystals: 200 },
                costMultiplier: 2.0,
                maxLevel: 10,
                effects: {
                    type: 'production',
                    resource: 'crystals',
                    value: 10  // 基础产出
                },
                productionInterval: 90000,  // 90秒产出一次
                unlock: {
                    stage: 6,
                    pulse: 88,
                    label: '循环脉冲 88'
                }
            },
            library: {
                name: '图书馆',
                icon: '📚',
                description: '后段成长建筑，提升经验获取',
                baseCost: { coins: 1500, crystals: 150 },
                costMultiplier: 1.6,
                maxLevel: 10,
                effects: {
                    type: 'expBonus',
                    value: 5  // 每级+5%经验
                },
                productionInterval: 0,
                unlock: {
                    stage: 7,
                    pulse: 118,
                    label: '循环脉冲 118'
                }
            }
        };
        
        // ==================== 地块配置 ====================
        this.slotConfig = {
            initialSlots: 1,
            maxSlots: 12,
            unlockPulses: [0, 8, 18, 32, 50, 72, 98, 130, 166, 206, 250, 300]
        };
        
        // ==================== 扩张成本配置 ====================
        this.expansionCosts = [
            { coins: 10000, crystals: 500, requiredMainBaseLevel: 1 },
            { coins: 25000, crystals: 1500, requiredMainBaseLevel: 1 },
            { coins: 50000, crystals: 3000, requiredMainBaseLevel: 2 }
        ];
        
        // ==================== 领地状态 ====================
        this.slots = [];           // 地块数组
        this.buildings = [];       // 已建造的建筑
        this.unlockedSlots = this.slotConfig.initialSlots;    // 已解锁地块数
        this.expansionCount = 0;   // 扩张次数
        this.lastProductionTime = Date.now();  // 上次产出时间
        this.progressContext = this.createDefaultProgressContext();
        
        // 存储键
        this.storageKey = 'petplan_territory';
        
        // 初始化地块
        this.initSlots();
        
        console.log('[TerritorySystem] 初始化完成');
    }
    
    /**
     * 初始化地块
     */
    initSlots() {
        this.slots = [];
        for (let i = 0; i < this.slotConfig.maxSlots; i++) {
            this.slots.push({
                index: i,
                unlockPulse: this.getSlotUnlockPulse(i),
                building: null
            });
        }
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

    createDefaultProgressContext() {
        return {
            totalFlips: 0,
            fateCoins: 1,
            assistants: 0,
            heroTrainingLevel: 0,
            playerLevel: 1,
            equippedPets: 0,
            petLevelTotal: 0,
            buildings: this.buildings?.length || 0,
            expansionCount: this.expansionCount || 0,
            unlockedSlots: this.unlockedSlots || this.slotConfig.initialSlots
        };
    }

    setProgressContext(context = {}) {
        this.progressContext = {
            ...this.createDefaultProgressContext(),
            ...this.progressContext,
            ...context,
            buildings: this.buildings.length,
            expansionCount: this.expansionCount,
            unlockedSlots: this.getEffectiveUnlockedSlots({
                ...this.progressContext,
                ...context
            })
        };

        return this.getProgressSummary();
    }

    getLoopPulse(context = this.progressContext) {
        const safe = {
            ...this.createDefaultProgressContext(),
            ...context
        };
        const extraPetLevels = Math.max(0, safe.petLevelTotal - safe.equippedPets);

        return Math.floor(
            safe.totalFlips +
            Math.max(0, safe.fateCoins - 1) * 24 +
            safe.assistants * 26 +
            safe.heroTrainingLevel * 16 +
            safe.equippedPets * 18 +
            extraPetLevels * 6 +
            safe.buildings * 14 +
            safe.expansionCount * 20
        );
    }

    getSlotUnlockPulse(slotIndex) {
        return this.slotConfig.unlockPulses[slotIndex] ?? slotIndex * 32;
    }

    getLoopUnlockedSlotCount(context = this.progressContext) {
        const pulse = this.getLoopPulse(context);
        return Math.min(
            this.slotConfig.maxSlots,
            this.slotConfig.unlockPulses.filter((requiredPulse) => pulse >= requiredPulse).length
        );
    }

    getEffectiveUnlockedSlots(context = this.progressContext) {
        return Math.min(
            this.slotConfig.maxSlots,
            Math.max(this.unlockedSlots, this.getLoopUnlockedSlotCount(context))
        );
    }

    getBuildingEntries() {
        return Object.entries(this.buildingData).sort(([, a], [, b]) => {
            const stageDiff = (a.unlock?.stage || 0) - (b.unlock?.stage || 0);
            if (stageDiff !== 0) return stageDiff;
            return (a.unlock?.pulse || 0) - (b.unlock?.pulse || 0);
        });
    }

    getBuildingUnlockState(buildingType, context = this.progressContext) {
        const data = this.buildingData[buildingType];
        if (!data) {
            return {
                unlocked: false,
                reason: '无效建筑',
                pulse: this.getLoopPulse(context),
                requiredPulse: 0,
                stage: 0
            };
        }

        const pulse = this.getLoopPulse(context);
        const requiredPulse = data.unlock?.pulse || 0;
        const unlocked = pulse >= requiredPulse;

        return {
            unlocked,
            pulse,
            requiredPulse,
            stage: data.unlock?.stage || 1,
            label: data.unlock?.label || `循环脉冲 ${requiredPulse}`,
            reason: unlocked ? '已开放' : `需要循环脉冲 ${requiredPulse}`
        };
    }

    isBuildingTypeUnlocked(buildingType, context = this.progressContext) {
        return this.getBuildingUnlockState(buildingType, context).unlocked;
    }

    getUnlockedBuildingTypes(context = this.progressContext) {
        return this.getBuildingEntries()
            .filter(([type]) => this.isBuildingTypeUnlocked(type, context))
            .map(([type]) => type);
    }

    getNextBuildingUnlock(context = this.progressContext) {
        return this.getBuildingEntries()
            .map(([type, data]) => ({
                type,
                data,
                state: this.getBuildingUnlockState(type, context)
            }))
            .find((entry) => !entry.state.unlocked) || null;
    }

    getNextSlotUnlock(context = this.progressContext) {
        const pulse = this.getLoopPulse(context);
        const index = this.slotConfig.unlockPulses.findIndex((requiredPulse) => pulse < requiredPulse);
        if (index === -1) return null;

        return {
            index,
            requiredPulse: this.getSlotUnlockPulse(index),
            pulse
        };
    }

    getProgressSummary(context = this.progressContext) {
        const pulse = this.getLoopPulse(context);
        const nextBuilding = this.getNextBuildingUnlock(context);
        const nextSlot = this.getNextSlotUnlock(context);
        const nextTargetPulse = nextBuilding
            ? nextBuilding.state.requiredPulse
            : nextSlot
                ? nextSlot.requiredPulse
                : pulse;
        const previousTargetPulse = Math.max(
            0,
            ...this.getBuildingEntries()
                .map(([type]) => this.getBuildingUnlockState(type, context).requiredPulse)
                .filter((requiredPulse) => requiredPulse <= pulse)
        );
        const span = Math.max(1, nextTargetPulse - previousTargetPulse);
        const progress = nextTargetPulse <= pulse
            ? 1
            : Math.max(0, Math.min(1, (pulse - previousTargetPulse) / span));

        return {
            pulse,
            stage: this.getUnlockedBuildingTypes(context).length,
            unlockedSlots: this.getEffectiveUnlockedSlots(context),
            maxSlots: this.slotConfig.maxSlots,
            unlockedBuildingTypes: this.getUnlockedBuildingTypes(context),
            nextBuilding,
            nextSlot,
            nextTargetPulse,
            progress
        };
    }
    
    // ==================== 地块状态查询 ====================
    
    /**
     * 检查地块是否已解锁
     */
    isSlotUnlocked(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.slots.length) return false;

        return slotIndex < this.getEffectiveUnlockedSlots();
    }
    
    /**
     * 获取地块状态
     */
    getSlotState(slotIndex) {
        if (!this.isSlotUnlocked(slotIndex)) {
            return 'locked';
        }
        
        const slot = this.slots[slotIndex];
        if (slot.building) {
            return 'built';
        }
        
        return 'empty';
    }
    
    /**
     * 获取所有已建造的建筑
     */
    getBuildings() {
        return this.buildings.slice();
    }
    
    /**
     * 根据位置获取建筑
     */
    getBuildingAt(slotIndex) {
        return this.buildings.find(b => b.slotIndex === slotIndex) || null;
    }
    
    // ==================== 建筑建造 ====================
    
    /**
     * 计算建造成本
     */
    calculateBuildCost(buildingType) {
        const data = this.buildingData[buildingType];
        if (!data) return null;
        
        return {
            coins: data.baseCost.coins,
            crystals: data.baseCost.crystals
        };
    }
    
    /**
     * 计算升级成本
     */
    calculateUpgradeCost(buildingType, currentLevel) {
        const data = this.buildingData[buildingType];
        if (!data) return null;
        
        const multiplier = Math.pow(data.costMultiplier, currentLevel);
        return {
            coins: Math.floor(data.baseCost.coins * multiplier),
            crystals: Math.floor(data.baseCost.crystals * multiplier)
        };
    }
    
    /**
     * 检查是否可以建造
     */
    canBuild(buildingType, slotIndex) {
        // 检查地块是否有效且已解锁
        if (!this.isSlotUnlocked(slotIndex)) {
            return { success: false, reason: '地块未解锁' };
        }
        
        // 检查地块是否为空
        const slot = this.slots[slotIndex];
        if (slot.building) {
            return { success: false, reason: '地块已被占用' };
        }
        
        // 检查建筑类型是否有效
        const data = this.buildingData[buildingType];
        if (!data) {
            return { success: false, reason: '无效的建筑类型' };
        }

        const unlockState = this.getBuildingUnlockState(buildingType);
        if (!unlockState.unlocked) {
            return { success: false, reason: unlockState.reason, unlockState };
        }
        
        // 主基地只能有一个
        if (buildingType === 'main_base') {
            const existingMainBase = this.buildings.find(b => b.type === 'main_base');
            if (existingMainBase) {
                return { success: false, reason: '主基地只能建造一个' };
            }
        }
        
        // 检查资源是否足够
        const cost = this.calculateBuildCost(buildingType);
        if (!this.resourceSystem) {
            return { success: false, reason: '资源系统未初始化' };
        }
        
        if (!this.resourceSystem.hasEnoughCoins(cost.coins)) {
            return { success: false, reason: '金币不足' };
        }
        
        if (!this.resourceSystem.hasEnoughCrystals(cost.crystals)) {
            return { success: false, reason: '水晶不足' };
        }
        
        return { success: true };
    }
    
    /**
     * 建造建筑
     */
    buildBuilding(buildingType, slotIndex) {
        const canBuildResult = this.canBuild(buildingType, slotIndex);
        if (!canBuildResult.success) {
            console.warn('[TerritorySystem] 无法建造:', canBuildResult.reason);
            return canBuildResult;
        }
        
        // 扣除资源
        const cost = this.calculateBuildCost(buildingType);
        this.resourceSystem.spendCoins(cost.coins);
        this.resourceSystem.spendCrystals(cost.crystals);
        
        // 创建建筑对象
        const building = {
            id: `building_${Date.now()}_${slotIndex}`,
            type: buildingType,
            slotIndex: slotIndex,
            level: 1,
            lastProduction: Date.now(),
            position: { x: slotIndex % 3, y: Math.floor(slotIndex / 3) }
        };
        
        // 添加到建筑列表
        this.buildings.push(building);
        
        // 更新地块
        this.slots[slotIndex].building = building;
        
        // 保存数据
        this.saveToLocalStorage();
        
        console.log('[TerritorySystem] ✅ 建造成功:', this.buildingData[buildingType].name);
        return { success: true, building };
    }
    
    /**
     * 调试用：直接建造建筑（跳过资源检查）
     */
    debugBuildBuilding(buildingType, position) {
        const slotIndex = position.y * 3 + position.x;
        
        if (!this.isSlotUnlocked(slotIndex)) {
            // 自动解锁
            this.unlockedSlots = Math.max(this.unlockedSlots, slotIndex + 1);
        }
        
        const slot = this.slots[slotIndex];
        if (slot.building) {
            return false;
        }
        
        const building = {
            id: `building_${Date.now()}_${slotIndex}`,
            type: buildingType,
            slotIndex: slotIndex,
            level: 1,
            lastProduction: Date.now(),
            position: position
        };
        
        this.buildings.push(building);
        this.slots[slotIndex].building = building;
        this.saveToLocalStorage();
        
        return true;
    }
    
    // ==================== 建筑升级 ====================
    
    /**
     * 检查是否可以升级
     */
    canUpgrade(slotIndex) {
        const building = this.getBuildingAt(slotIndex);
        if (!building) {
            return { success: false, reason: '该地块没有建筑' };
        }
        
        const data = this.buildingData[building.type];
        if (building.level >= data.maxLevel) {
            return { success: false, reason: '已达到最大等级' };
        }
        
        const cost = this.calculateUpgradeCost(building.type, building.level);
        if (!this.resourceSystem.hasEnoughCoins(cost.coins)) {
            return { success: false, reason: '金币不足' };
        }
        
        if (!this.resourceSystem.hasEnoughCrystals(cost.crystals)) {
            return { success: false, reason: '水晶不足' };
        }
        
        return { success: true, cost };
    }
    
    /**
     * 升级建筑
     */
    upgradeBuilding(slotIndex) {
        const canUpgradeResult = this.canUpgrade(slotIndex);
        if (!canUpgradeResult.success) {
            console.warn('[TerritorySystem] 无法升级:', canUpgradeResult.reason);
            return canUpgradeResult;
        }
        
        const building = this.getBuildingAt(slotIndex);
        const cost = canUpgradeResult.cost;
        
        // 扣除资源
        this.resourceSystem.spendCoins(cost.coins);
        this.resourceSystem.spendCrystals(cost.crystals);
        
        // 升级
        building.level += 1;
        
        // 保存数据
        this.saveToLocalStorage();
        
        console.log('[TerritorySystem] ✅ 升级成功:', 
            this.buildingData[building.type].name, 'Lv.', building.level);
        return { success: true, building };
    }
    
    // ==================== 建筑拆除 ====================
    
    /**
     * 拆除建筑
     */
    demolishBuilding(slotIndex) {
        const building = this.getBuildingAt(slotIndex);
        if (!building) {
            return { success: false, reason: '该地块没有建筑' };
        }
        
        // 主基地不能拆除
        if (building.type === 'main_base') {
            return { success: false, reason: '主基地不能拆除' };
        }
        
        // 返还部分资源（50%）
        const data = this.buildingData[building.type];
        const refundCoins = Math.floor(data.baseCost.coins * 0.5);
        const refundCrystals = Math.floor(data.baseCost.crystals * 0.5);
        
        this.resourceSystem.addCoins(refundCoins);
        this.resourceSystem.addCrystals(refundCrystals);
        
        // 从建筑列表移除
        const index = this.buildings.findIndex(b => b.id === building.id);
        if (index !== -1) {
            this.buildings.splice(index, 1);
        }
        
        // 清空地块
        this.slots[slotIndex].building = null;
        
        // 保存数据
        this.saveToLocalStorage();
        
        console.log('[TerritorySystem] ✅ 拆除成功，返还:', refundCoins, '金币,', refundCrystals, '水晶');
        return { success: true, refund: { coins: refundCoins, crystals: refundCrystals } };
    }
    
    // ==================== 领地扩张 ====================
    
    /**
     * 获取下一次扩张成本
     */
    getNextExpansionCost() {
        if (this.expansionCount >= this.expansionCosts.length) {
            return null;  // 已达最大扩张次数
        }
        return this.expansionCosts[this.expansionCount];
    }
    
    /**
     * 检查是否可以扩张
     */
    canExpand() {
        if (this.getEffectiveUnlockedSlots() >= this.slotConfig.maxSlots) {
            return { success: false, reason: '所有地块已开放' };
        }

        const cost = this.getNextExpansionCost();
        if (!cost) {
            return { success: false, reason: '已达到最大扩张次数' };
        }
        
        // 检查主基地等级
        const mainBase = this.buildings.find(b => b.type === 'main_base');
        const mainBaseLevel = mainBase ? mainBase.level : 0;
        if (mainBaseLevel < cost.requiredMainBaseLevel) {
            return { success: false, reason: `需要主基地等级 ${cost.requiredMainBaseLevel}` };
        }
        
        // 检查资源
        if (!this.resourceSystem.hasEnoughCoins(cost.coins)) {
            return { success: false, reason: '金币不足' };
        }
        
        if (!this.resourceSystem.hasEnoughCrystals(cost.crystals)) {
            return { success: false, reason: '水晶不足' };
        }
        
        return { success: true, cost };
    }
    
    /**
     * 扩张领地
     */
    expandTerritory() {
        const canExpandResult = this.canExpand();
        if (!canExpandResult.success) {
            console.warn('[TerritorySystem] 无法扩张:', canExpandResult.reason);
            return canExpandResult;
        }
        
        const cost = canExpandResult.cost;
        
        // 扣除资源
        this.resourceSystem.spendCoins(cost.coins);
        this.resourceSystem.spendCrystals(cost.crystals);
        
        // 更新扩张状态
        this.expansionCount += 1;
        this.unlockedSlots = Math.min(
            this.getEffectiveUnlockedSlots() + 2,
            this.slotConfig.maxSlots
        );
        
        // 保存数据
        this.saveToLocalStorage();
        
        console.log('[TerritorySystem] ✅ 扩张成功，当前地块数:', this.unlockedSlots);
        return { success: true, unlockedSlots: this.unlockedSlots };
    }
    
    // ==================== 资源产出 ====================
    
    /**
     * 收集资源产出
     */
    collectResources() {
        const now = Date.now();
        const collected = { coins: 0, crystals: 0 };
        
        for (const building of this.buildings) {
            const data = this.buildingData[building.type];
            if (!data || data.productionInterval <= 0) continue;
            
            // 计算自上次产出以来经过的时间
            const elapsed = now - building.lastProduction;
            const cycles = Math.floor(elapsed / data.productionInterval);
            
            if (cycles > 0) {
                // 计算产出量（基础产出 × 等级）
                const amount = data.effects.value * building.level * cycles;
                
                if (data.effects.resource === 'coins') {
                    collected.coins += amount;
                    this.resourceSystem.addCoins(amount);
                } else if (data.effects.resource === 'crystals') {
                    collected.crystals += amount;
                    this.resourceSystem.addCrystals(amount);
                }
                
                // 更新上次产出时间
                building.lastProduction = now - (elapsed % data.productionInterval);
            }
        }
        
        if (collected.coins > 0 || collected.crystals > 0) {
            this.saveToLocalStorage();
            console.log('[TerritorySystem] 收集资源:', collected);
        }
        
        return collected;
    }
    
    /**
     * 计算离线收益
     */
    calculateOfflineGains(offlineDurationMs) {
        const gains = { coins: 0, crystals: 0 };
        const offlineMultiplier = 0.5;  // 离线收益为在线的50%
        const maxOfflineHours = 24;
        
        // 限制离线时长
        const cappedDuration = Math.min(
            offlineDurationMs,
            maxOfflineHours * 60 * 60 * 1000
        );
        
        for (const building of this.buildings) {
            const data = this.buildingData[building.type];
            if (!data || data.productionInterval <= 0) continue;
            
            // 计算周期数
            const cycles = Math.floor(cappedDuration / data.productionInterval);
            const amount = Math.floor(
                data.effects.value * building.level * cycles * offlineMultiplier
            );
            
            if (data.effects.resource === 'coins') {
                gains.coins += amount;
            } else if (data.effects.resource === 'crystals') {
                gains.crystals += amount;
            }
        }
        
        return gains;
    }
    
    // ==================== 属性加成计算 ====================
    
    /**
     * 计算领地提供的属性加成
     */
    calculateBonuses() {
        const bonuses = {
            attack: 0,
            defense: 0,
            expBonus: 0
        };
        
        for (const building of this.buildings) {
            const data = this.buildingData[building.type];
            if (!data || !data.effects) continue;
            
            switch (data.effects.type) {
                case 'attackBonus':
                    bonuses.attack += data.effects.value * building.level;
                    break;
                case 'defenseBonus':
                    bonuses.defense += data.effects.value * building.level;
                    break;
                case 'combatBonus':
                    bonuses.attack += data.effects.attack * building.level;
                    bonuses.defense += data.effects.defense * building.level;
                    break;
                case 'expBonus':
                    bonuses.expBonus += data.effects.value * building.level;
                    break;
            }
        }
        
        return bonuses;
    }
    
    // ==================== 存档接口 ====================
    
    /**
     * 获取存档数据
     */
    getSaveData() {
        return {
            buildings: this.buildings.map(b => ({
                id: b.id,
                type: b.type,
                slotIndex: b.slotIndex,
                level: b.level,
                lastProduction: b.lastProduction,
                position: b.position
            })),
            unlockedSlots: this.unlockedSlots,
            expansionCount: this.expansionCount,
            lastProductionTime: this.lastProductionTime
        };
    }
    
    /**
     * 加载存档数据
     */
    loadSaveData(data) {
        if (!data) return;
        
        // 重置状态
        this.initSlots();
        this.buildings = [];
        
        // 恢复扩张状态
        this.unlockedSlots = data.unlockedSlots ?? this.slotConfig.initialSlots;
        this.expansionCount = data.expansionCount ?? 0;
        this.lastProductionTime = data.lastProductionTime || Date.now();
        
        // 恢复建筑
        if (data.buildings && Array.isArray(data.buildings)) {
            for (const buildingData of data.buildings) {
                const building = {
                    id: buildingData.id,
                    type: buildingData.type,
                    slotIndex: buildingData.slotIndex,
                    level: buildingData.level,
                    lastProduction: buildingData.lastProduction || Date.now(),
                    position: buildingData.position
                };
                
                this.buildings.push(building);
                
                if (this.slots[buildingData.slotIndex]) {
                    this.slots[buildingData.slotIndex].building = building;
                }
            }
        }

        this.setProgressContext(this.progressContext);
        
        console.log('[TerritorySystem] 存档加载完成，建筑数量:', this.buildings.length);
    }
    
    /**
     * 保存到 LocalStorage
     */
    saveToLocalStorage() {
        try {
            const data = this.getSaveData();
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('[TerritorySystem] 保存失败:', error);
        }
    }
    
    /**
     * 从 LocalStorage 加载
     */
    loadFromLocalStorage() {
        try {
            const dataStr = localStorage.getItem(this.storageKey);
            if (dataStr) {
                const data = JSON.parse(dataStr);
                this.loadSaveData(data);
            }
        } catch (error) {
            console.error('[TerritorySystem] 加载失败:', error);
        }
    }
    
    /**
     * 清除领地数据
     */
    clearTerritoryData() {
        this.initSlots();
        this.buildings = [];
        this.unlockedSlots = this.slotConfig.initialSlots;
        this.expansionCount = 0;
        this.lastProductionTime = Date.now();
        this.setProgressContext(this.createDefaultProgressContext());
        this.saveToLocalStorage();
        console.log('[TerritorySystem] 领地数据已清除');
    }
}

/**
 * 获取单例实例
 */
export function getTerritorySystemInstance(resourceSystem, playerSystem) {
    if (!instance) {
        instance = new TerritorySystem(resourceSystem, playerSystem);
    }
    return instance;
}
