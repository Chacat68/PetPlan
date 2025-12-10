/**
 * 装备系统
 * 管理装备生成、背包、穿戴和属性计算
 */
class EquipmentSystem {
    constructor(resourceSystem) {
        this.resourceSystem = resourceSystem;

        // 装备槽位
        this.equipmentSlots = {
            weapon: null,
            armor: null,
            accessory: null
        };

        // 背包（只存装备）
        this.inventory = [];
        this.maxInventorySize = 20;

        // 稀有度配置
        this.rarityConfig = {
            common: { name: '普通', color: '#b0bec5', multiplier: 1, chance: 0.6 },
            uncommon: { name: '优秀', color: '#4caf50', multiplier: 1.2, chance: 0.3 },
            rare: { name: '稀有', color: '#2196f3', multiplier: 1.5, chance: 0.08 },
            epic: { name: '史诗', color: '#9c27b0', multiplier: 2.0, chance: 0.019 },
            legendary: { name: '传说', color: '#ff9800', multiplier: 3.0, chance: 0.001 }
        };

        // 基础属性模板
        this.baseStats = {
            weapon: { attack: 10, critRate: 1 },
            armor: { defense: 5, hp: 50 },
            accessory: { attackSpeed: 0.05, critDamage: 0.1 } // 5%攻速, 10%爆伤
        };
    }

    /**
     * 生成随机装备
     * @param {string} type - 'weapon', 'armor', 'accessory' (可选，不传随机)
     */
    generateItem(type = null) {
        if (!type) {
            const types = ['weapon', 'armor', 'accessory'];
            type = types[Math.floor(Math.random() * types.length)];
        }

        // 随机稀有度
        const rarity = this.rollRarity();
        const config = this.rarityConfig[rarity];
        const multiplier = config.multiplier;

        const item = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            type: type,
            rarity: rarity,
            level: 1, // 暂时默认为1级
            stats: {}
        };

        // 生成名称和属性
        // 简单命名逻辑：[稀有度] [类型]
        const typeNames = { weapon: '剑', armor: '甲', accessory: '戒指' };
        item.name = `${config.name}之${typeNames[type]}`;

        // 计算属性
        if (type === 'weapon') {
            item.stats.attack = Math.floor(this.baseStats.weapon.attack * multiplier * (0.8 + Math.random() * 0.4) * 10) / 10;
            if (rarity !== 'common') {
                item.stats.critRate = Math.floor(this.baseStats.weapon.critRate * multiplier * 10) / 10;
            }
        } else if (type === 'armor') {
            item.stats.defense = Math.floor(this.baseStats.armor.defense * multiplier * (0.8 + Math.random() * 0.4) * 10) / 10;
            item.stats.hp = Math.floor(this.baseStats.armor.hp * multiplier * (0.8 + Math.random() * 0.4));
        } else if (type === 'accessory') {
            item.stats.attackSpeed = parseFloat((this.baseStats.accessory.attackSpeed * multiplier * (0.8 + Math.random() * 0.4)).toFixed(3));
            if (rarity !== 'common') {
                item.stats.critDamage = parseFloat((this.baseStats.accessory.critDamage * multiplier).toFixed(2));
            }
        }

        return item;
    }

    rollRarity() {
        const rand = Math.random();
        let cumulative = 0;
        for (const [key, conf] of Object.entries(this.rarityConfig)) {
            cumulative += conf.chance;
            if (rand <= cumulative) return key;
        }
        return 'common';
    }

    /**
     * 打造装备
     * @param {string} type 
     */
    craftItem(type) {
        const cost = { gold: 1000, crystal: 50 }; // 简化的固定成本

        if (!this.resourceSystem.hasEnoughCoins(cost.gold)) {
            return { success: false, message: '金币不足' };
        }
        if (this.resourceSystem.getCrystals() < cost.crystal) {
            return { success: false, message: '水晶不足' };
        }

        if (this.inventory.length >= this.maxInventorySize) {
            return { success: false, message: '背包已满' };
        }

        this.resourceSystem.spendCoins(cost.gold);
        this.resourceSystem.spendCrystals(cost.crystal); // 假设resourceSystem有这个方法，或是addCrystals(-cost)

        const item = this.generateItem(type);
        this.inventory.push(item);

        return { success: true, message: `获得了 ${item.name}`, item: item };
    }

    /**
     * 穿戴装备
     */
    equipItem(itemId) {
        const index = this.inventory.findIndex(i => i.id === itemId);
        if (index === -1) return { success: false, message: '找不到装备' };

        const item = this.inventory[index];
        const slot = item.type;

        // 如果槽位有装备，先卸下
        if (this.equipmentSlots[slot]) {
            this.unequipItem(slot);
        }

        this.equipmentSlots[slot] = item;
        this.inventory.splice(index, 1);

        return { success: true, message: '装备成功' };
    }

    /**
     * 卸下装备
     */
    unequipItem(slot) {
        if (!this.equipmentSlots[slot]) return { success: false, message: '槽位为空' };
        if (this.inventory.length >= this.maxInventorySize) return { success: false, message: '背包已满' };

        const item = this.equipmentSlots[slot];
        this.inventory.push(item);
        this.equipmentSlots[slot] = null;

        return { success: true, message: '卸下成功' };
    }

    /**
     * 获取总属性加成
     */
    getTotalBonuses() {
        const bonuses = {
            attack: 0,
            defense: 0,
            hp: 0,
            critRate: 0,
            critDamage: 0,
            attackSpeed: 0
        };

        Object.values(this.equipmentSlots).forEach(item => {
            if (!item) return;
            if (item.stats.attack) bonuses.attack += item.stats.attack;
            if (item.stats.defense) bonuses.defense += item.stats.defense;
            if (item.stats.hp) bonuses.hp += item.stats.hp;
            if (item.stats.critRate) bonuses.critRate += item.stats.critRate;
            if (item.stats.critDamage) bonuses.critDamage += item.stats.critDamage;
            if (item.stats.attackSpeed) bonuses.attackSpeed += item.stats.attackSpeed;
        });

        return bonuses;
    }

    getSaveData() {
        return {
            equipmentSlots: this.equipmentSlots,
            inventory: this.inventory
        };
    }

    loadSaveData(data) {
        if (!data) return;
        this.equipmentSlots = data.equipmentSlots || { weapon: null, armor: null, accessory: null };
        this.inventory = data.inventory || [];
    }
}

let equipmentSystemInstance = null;
export function getEquipmentSystemInstance(resourceSystem) {
    if (!equipmentSystemInstance) {
        equipmentSystemInstance = new EquipmentSystem(resourceSystem);
    }
    return equipmentSystemInstance;
}

export default EquipmentSystem;
