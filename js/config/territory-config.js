/**
 * @file 领地系统配置
 * @description 包含建筑类型定义、建筑数值数据和领地扩张配置
 */

export const BuildingType = {
    MAIN_BASE: "main_base",
    TRAINING_GROUND: "training_ground",
    TEMPLE: "temple",
    BARRACKS: "barracks",
    WORKSHOP: "workshop",
    CRYSTAL_MINE: "crystal_mine",
    LIBRARY: "library",
    HOSPITAL: "hospital",
    TOWER: "tower",
    MARKET: "market"
};

export const EXPANSION_CONFIG = {
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

export const BUILDING_DATA = {
    [BuildingType.MAIN_BASE]: {
        name: "主基地",
        levels: [
            { level: 1, cost: { gold: 0, crystal: 0 }, hp: 1000, buildLimit: 5 },
            { level: 2, cost: { gold: 10000, crystal: 500 }, hp: 1500, buildLimit: 8 },
        ]
    },
    [BuildingType.TRAINING_GROUND]: {
        name: "训练场",
        levels: [
            { level: 1, cost: { gold: 1000, crystal: 0 }, attackBonus: 5 },
            { level: 2, cost: { gold: 5000, crystal: 500 }, attackBonus: 10 },
            { level: 3, cost: { gold: 15000, crystal: 1500 }, attackBonus: 20 },
        ]
    },
    [BuildingType.TEMPLE]: {
        name: "神庙",
        levels: [
            { level: 1, cost: { gold: 1000, crystal: 0 }, defenseBonus: 5 },
            { level: 2, cost: { gold: 5000, crystal: 500 }, defenseBonus: 10 },
            { level: 3, cost: { gold: 15000, crystal: 1500 }, defenseBonus: 20 },
        ]
    },
    [BuildingType.BARRACKS]: {
        name: "兵营",
        levels: [
            { level: 1, cost: { gold: 2000, crystal: 200 }, hp: 800, attackBonus: 3, defenseBonus: 3 },
            { level: 2, cost: { gold: 8000, crystal: 800 }, hp: 1200, attackBonus: 6, defenseBonus: 6 },
            { level: 3, cost: { gold: 20000, crystal: 2000 }, hp: 1800, attackBonus: 12, defenseBonus: 12 },
        ]
    },
    [BuildingType.WORKSHOP]: {
        name: "工坊",
        levels: [
            { level: 1, cost: { gold: 3000, crystal: 300 }, goldProduction: 50 },
            { level: 2, cost: { gold: 12000, crystal: 1200 }, goldProduction: 100 },
            { level: 3, cost: { gold: 30000, crystal: 3000 }, goldProduction: 200 },
        ]
    },
    [BuildingType.CRYSTAL_MINE]: {
        name: "水晶矿",
        levels: [
            { level: 1, cost: { gold: 5000, crystal: 0 }, crystalProduction: 10 },
            { level: 2, cost: { gold: 20000, crystal: 2000 }, crystalProduction: 25 },
            { level: 3, cost: { gold: 50000, crystal: 5000 }, crystalProduction: 50 },
        ]
    },
    [BuildingType.LIBRARY]: {
        name: "图书馆",
        levels: [
            { level: 1, cost: { gold: 4000, crystal: 400 }, experienceBonus: 10 },
            { level: 2, cost: { gold: 16000, crystal: 1600 }, experienceBonus: 25 },
            { level: 3, cost: { gold: 40000, crystal: 4000 }, experienceBonus: 50 },
        ]
    },
    [BuildingType.HOSPITAL]: {
        name: "医院",
        levels: [
            { level: 1, cost: { gold: 6000, crystal: 600 }, hp: 1200, healingRate: 5 },
            { level: 2, cost: { gold: 24000, crystal: 2400 }, hp: 2000, healingRate: 10 },
            { level: 3, cost: { gold: 60000, crystal: 6000 }, hp: 3000, healingRate: 20 },
        ]
    },
    [BuildingType.TOWER]: {
        name: "防御塔",
        levels: [
            { level: 1, cost: { gold: 8000, crystal: 800 }, attackBonus: 8, defenseBonus: 8 },
            { level: 2, cost: { gold: 32000, crystal: 3200 }, attackBonus: 16, defenseBonus: 16 },
            { level: 3, cost: { gold: 80000, crystal: 8000 }, attackBonus: 32, defenseBonus: 32 },
        ]
    },
    [BuildingType.MARKET]: {
        name: "市场",
        levels: [
            { level: 1, cost: { gold: 10000, crystal: 1000 }, goldProduction: 100, crystalProduction: 5 },
            { level: 2, cost: { gold: 40000, crystal: 4000 }, goldProduction: 200, crystalProduction: 15 },
            { level: 3, cost: { gold: 100000, crystal: 10000 }, goldProduction: 400, crystalProduction: 30 },
        ]
    },
};
