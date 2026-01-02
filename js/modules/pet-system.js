/**
 * PetSystem - 宠物系统
 * 管理宠物收集、养成、编队和战斗
 */

let instance = null;

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
                image: 'images/pets/fire_dog.png',
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
                image: 'images/pets/ice_cat.png',
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
                image: 'images/pets/thunder_bird.png',
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
                image: 'images/pets/earth_bear.png',
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
                image: 'images/pets/storm_dragon.png',
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
                image: 'images/pets/unicorn.png',
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
                image: 'images/pets/shadow_wolf.png',
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
                image: 'images/pets/phoenix.png',
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
        
        // 系统引用
        this.resourceSystem = null;
        this.playerSystem = null;
        
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
            img.src = pet.image;
            img.onload = () => {
                this.petImages[pet.id] = img;
            };
            img.onerror = () => {
                console.warn(`[PetSystem] 图片加载失败: ${pet.image}`);
            };
        });
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
    
    /**
     * 渲染装备的宠物
     */
    render(ctx, playerX, playerY) {
        this.equippedPets.forEach((pet, index) => {
            const template = this.petTemplates.find(t => t.id === pet.templateId);
            if (!template) return;
            
            const img = this.petImages[pet.templateId];
            
            // 计算宠物位置（在玩家周围旋转）
            const angle = (index * 120 + Date.now() * 0.02) * Math.PI / 180;
            const radius = 50;
            const petX = playerX + Math.cos(angle) * radius;
            const petY = playerY + Math.sin(angle) * radius * 0.5;
            
            // 绘制宠物（只使用图片）
            const size = 40;
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, petX - size / 2, petY - size / 2, size, size);
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
