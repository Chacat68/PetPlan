/**
 * @file 领地系统核心逻辑
 * @description 管理领地数据、建筑、资源产出和属性加成。
 */

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

        // 领地扩张配置
        this.expansionConfig = {
            // 每次扩张增加的地块数量
            slotsPerExpansion: 2,
            // 扩张成本配置（按扩张次数递增）
            costs: [
                { gold: 10000, crystal: 500, contractRequired: 1 },    // 第1次扩张
                { gold: 25000, crystal: 1500, contractRequired: 2 },   // 第2次扩张
                { gold: 50000, crystal: 3000, contractRequired: 3 },   // 第3次扩张
            ],
            // 扩张需要的主基地等级
            requiredMainBaseLevel: [1, 1, 2],
            // 扩张后新地块的解锁等级要求
            newSlotUnlockLevels: [
                [0, 5],    // 第1次扩张：地块6(0级)、地块7(5级)
                [10, 15],  // 第2次扩张：地块8(10级)、地块9(15级)
                [20, 25],  // 第3次扩张：地块10(20级)、地块11(25级)
            ]
        };

        // 建筑的静态数据，包括各等级的属性
        this.buildingData = {
            "main_base": {
                name: "主基地",
                levels: [
                    { level: 1, cost: { gold: 0, crystal: 0 }, hp: 1000, buildLimit: 5 },
                    { level: 2, cost: { gold: 10000, crystal: 500 }, hp: 1500, buildLimit: 8 },
                ]
            },
            "training_ground": {
                name: "训练场",
                levels: [
                    { level: 1, cost: { gold: 1000, crystal: 0 }, attackBonus: 5 },
                    { level: 2, cost: { gold: 5000, crystal: 500 }, attackBonus: 10 },
                    { level: 3, cost: { gold: 15000, crystal: 1500 }, attackBonus: 20 },
                ]
            },
            "temple": {
                name: "神庙",
                levels: [
                    { level: 1, cost: { gold: 1000, crystal: 0 }, defenseBonus: 5 },
                    { level: 2, cost: { gold: 5000, crystal: 500 }, defenseBonus: 10 },
                    { level: 3, cost: { gold: 15000, crystal: 1500 }, defenseBonus: 20 },
                ]
            },
            "barracks": {
                name: "兵营",
                levels: [
                    { level: 1, cost: { gold: 2000, crystal: 200 }, hp: 800, attackBonus: 3, defenseBonus: 3 },
                    { level: 2, cost: { gold: 8000, crystal: 800 }, hp: 1200, attackBonus: 6, defenseBonus: 6 },
                    { level: 3, cost: { gold: 20000, crystal: 2000 }, hp: 1800, attackBonus: 12, defenseBonus: 12 },
                ]
            },
            "workshop": {
                name: "工坊",
                levels: [
                    { level: 1, cost: { gold: 3000, crystal: 300 }, goldProduction: 50 },
                    { level: 2, cost: { gold: 12000, crystal: 1200 }, goldProduction: 100 },
                    { level: 3, cost: { gold: 30000, crystal: 3000 }, goldProduction: 200 },
                ]
            },
            "crystal_mine": {
                name: "水晶矿",
                levels: [
                    { level: 1, cost: { gold: 5000, crystal: 0 }, crystalProduction: 10 },
                    { level: 2, cost: { gold: 20000, crystal: 2000 }, crystalProduction: 25 },
                    { level: 3, cost: { gold: 50000, crystal: 5000 }, crystalProduction: 50 },
                ]
            },
            "library": {
                name: "图书馆",
                levels: [
                    { level: 1, cost: { gold: 4000, crystal: 400 }, experienceBonus: 10 },
                    { level: 2, cost: { gold: 16000, crystal: 1600 }, experienceBonus: 25 },
                    { level: 3, cost: { gold: 40000, crystal: 4000 }, experienceBonus: 50 },
                ]
            },
            "hospital": {
                name: "医院",
                levels: [
                    { level: 1, cost: { gold: 6000, crystal: 600 }, hp: 1200, healingRate: 5 },
                    { level: 2, cost: { gold: 24000, crystal: 2400 }, hp: 2000, healingRate: 10 },
                    { level: 3, cost: { gold: 60000, crystal: 6000 }, hp: 3000, healingRate: 20 },
                ]
            },
            "tower": {
                name: "防御塔",
                levels: [
                    { level: 1, cost: { gold: 8000, crystal: 800 }, attackBonus: 8, defenseBonus: 8 },
                    { level: 2, cost: { gold: 32000, crystal: 3200 }, attackBonus: 16, defenseBonus: 16 },
                    { level: 3, cost: { gold: 80000, crystal: 8000 }, attackBonus: 32, defenseBonus: 32 },
                ]
            },
            "market": {
                name: "市场",
                levels: [
                    { level: 1, cost: { gold: 10000, crystal: 1000 }, goldProduction: 100, crystalProduction: 5 },
                    { level: 2, cost: { gold: 40000, crystal: 4000 }, goldProduction: 200, crystalProduction: 15 },
                    { level: 3, cost: { gold: 100000, crystal: 10000 }, goldProduction: 400, crystalProduction: 30 },
                ]
            },
        };
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

            // 扣除整秒，保留余数
            this.accumulator -= 1000;
        }
    }

    /**
     * 计算当前总资源产出（每秒）
     * @returns {{gold: number, crystal: number}} 每秒产出量
     */
    calculateTotalProduction() {
        let totalProduction = { gold: 0, crystal: 0 };

        this.territoryData.buildings.forEach(building => {
            const buildingInfo = this.buildingData[building.type];
            if (buildingInfo && buildingInfo.levels) {
                // 找到对应等级的数据（注意：building.level 是从1开始，数组索引是从0开始，通常需要-1）
                // 但这里的数据结构 seems to use explicit level matching or array index?
                // Checking previous code: buildingData[type].levels is an array.
                // Assuming levels are ordered 1, 2, 3... so index = level - 1

                const levelIndex = building.level - 1;
                if (levelIndex >= 0 && levelIndex < buildingInfo.levels.length) {
                    const levelInfo = buildingInfo.levels[levelIndex];

                    if (levelInfo.goldProduction) {
                        totalProduction.gold += levelInfo.goldProduction;
                    }
                    if (levelInfo.crystalProduction) {
                        totalProduction.crystal += levelInfo.crystalProduction;
                    }
                }
            }
        });

        return totalProduction;
    }

    /**
     * 获取所有建筑提供的总属性加成
     * @returns {{attackBonus: number, defenseBonus: number}} 返回总的攻击和防御加成
     */
    getTotalAttributeBonuses() {
        let totalBonuses = { attackBonus: 0, defenseBonus: 0 };
        this.territoryData.buildings.forEach(building => {
            const buildingInfo = this.buildingData[building.type];
            if (buildingInfo && buildingInfo.levels) {
                const levelInfo = buildingInfo.levels.find(l => l.level === building.level);
                if (levelInfo) {
                    if (levelInfo.attackBonus) {
                        totalBonuses.attackBonus += levelInfo.attackBonus;
                    }
                    if (levelInfo.defenseBonus) {
                        totalBonuses.defenseBonus += levelInfo.defenseBonus;
                    }
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