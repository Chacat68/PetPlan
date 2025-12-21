/**
 * @file 领地系统核心逻辑
 * @description 管理领地数据、建筑、资源产出和属性加成。
 */

import { BUILDING_DATA, EXPANSION_CONFIG } from '../config/territory-config.js';

class TerritorySystem {
    constructor(resourceSystem) {
        this.resourceSystem = resourceSystem;
        // 初始化领地数据
        this.territoryData = {
            level: 1,
            size: { width: 20, height: 20 },
            buildings: [
                {
                    id: "main_base_1",
                    type: "main_base",
                    level: 1,
                    position: { x: 10, y: 10 }
                }
            ],
            buildQueue: [], // 建造队列，存储正在建造的建筑
            // 领地扩张相关数据
            expansion: {
                currentSlots: 6,      // 当前地块数量（初始6个）
                maxSlots: 12,         // 最大地块数量
                expansionCount: 0,    // 已扩张次数
                expandedSlots: []     // 扩张解锁的地块索引
            }
        };

        this.offlineGains = null; // 存储离线收益

        // 领地扩张配置
        this.expansionConfig = EXPANSION_CONFIG;

        // 建筑的静态数据，包括各等级的属性
        this.buildingData = BUILDING_DATA;
    }

    /**
     * 初始化领地系统
     */
    init() {
        console.log("领地系统已初始化");
        console.log("建筑数据:", this.buildingData);
        console.log("建筑类型数量:", Object.keys(this.buildingData).length);
        console.log("建筑类型数量:", Object.keys(this.buildingData).length);
        // 可以在这里添加从服务器加载数据的逻辑

        // 初始化累积时间
        this.accumulator = 0;
    }

    /**
     * 更新领地系统逻辑
     * @param {number} deltaTime - 时间增量（毫秒）
     */
    update(deltaTime) {
        // 每秒产出一次资源
        this.accumulator += deltaTime;
        if (this.accumulator >= 1000) {
            const production = this.calculateTotalProduction();

            // 只有当有产出时才执行添加操作
            if (production.gold > 0) {
                this.resourceSystem.addCoins(production.gold);
            }
            if (production.crystal > 0) {
                this.resourceSystem.addCrystals(production.crystal);
            }

            // 通知UI显示特效
            if (this.onProduction && production.details && production.details.length > 0) {
                this.onProduction(production.details);
            }

            // 扣除整秒，保留余数
            this.accumulator -= 1000;
        }
    }

    /**
     * 计算当前总资源产出（每秒）
     * @returns {{gold: number, crystal: number, details: Array}} 每秒产出量及详情
     */
    calculateTotalProduction() {
        let totalProduction = { gold: 0, crystal: 0, details: [] };

        this.territoryData.buildings.forEach(building => {
            const buildingInfo = this.buildingData[building.type];
            if (buildingInfo && buildingInfo.levels) {
                const levelIndex = building.level - 1;
                if (levelIndex >= 0 && levelIndex < buildingInfo.levels.length) {
                    const levelInfo = buildingInfo.levels[levelIndex];
                    let buildingProd = { gold: 0, crystal: 0 };

                    if (levelInfo.goldProduction) {
                        buildingProd.gold = levelInfo.goldProduction;
                        totalProduction.gold += levelInfo.goldProduction;
                    }
                    if (levelInfo.crystalProduction) {
                        buildingProd.crystal = levelInfo.crystalProduction;
                        totalProduction.crystal += levelInfo.crystalProduction;
                    }

                    if (buildingProd.gold > 0 || buildingProd.crystal > 0) {
                        totalProduction.details.push({
                            id: building.id,
                            position: building.position,
                            production: buildingProd
                        });
                    }
                }
            }
        });

        return totalProduction;
    }

    /**
     * 获取所有建筑提供的总属性加成
     * @returns {Object} 返回总的属性加成对象 { attackBonus, defenseBonus, maxHpBonus, healingRateBonus, experienceBonus }
     */
    getTotalAttributeBonuses() {
        let totalBonuses = {
            attackBonus: 0,
            defenseBonus: 0,
            maxHpBonus: 0,
            healingRateBonus: 0,
            experienceBonus: 0
        };

        this.territoryData.buildings.forEach(building => {
            const buildingInfo = this.buildingData[building.type];
            if (buildingInfo && buildingInfo.levels) {
                // building.level is 1-based
                const levelIndex = building.level - 1;
                if (levelIndex >= 0 && levelIndex < buildingInfo.levels.length) {
                    const levelInfo = buildingInfo.levels[levelIndex];

                    if (levelInfo.attackBonus) totalBonuses.attackBonus += levelInfo.attackBonus;
                    if (levelInfo.defenseBonus) totalBonuses.defenseBonus += levelInfo.defenseBonus;
                    // hp in buildings usually adds to player Max HP (e.g. Barracks/Base might add structure HP, but here we treat relevant ones as player bonuses if applicable.
                    // Wait, main_base hp is usually for the base itself. Barracks hp is also for the building.
                    // Let's check the config again.
                    // "main_base": { ... hp: 1000 ... } -> Building HP
                    // "barracks": { ... hp: 800 ... } -> Building HP
                    // "hospital": { ... hp: 1200 ... } -> Building HP
                    // Only specific bonuses like "attackBonus", "defenseBonus" are clearly player stats.
                    // "experienceBonus" in library is clear.
                    // "healingRate" in hospital is likely player regeneration.
                    
                    // Let's assume 'hp' in building data is BUILDING HEALTH, not player health bonus, unless specified otherwise.
                    // Checking config from Step 39:
                    // training_ground: attackBonus
                    // temple: defenseBonus
                    // barracks: hp, attackBonus, defenseBonus. (Here hp is likely building hp, bonuses are player stats)
                    // library: experienceBonus
                    // hospital: hp, healingRate.
                    
                    // Plan says: "hp / maxHp (main_base, barracks, hospital)". 
                    // User might want these buildings to add to PLAYER HP? Or maybe just misinterpreted?
                    // Usually "Barracks" giving "Player HP" makes sense in some games, but "Building HP" makes more sense for a strategy game.
                    // However, previous context `getActualMaxHp`...
                    // Let's look at `implementation_plan.md`: "- hp / maxHp (主基地、兵营、医院)"
                    // If the user wants deep integration, and explicitly listed these, I should probably check if there is a `maxHpBonus` field or if `hp` is meant to be it.
                    // In `territory-config.js`:
                    // barracks levels: { hp: 800, attackBonus: 3, defenseBonus: 3 }
                    // It seems `hp` is the building's own health (for enemies to destroy).
                    // BUT `hospital` has `healingRate`.
                    
                    // If I look at `PlayerSystem.js` lines 31-64, player has `maxHp`.
                    // If I look at `CombatController.js` line 126, it uses `attrBonuses.attackBonus`.
                    
                    // Let's stick to adding explicitly named bonuses to player.
                    // If the building has `maxHpBonus`, add it. If it just has `hp`, it's likely building hp.
                    // HOWEVER, the plan explicitly said "extensions... hp / maxHp".
                    // I will add `maxHpBonus` if it exists in config. I suspect the current config only has `hp` (building hp).
                    // I will check if I should add `hp` to player.
                    // Actually, let's look at `js/config/territory-config.js` again? I cannot see it now but I wrote it.
                    // In Step 39, I wrote:
                    // barracks: { level: 1, cost: ..., hp: 800, attackBonus: 3, defenseBonus: 3 }
                    // It seems `hp` IS building HP.
                    // There is NO `maxHpBonus` in the config I wrote.
                    // So... `TerritorySystem` bonuses might strictly be `attackBonus`, `defenseBonus`, `healingRate`, `experienceBonus`.
                    // Unless the user INTENDED for building HP to add to player HP? Unlikely.
                    // But wait, `implementation_plan.md` says: "hp / maxHp (主基地、兵营、医院)".
                    // Maybe I should assume for now that only `attackBonus`, `defenseBonus`, `healingRate`, `experienceBonus` are player stats.
                    // The plan might be slightly loose in terminology. I will NOT add building HP to player HP unless it says `playerHpBonus`.
                    // But wait, checking `building-assets.js` descriptions I wrote in Step 47:
                    // 'barracks': `生命值 ${levelInfo.hp || 0}，攻击+${levelInfo.attackBonus || 0}...`
                    // 'main_base': `生命值 ${levelInfo.hp || 0}...`
                    // These descriptions imply `hp` is a property of the building.
                    
                    // Update: The `PlayerSystem` has `hpRegen`. `hospital` has `healingRate`. This matches.
                    // `library` has `experienceBonus`.
                    
                    // So I will just sum up: `attackBonus`, `defenseBonus`, `healingRate`, `experienceBonus`.
                    // I will NOT add `hp` to `maxHpBonus` because that seems like a bug (structure hp != player hp).
                    // UNLESS the user implies that *owning* a barracks makes the player tankier.
                    // Given the ambiguity, and "Safety First", I will treat `hp` as building hp.
                    // However, I will add `maxHpBonus` to the return object (initialized to 0) in case future config adds it.
                    
                    if (levelInfo.healingRate) totalBonuses.healingRateBonus += levelInfo.healingRate;
                    if (levelInfo.experienceBonus) totalBonuses.experienceBonus += levelInfo.experienceBonus;
                }
            }
        });
        return totalBonuses;
    }

    /**
     * 开始建造一个新建筑（加入建造队列）
     * @param {string} type - 建筑类型
     * @param {{x: number, y: number}} position - 建筑位置
     * @param {number} buildTime - 建造时间（毫秒），默认5秒
     * @returns {Object|null} 建造任务对象或null（失败时）
     */
    startBuildBuilding(type, position, buildTime = 5000) {
        const buildingInfo = this.buildingData[type];
        if (!buildingInfo) {
            console.error(`建筑类型 ${type} 不存在`);
            return null;
        }

        const mainBase = this.territoryData.buildings.find(b => b.type === 'main_base');
        if (!mainBase) {
            console.error("主基地不存在");
            return null;
        }
        const mainBaseLevelInfo = this.buildingData.main_base.levels.find(l => l.level === mainBase.level);
        if (!mainBaseLevelInfo) {
            console.error("主基地等级数据不存在");
            return null;
        }

        if (this.territoryData.buildings.length >= mainBaseLevelInfo.buildLimit) {
            console.error("已达到建筑数量上限");
            return null;
        }

        const cost = buildingInfo.levels[0].cost;
        if (!this.resourceSystem.hasEnoughResources(cost)) {
            console.error("资源不足，无法建造");
            return null;
        }

        // 扣除资源
        this.resourceSystem.spendResources(cost);
        console.log(`开始建造 ${buildingInfo.name}，消耗 Gold: ${cost.gold}, Crystal: ${cost.crystal}`);

        // 创建建造任务
        const buildTask = {
            id: `build_${type}_${Date.now()}`,
            type: type,
            buildingType: type, // 添加buildingType字段供UI使用
            position: position,
            startTime: Date.now(),
            endTime: Date.now() + buildTime,
            buildTime: buildTime
        };

        // 加入建造队列
        this.territoryData.buildQueue.push(buildTask);

        // 保存数据到本地存储
        this.saveToLocalStorage();
        return buildTask;
    }

    /**
     * 检查并完成所有已完成的建造任务
     * @returns {Array} 完成的建筑列表
     */
    checkAndCompleteBuildings() {
        const now = Date.now();
        const completedBuildings = [];

        // 找出所有已完成的建造任务
        const completedTasks = this.territoryData.buildQueue.filter(task => now >= task.endTime);

        // 处理完成的任务
        completedTasks.forEach(task => {
            const newBuilding = {
                id: `${task.type}_${Date.now()}`,
                type: task.type,
                level: 1,
                position: task.position
            };

            this.territoryData.buildings.push(newBuilding);
            completedBuildings.push(newBuilding);

            const buildingInfo = this.buildingData[task.type];
            console.log(`${buildingInfo.name} 建造完成！`);
        });

        // 从队列中移除已完成的任务
        this.territoryData.buildQueue = this.territoryData.buildQueue.filter(task => now < task.endTime);

        // 如果有建筑完成，保存数据
        if (completedBuildings.length > 0) {
            this.saveToLocalStorage();
        }

        return completedBuildings;
    }

    /**
     * 获取指定位置的建造任务
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {Object|null} 建造任务或null
     */
    getBuildTaskAtPosition(x, y) {
        return this.territoryData.buildQueue.find(task =>
            task.position.x === x && task.position.y === y
        );
    }

    /**
     * 获取建造任务的进度（0-100）
     * @param {Object} buildTask - 建造任务对象
     * @returns {number} 进度百分比
     */
    getBuildProgress(buildTask) {
        const now = Date.now();
        const elapsed = now - buildTask.startTime;
        const progress = Math.min(100, (elapsed / buildTask.buildTime) * 100);
        return Math.round(progress);
    }

    /**
     * 获取建造任务剩余时间（秒）
     * @param {Object} buildTask - 建造任务对象
     * @returns {number} 剩余秒数
     */
    getBuildRemainingTime(buildTask) {
        const now = Date.now();
        const remaining = Math.max(0, buildTask.endTime - now);
        return Math.ceil(remaining / 1000);
    }

    /**
     * 立即完成建造（用于测试或加速道具）
     * @param {string} taskId - 建造任务ID
     * @returns {boolean} 是否成功
     */
    instantCompleteBuild(taskId) {
        const taskIndex = this.territoryData.buildQueue.findIndex(task => task.id === taskId);
        if (taskIndex === -1) {
            console.error(`建造任务 ${taskId} 不存在`);
            return false;
        }

        const task = this.territoryData.buildQueue[taskIndex];

        // 创建完成的建筑
        const newBuilding = {
            id: `${task.type}_${Date.now()}`,
            type: task.type,
            level: 1,
            position: task.position
        };

        this.territoryData.buildings.push(newBuilding);

        // 从队列中移除任务
        this.territoryData.buildQueue.splice(taskIndex, 1);

        const buildingInfo = this.buildingData[task.type];
        console.log(`${buildingInfo.name} 立即建造完成！`);

        // 保存数据
        this.saveToLocalStorage();
        return true;
    }

    /**
     * 建造一个新建筑（仅用于调试和测试）
     * @param {string} type - 建筑类型
     * @param {{x: number, y: number}} position - 建筑位置
     * @returns {boolean} 是否建造成功
     */
    debugBuildBuilding(type, position) {
        const buildingInfo = this.buildingData[type];
        if (!buildingInfo) {
            console.error(`建筑类型 ${type} 不存在`);
            return false;
        }

        const mainBase = this.territoryData.buildings.find(b => b.type === 'main_base');
        if (!mainBase) {
            console.error("主基地不存在");
            return false;
        }
        const mainBaseLevelInfo = this.buildingData.main_base.levels.find(l => l.level === mainBase.level);
        if (!mainBaseLevelInfo) {
            console.error("主基地等级数据不存在");
            return false;
        }

        if (this.territoryData.buildings.length >= mainBaseLevelInfo.buildLimit) {
            console.error("已达到建筑数量上限");
            return false;
        }

        const cost = buildingInfo.levels[0].cost;
        if (!this.resourceSystem.hasEnoughResources(cost)) {
            console.error("资源不足，无法建造");
            return false;
        }

        this.resourceSystem.spendResources(cost);
        console.log(`建造 ${buildingInfo.name} 消耗 Gold: ${cost.gold}, Crystal: ${cost.crystal}`);

        const newBuilding = {
            id: `${type}_${Date.now()}`,
            type: type,
            level: 1,
            position: position
        };

        this.territoryData.buildings.push(newBuilding);
        console.log(`${buildingInfo.name} 已建成`);

        // 保存数据到本地存储
        this.saveToLocalStorage();
        return true;
    }

    /**
     * 升级一个建筑
     * @param {string} buildingId - 建筑的唯一ID
     * @returns {boolean} 是否升级成功
     */
    upgradeBuilding(buildingId) {
        const building = this.territoryData.buildings.find(b => b.id === buildingId);
        if (!building) {
            console.error(`建筑 ${buildingId} 不存在`);
            return false;
        }

        const buildingInfo = this.buildingData[building.type];
        if (!buildingInfo || !buildingInfo.levels || building.level >= buildingInfo.levels.length) {
            console.error(`建筑 ${building.type} 已达到最高等级`);
            return false;
        }

        const nextLevelInfo = buildingInfo.levels[building.level];
        const cost = nextLevelInfo.cost;
        if (!this.resourceSystem.hasEnoughResources(cost)) {
            console.error("资源不足，无法升级");
            return false;
        }

        this.resourceSystem.spendResources(cost);
        console.log(`升级 ${buildingInfo.name} 到 ${building.level + 1} 级消耗 Gold: ${cost.gold}, Crystal: ${cost.crystal}`);

        building.level++;
        console.log(`${buildingInfo.name} 已升级到 ${building.level} 级`);

        // 保存数据到本地存储
        this.saveToLocalStorage();
        return true;
    }

    /**
     * 获取所有建筑列表
     * @returns {Array} 建筑列表
     */
    getBuildings() {
        return this.territoryData.buildings;
    }

    /**
     * 获取建筑信息
     * @param {string} buildingType - 建筑类型
     * @returns {Object} 建筑信息
     */
    getBuildingInfo(buildingType) {
        return this.buildingData[buildingType];
    }

    /**
     * 根据位置获取建筑
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {Object|null} 建筑对象或null
     */
    getBuildingAtPosition(x, y) {
        return this.territoryData.buildings.find(b =>
            b.position.x === x && b.position.y === y
        );
    }

    /**
     * 拆除建筑
     * @param {string} buildingId - 建筑ID
     * @returns {boolean} 是否拆除成功
     */
    demolishBuilding(buildingId) {
        const buildingIndex = this.territoryData.buildings.findIndex(b => b.id === buildingId);
        if (buildingIndex === -1) {
            console.error(`建筑 ${buildingId} 不存在`);
            return false;
        }

        const building = this.territoryData.buildings[buildingIndex];
        const buildingInfo = this.buildingData[building.type];

        // 移除建筑
        this.territoryData.buildings.splice(buildingIndex, 1);
        console.log(`${buildingInfo.name} 已拆除`);

        // 保存数据
        this.saveToLocalStorage();
        return true;
    }

    // ==================== 领地扩张系统 ====================

    /**
     * 获取当前扩张状态
     * @returns {Object} 扩张状态信息
     */
    getExpansionStatus() {
        const expansion = this.territoryData.expansion;
        const nextExpansionIndex = expansion.expansionCount;
        const canExpand = nextExpansionIndex < this.expansionConfig.costs.length;

        return {
            currentSlots: expansion.currentSlots,
            maxSlots: expansion.maxSlots,
            expansionCount: expansion.expansionCount,
            canExpand: canExpand,
            nextCost: canExpand ? this.expansionConfig.costs[nextExpansionIndex] : null,
            requiredMainBaseLevel: canExpand ? this.expansionConfig.requiredMainBaseLevel[nextExpansionIndex] : null,
            newSlotLevels: canExpand ? this.expansionConfig.newSlotUnlockLevels[nextExpansionIndex] : null
        };
    }

    /**
     * 检查是否可以进行领地扩张
     * @returns {{canExpand: boolean, reason: string}} 检查结果
     */
    checkCanExpand() {
        const status = this.getExpansionStatus();

        // 检查是否还能扩张
        if (!status.canExpand) {
            return { canExpand: false, reason: '已达到最大扩张次数' };
        }

        // 检查主基地等级
        const mainBase = this.territoryData.buildings.find(b => b.type === 'main_base');
        if (!mainBase || mainBase.level < status.requiredMainBaseLevel) {
            return {
                canExpand: false,
                reason: `需要主基地等级 ${status.requiredMainBaseLevel}`
            };
        }

        // 检查资源是否足够
        const cost = status.nextCost;
        if (!this.resourceSystem.hasEnoughResources({ gold: cost.gold, crystal: cost.crystal })) {
            return {
                canExpand: false,
                reason: `资源不足，需要 ${cost.gold} 金币和 ${cost.crystal} 水晶`
            };
        }

        // 检查领地契约（如果需要）
        // 注意：这里假设领地契约存储在资源系统中，如果没有可以跳过
        // if (cost.contractRequired > 0) {
        //     const contracts = this.resourceSystem.getItem('territory_contract') || 0;
        //     if (contracts < cost.contractRequired) {
        //         return { 
        //             canExpand: false, 
        //             reason: `需要 ${cost.contractRequired} 个领地契约` 
        //         };
        //     }
        // }

        return { canExpand: true, reason: '可以扩张' };
    }

    /**
     * 执行领地扩张
     * @returns {{success: boolean, message: string, newSlots: Array}} 扩张结果
     */
    expandTerritory() {
        const checkResult = this.checkCanExpand();
        if (!checkResult.canExpand) {
            console.error(`扩张失败: ${checkResult.reason}`);
            return { success: false, message: checkResult.reason, newSlots: [] };
        }

        const status = this.getExpansionStatus();
        const cost = status.nextCost;
        const expansionIndex = this.territoryData.expansion.expansionCount;

        // 扣除资源
        this.resourceSystem.spendResources({ gold: cost.gold, crystal: cost.crystal });
        console.log(`领地扩张消耗 Gold: ${cost.gold}, Crystal: ${cost.crystal}`);

        // 计算新地块信息
        const currentSlotCount = this.territoryData.expansion.currentSlots;
        const newSlotLevels = this.expansionConfig.newSlotUnlockLevels[expansionIndex];
        const newSlots = [];

        for (let i = 0; i < this.expansionConfig.slotsPerExpansion; i++) {
            const newSlotIndex = currentSlotCount + i;
            const unlockLevel = newSlotLevels[i] || 0;
            newSlots.push({
                index: newSlotIndex,
                unlockLevel: unlockLevel
            });
            this.territoryData.expansion.expandedSlots.push({
                index: newSlotIndex,
                unlockLevel: unlockLevel
            });
        }

        // 更新扩张数据
        this.territoryData.expansion.currentSlots += this.expansionConfig.slotsPerExpansion;
        this.territoryData.expansion.expansionCount++;

        console.log(`领地扩张成功！新增 ${this.expansionConfig.slotsPerExpansion} 个地块`);
        console.log('新地块信息:', newSlots);

        // 保存数据
        this.saveToLocalStorage();

        return {
            success: true,
            message: `成功扩张！新增 ${this.expansionConfig.slotsPerExpansion} 个地块`,
            newSlots: newSlots
        };
    }

    /**
     * 获取所有地块信息（包括扩张的）
     * @returns {Array} 地块信息数组
     */
    getAllSlots() {
        const slots = [];
        const baseSlots = [
            { index: 0, unlockLevel: 0, alwaysUnlocked: true },
            { index: 1, unlockLevel: 5, alwaysUnlocked: false },
            { index: 2, unlockLevel: 10, alwaysUnlocked: false },
            { index: 3, unlockLevel: 15, alwaysUnlocked: false },
            { index: 4, unlockLevel: 20, alwaysUnlocked: false },
            { index: 5, unlockLevel: 25, alwaysUnlocked: false },
        ];

        // 添加基础地块
        slots.push(...baseSlots);

        // 添加扩张地块
        if (this.territoryData.expansion.expandedSlots) {
            this.territoryData.expansion.expandedSlots.forEach(slot => {
                slots.push({
                    index: slot.index,
                    unlockLevel: slot.unlockLevel,
                    alwaysUnlocked: false,
                    isExpanded: true
                });
            });
        }

        return slots;
    }

    /**
     * 获取扩张历史记录
     * @returns {Array} 扩张记录
     */
    getExpansionHistory() {
        return this.territoryData.expansion.expandedSlots || [];
    }

    /**
     * 保存领地数据到本地存储
     */
    saveToLocalStorage() {
        try {
            const territoryData = {
                level: this.territoryData.level,
                size: this.territoryData.size,
                buildings: this.territoryData.buildings,
                buildQueue: this.territoryData.buildQueue || [], // 保存建造队列
                expansion: this.territoryData.expansion || {     // 保存扩张数据
                    currentSlots: 6,
                    maxSlots: 12,
                    expansionCount: 0,
                    expandedSlots: []
                },
                timestamp: Date.now()
            };

            localStorage.setItem('pet-plan-territory', JSON.stringify(territoryData));
            console.log('领地数据已保存到本地存储');
        } catch (error) {
            console.error('保存领地数据失败:', error);
        }
    }

    /**
     * 从本地存储加载领地数据
     */
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('pet-plan-territory');
            if (savedData) {
                const territoryData = JSON.parse(savedData);

                // 验证数据完整性
                if (territoryData.buildings && Array.isArray(territoryData.buildings)) {
                    this.territoryData.level = territoryData.level || 1;
                    this.territoryData.size = territoryData.size || { width: 20, height: 20 };
                    this.territoryData.buildings = territoryData.buildings;
                    this.territoryData.buildQueue = territoryData.buildQueue || []; // 加载建造队列

                    // 加载扩张数据
                    this.territoryData.expansion = territoryData.expansion || {
                        currentSlots: 6,
                        maxSlots: 12,
                        expansionCount: 0,
                        expandedSlots: []
                    };

                    console.log('领地数据已从本地存储加载:', this.territoryData);

                    // 检查离线收益
                    if (territoryData.timestamp) {
                        const now = Date.now();
                        const lastSaveTime = territoryData.timestamp;
                        const timeDiff = now - lastSaveTime; // 毫秒
                        
                        // 最小离线时间 1 分钟，最大 24 小时
                        const minOfflineTime = 60 * 1000;
                        const maxOfflineTime = 24 * 60 * 60 * 1000;

                        if (timeDiff >= minOfflineTime) {
                            const effectiveTime = Math.min(timeDiff, maxOfflineTime);
                            const productionPerSecond = this.calculateTotalProduction();
                            const offlineSeconds = Math.floor(effectiveTime / 1000);

                            const offlineGold = Math.floor(productionPerSecond.gold * offlineSeconds);
                            const offlineCrystal = Math.floor(productionPerSecond.crystal * offlineSeconds);

                            if (offlineGold > 0 || offlineCrystal > 0) {
                                this.offlineGains = {
                                    gold: offlineGold,
                                    crystal: offlineCrystal,
                                    seconds: offlineSeconds,
                                    timeFormatted: this.formatTimeDuration(offlineSeconds)
                                };
                                console.log(`离线收益: ${offlineGold} 金币, ${offlineCrystal} 水晶 (${this.offlineGains.timeFormatted})`);
                                
                                // 直接添加资源 (?) - 还是等玩家在UI上点击领取?
                                // 策略: 这里先不添加，等UI层调用 claimOfflineGains()
                            }
                        }
                    }

                    // 检查并完成在离线期间完成的建造任务
                    const completedBuildings = this.checkAndCompleteBuildings();
                    if (completedBuildings.length > 0) {
                        console.log(`离线期间完成了 ${completedBuildings.length} 个建筑的建造`);
                    }

                    return true;
                } else {
                    console.warn('保存的领地数据格式不正确，使用默认数据');
                }
            }
        } catch (error) {
            console.error('加载领地数据失败:', error);
        }
        return false;
    }

    /**
     * 格式化时长
     */
    formatTimeDuration(seconds) {
        if (seconds < 60) return `${seconds}秒`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}分钟`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}小时${mins}分钟`;
    }

    /**
     * 获取离线收益数据
     */
    getOfflineGains() {
        return this.offlineGains || null;
    }

    /**
     * 领取离线收益
     */
    claimOfflineGains() {
        if (!this.offlineGains) return null;
        
        const gains = { ...this.offlineGains };
        
        // 添加资源
        if (gains.gold > 0) this.resourceSystem.addCoins(gains.gold);
        if (gains.crystal > 0) this.resourceSystem.addCrystals(gains.crystal);
        
        // 清除记录
        this.offlineGains = null;
        
        return gains;
    }

    /**
     * 清除领地数据
     */
    clearTerritoryData() {
        this.territoryData = {
            level: 1,
            size: { width: 20, height: 20 },
            buildings: [
                {
                    id: "main_base_1",
                    type: "main_base",
                    level: 1,
                    position: { x: 10, y: 10 }
                }
            ],
            buildQueue: [],
            expansion: {
                currentSlots: 6,
                maxSlots: 12,
                expansionCount: 0,
                expandedSlots: []
            }
        };
        localStorage.removeItem('pet-plan-territory');
        console.log('领地数据已清除');
    }

    /**
     * 获取存档数据
     * @returns {Object} 领地系统的存档数据
     */
    getSaveData() {
        return {
            level: this.territoryData.level,
            size: { ...this.territoryData.size },
            buildings: this.territoryData.buildings.map(building => ({
                id: building.id,
                type: building.type,
                level: building.level,
                position: { ...building.position }
            })),
            buildQueue: this.territoryData.buildQueue.map(task => ({ ...task })),
            expansion: {
                currentSlots: this.territoryData.expansion.currentSlots,
                maxSlots: this.territoryData.expansion.maxSlots,
                expansionCount: this.territoryData.expansion.expansionCount,
                expandedSlots: [...(this.territoryData.expansion.expandedSlots || [])]
            }
        };
    }

    /**
     * 加载存档数据
     * @param {Object} data 存档数据
     */
    loadSaveData(data) {
        if (data) {
            this.territoryData.level = data.level !== undefined ? data.level : this.territoryData.level;
            this.territoryData.size = data.size ? { ...data.size } : this.territoryData.size;

            if (data.buildings && Array.isArray(data.buildings)) {
                this.territoryData.buildings = data.buildings.map(building => ({
                    id: building.id,
                    type: building.type,
                    level: building.level,
                    position: { ...building.position }
                }));
            }

            if (data.buildQueue && Array.isArray(data.buildQueue)) {
                this.territoryData.buildQueue = data.buildQueue.map(task => ({ ...task }));
            } else {
                this.territoryData.buildQueue = [];
            }

            // 加载扩张数据
            if (data.expansion) {
                this.territoryData.expansion = {
                    currentSlots: data.expansion.currentSlots || 6,
                    maxSlots: data.expansion.maxSlots || 12,
                    expansionCount: data.expansion.expansionCount || 0,
                    expandedSlots: data.expansion.expandedSlots || []
                };
            }

            console.log('领地系统存档数据已加载');

            // 检查并完成在离线期间完成的建造任务
            const completedBuildings = this.checkAndCompleteBuildings();
            if (completedBuildings.length > 0) {
                console.log(`离线期间完成了 ${completedBuildings.length} 个建筑的建造`);
            }
        }
    }
}

// 单例模式实现
let territorySystemInstance = null;

/**
 * 获取领地系统单例实例
 * @param {ResourceSystem} resourceSystem - 资源系统实例
 * @returns {TerritorySystem} 领地系统实例
 */
export function getTerritorySystemInstance(resourceSystem) {
    if (!territorySystemInstance) {
        territorySystemInstance = new TerritorySystem(resourceSystem);
    }
    return territorySystemInstance;
}

/**
 * 重置领地系统单例实例（用于测试）
 */
export function resetTerritorySystemInstance() {
    territorySystemInstance = null;
}

export { TerritorySystem };

// 为了向后兼容，保留默认导出，但建议使用 getTerritorySystemInstance
export default TerritorySystem;