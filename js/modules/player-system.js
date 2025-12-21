/**
 * 玩家系统模块
 * 负责管理玩家角色数据、升级系统、动画效果等
 * 
 * System Prompts (系统提示词):
 * - 升级成功 (Upgrade Success)
 * - 金币不足 (Insufficient Coins)
 * - 属性已满 (Attribute Maxed)
 * - 等级限制 (Level Limit Reached)
 */

import { getTerritorySystemInstance } from './territory-system.js';

class PlayerSystem {
    constructor(gameCore, resourceSystem) {
        this.gameCore = gameCore;
        this.territorySystem = getTerritorySystemInstance(resourceSystem);
        this.resourceSystem = resourceSystem;

        // 玩家数据
        this.player = {
            x: 35, // 固定在屏幕最左边
            y: 0, // 将在初始化时设置
            width: 51,
            height: 51,
            speed: 50,
            direction: 1, // 固定面向右边
            animationFrame: 0, // 奔跑动画帧

            // 三维属性
            strength: 10,      // 力量：影响攻击力、生命值
            agility: 10,       // 敏捷：影响攻速、暴击率、闪避
            intelligence: 10,  // 智力：影响暴击伤害、技能效果

            // 属性
            level: 1,
            hp: 100,
            maxHp: 100,
            attack: 20,
            defense: 5,        // 防御力（新增）
            dodge: 0,          // 闪避率（新增）
            hpRegen: 1,
            critDamage: 150,
            attackSpeed: 1.0,
            crit: 5,
            multiShot: 1,
            tripleShot: 0,

            // 升级成本
            upgradeCosts: {
                strength: 15,
                agility: 15,
                intelligence: 15,
                attack: 10,
                hp: 15,
                defense: 12,
                hpRegen: 20,
                critDamage: 25,
                attackSpeed: 30,
                crit: 35,
                multiShot: 40,
                tripleShot: 50
            }
        };

        // 角色图片
        this.playerImage = new Image();
        this.playerImage.src = './images/rw/rw3.png';
        this.playerImageLoaded = false;
        this.playerImage.onload = () => {
            this.playerImageLoaded = true;
            console.log('角色图片加载成功');
        };
        this.playerImage.onerror = () => {
            console.error('角色图片加载失败:', this.playerImage.src);
            this.playerImageLoaded = false;
        };

        // 批量升级增量映射
        this.attributeIncreases = {
            strength: 1,
            agility: 1,
            intelligence: 1,
            attack: 5,
            hp: 20,
            defense: 2,
            hpRegen: 1,
            critDamage: 10,
            attackSpeed: 0.1,
            crit: 1,
            multiShot: 1,
            tripleShot: 5
        };

        this.init();
    }

    /**
     * 初始化玩家系统
     */
    init() {
        // 设置玩家Y坐标
        const mapSize = this.gameCore.getMapSize();
        this.player.y = mapSize.height / 2 - 25.5;
        console.log('玩家系统初始化完成');
    }

    /**
     * 计算三维属性对基础属性的影响
     */
    calculateDerivedStats() {
        const base = this.player;

        // 力量影响：
        // +2 攻击力 / 点
        // +10 最大生命值 / 点
        const strengthAttackBonus = base.strength * 2;
        const strengthHpBonus = base.strength * 10;

        // 敏捷影响：
        // +0.02 攻速 / 点
        // +0.5% 暴击率 / 点
        // +0.3% 闪避率 / 点
        const agilityAttackSpeedBonus = base.agility * 0.02;
        const agilityCritBonus = base.agility * 0.5;
        const agilityDodgeBonus = base.agility * 0.3;

        // 智力影响：
        // +5% 暴击伤害 / 点
        // +0.1 生命回复 / 点
        const intelligenceCritDamageBonus = base.intelligence * 5;
        const intelligenceRegenBonus = base.intelligence * 0.1;

        return {
            attackBonus: strengthAttackBonus,
            maxHpBonus: strengthHpBonus,
            attackSpeedBonus: agilityAttackSpeedBonus,
            critBonus: agilityCritBonus,
            dodgeBonus: agilityDodgeBonus,
            critDamageBonus: intelligenceCritDamageBonus,
            regenBonus: intelligenceRegenBonus
        };
    }

    /**
     * 设置装备系统引用
     */
    setEquipmentSystem(equipmentSystem) {
        this.equipmentSystem = equipmentSystem;
    }

    /**
     * 设置成就系统引用
     */
    setAchievementSystem(achievementSystem) {
        this.achievementSystem = achievementSystem;
    }

    /**
     * 获取总被动加成（宠物 + 装备）
     */
    getTotalBonuses() {
        const petBonuses = this.gameCore.petSystem ? this.gameCore.petSystem.getPassiveBonuses() : {
            attackPercent: 0, speedPercent: 0, hpPercent: 0, defense: 0, critRate: 0, critDamage: 0
        };

        const equipBonuses = this.equipmentSystem ? this.equipmentSystem.getTotalBonuses() : {
            attack: 0, defense: 0, hp: 0, critRate: 0, critDamage: 0, attackSpeed: 0
        };

        return { pet: petBonuses, equip: equipBonuses };
    }

    /**
     * 获取领地系统提供的属性加成
     */
    getTerritoryBonuses() {
        if (this.territorySystem && this.territorySystem.getTotalAttributeBonuses) {
            return this.territorySystem.getTotalAttributeBonuses();
        }
        return { attackBonus: 0, defenseBonus: 0, maxHpBonus: 0, healingRateBonus: 0, experienceBonus: 0 };
    }

    /**
     * 获取实际攻击力
     * 公式：(基础攻击 + 装备攻击 + 领地加成) * (1 + 宠物攻击加成)
     */
    getActualAttack() {
        const bonuses = this.getTotalBonuses();
        const territoryBonuses = this.getTerritoryBonuses();

        // 1. 基础攻击力（固有 + 升级）
        let baseAttack = this.player.attack;

        // 2. 加上装备攻击力
        baseAttack += bonuses.equip.attack;

        // 3. 加上领地攻击加成
        baseAttack += territoryBonuses.attackBonus;

        // 4. 加上力量属性加成 (每点力量增加2点攻击)
        baseAttack += this.player.strength * 2;

        // 5. 应用宠物百分比加成
        return Math.floor(baseAttack * (1 + bonuses.pet.attackPercent));
    }

    /**
     * 获取实际最大生命值
     * 公式：(基础生命 + 装备生命 + 领地加成) * (1 + 宠物生命加成)
     */
    getActualMaxHp() {
        const bonuses = this.getTotalBonuses();
        const territoryBonuses = this.getTerritoryBonuses();

        let baseHp = this.player.maxHp;

        // 加上装备生命
        baseHp += bonuses.equip.hp;

        // 加上领地生命加成
        baseHp += territoryBonuses.maxHpBonus;

        // 加上力量属性加成 (每点力量增加10点生命)
        baseHp += this.player.strength * 10;

        return Math.floor(baseHp * (1 + bonuses.pet.hpPercent));
    }

    /**
     * 获取实际攻击速度
     * 公式：(基础攻速 + 装备攻速) * (1 + 宠物攻速加成)
     */
    getActualAttackSpeed() {
        const bonuses = this.getTotalBonuses();

        let baseSpeed = this.player.attackSpeed;

        // 加上装备攻速
        baseSpeed += bonuses.equip.attackSpeed;

        // 加上敏捷属性加成 (每点敏捷增加0.01攻速)
        baseSpeed += this.player.agility * 0.01;

        return parseFloat((baseSpeed * (1 + bonuses.pet.speedPercent)).toFixed(2));
    }

    /**
     * 获取被动技能加成
     */
    getPassiveBonuses() {
        if (this.gameCore && this.gameCore.petSystem) {
            return this.gameCore.petSystem.getPassiveBonuses();
        }
        return {
            attackPercent: 0,
            speedPercent: 0,
            hpPercent: 0,
            defense: 0,
            critRate: 0,
            critDamage: 0
        };
    }

    /**
     * 获取实际暴击率
     */
    getActualCrit() {
        const bonuses = this.getTotalBonuses();

        let baseCrit = this.player.crit;

        // 加上装备暴击率
        baseCrit += bonuses.equip.critRate;

        // 加上宠物暴击率 (直接相加，因为都是百分点)
        baseCrit += bonuses.pet.critRate;

        // 加上敏捷属性加成 (每点敏捷增加0.1%暴击)
        baseCrit += this.player.agility * 0.1;

        return parseFloat(baseCrit.toFixed(2));
    }

    /**
     * 获取实际暴击伤害
     */
    getActualCritDamage() {
        const bonuses = this.getTotalBonuses();

        let baseCritDamage = this.player.critDamage;

        // 加上装备暴击伤害 (注意单位，假设equip返回的是0.5代表50%)
        baseCritDamage += (bonuses.equip.critDamage * 100);

        // 加上宠物暴击伤害 (假设pet返回的是0.2代表20%)
        baseCritDamage += (bonuses.pet.critDamage * 100);

        // 加上智力属性加成 (每点智力增加1%暴击伤害)
        baseCritDamage += this.player.intelligence * 1;

        return Math.floor(baseCritDamage);
    }

    /**
     * 获取实际生命回复
     */
    getActualRegen() {
        const territoryBonuses = this.getTerritoryBonuses();
        // 加上领地提供的治疗率加成
        return this.player.hpRegen + territoryBonuses.healingRateBonus;
    }

    /**
     * 获取实际闪避率（包含三维属性加成）
     */
    getActualDodge() {
        const derived = this.calculateDerivedStats();
        return Math.min(75, this.player.dodge + derived.dodgeBonus);
    }

    /**
     * 获取实际防御力
     */
    getActualDefense() {
        const bonuses = this.getTotalBonuses();
        const territoryBonuses = this.getTerritoryBonuses();

        let baseDefense = this.player.defense;

        // 加上装备防御
        baseDefense += bonuses.equip.defense;

        // 加上领地防御加成
        baseDefense += territoryBonuses.defenseBonus;

        // 加上宠物被动
        baseDefense += bonuses.pet.defense;

        return Math.floor(baseDefense);
    }

    /**
     * 更新玩家状态
     */
    update(deltaTime) {
        // 更新奔跑动画
        this.player.animationFrame += deltaTime * 0.01;

        // 人物固定在最左边，不需要移动和朝向逻辑
        // 保持固定朝向右边
        this.player.direction = 1;

        // 生命恢复（使用实际回复速度）
        const actualMaxHp = this.getActualMaxHp();
        if (this.player.hp < actualMaxHp) {
            this.player.hp = Math.min(actualMaxHp,
                this.player.hp + this.getActualRegen() * (deltaTime / 1000));
        }
    }

    /**
     * 渲染玩家
     */
    render(ctx) {
        const mapSize = this.gameCore.getMapSize();
        const groundY = mapSize.height - 50;
        const playerY = groundY - this.player.height;

        // 玩家身体 - 添加奔跑动画效果
        const bobOffset = Math.sin(this.player.animationFrame) * 2; // 上下摆动

        // 绘制角色图片
        if (this.playerImageLoaded && this.playerImage.complete && this.playerImage.naturalWidth > 0) {
            // 计算图片缩放比例，保持宽高比
            const imageAspectRatio = this.playerImage.width / this.playerImage.height;
            let drawWidth = this.player.width;
            let drawHeight = this.player.height;

            if (imageAspectRatio > 1) {
                // 图片较宽，以高度为准
                drawWidth = drawHeight * imageAspectRatio;
            } else {
                // 图片较高，以宽度为准
                drawHeight = drawWidth / imageAspectRatio;
            }

            // 居中绘制图片
            const drawX = this.player.x + (this.player.width - drawWidth) / 2;
            const drawY = playerY + (this.player.height - drawHeight) / 2 + bobOffset;

            ctx.drawImage(this.playerImage, drawX, drawY, drawWidth, drawHeight);
        } else {
            // 图片未加载时显示占位符
            ctx.fillStyle = '#4a90e2';
            ctx.fillRect(this.player.x, playerY + bobOffset, this.player.width, this.player.height);

            // 绘制加载提示或错误信息
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            if (this.playerImage.src && !this.playerImageLoaded) {
                ctx.fillText('Loading...', this.player.x + this.player.width / 2, playerY + this.player.height / 2 + 4 + bobOffset);
            } else {
                ctx.fillText('Error', this.player.x + this.player.width / 2, playerY + this.player.height / 2 + 4 + bobOffset);
            }
        }

        // 绘制玩家脚部阴影（在草地上）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(this.player.x - 2, groundY - 2, this.player.width + 4, 4);

        // 全屏攻击范围指示器（屏幕边框）
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.2)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.strokeRect(2, 2, mapSize.width - 4, mapSize.height - 4);
        ctx.setLineDash([]);

        // 生命值条 - 调整到玩家头顶上方
        this.drawHealthBar(ctx, this.player.x, playerY - 15, this.player.width,
            this.player.hp, this.player.maxHp, '#ff4757', '#2ed573');
    }

    /**
     * 绘制生命值条
     */
    drawHealthBar(ctx, x, y, width, currentHp, maxHp, bgColor, fillColor) {
        const barHeight = 6;
        const hpPercent = currentHp / maxHp;

        // 背景
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, width, barHeight);

        // 生命值
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, width * hpPercent, barHeight);

        // 边框
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, barHeight);
    }

    /**
     * 升级属性
     */
    /**
     * 升级属性
     * @returns {Object} { success: boolean, reason: string }
     */
    upgradeAttribute(attribute, increase = null, silent = false) {
        // 如果没有提供 increase 参数，使用默认增量映射
        if (increase === null) {
            increase = this.attributeIncreases[attribute] || 1;
        }
        const cost = this.player.upgradeCosts[attribute];

        if (this.resourceSystem.hasEnoughCoins(cost)) {
            // 检查各种属性限制
            if (!this.canUpgrade(attribute)) {
                return { success: false, reason: 'limit_reached' };
            }

            this.resourceSystem.spendCoins(cost);

            if (attribute === 'hp') {
                this.player.maxHp += increase;
                this.player.hp += increase;
            } else if (attribute === 'multiShot') {
                this.player.multiShot = Math.min(this.player.multiShot + increase, 100);
            } else if (attribute === 'crit') {
                this.player.crit = Math.min(this.player.crit + increase, 126.2);
            } else if (attribute === 'attackSpeed') {
                this.player.attackSpeed = Math.min(this.player.attackSpeed + increase, 8.08);
            } else if (attribute === 'tripleShot') {
                this.player.tripleShot = Math.min(this.player.tripleShot + increase, 100);
            } else {
                this.player[attribute] += increase;
            }

            // 增加升级成本
            this.player.upgradeCosts[attribute] = Math.floor(cost * 1.5);

            // 触发成就事件
            if (!silent && this.achievementSystem) {
                this.achievementSystem.onEvent('upgrade', 1);
            }

            return { success: true };
        } else {
            return { success: false, reason: 'insufficient_coins' };
        }
    }

    /**
     * 检查属性是否可以升级
     */
    canUpgrade(attribute, times = 1) {
        if (attribute === 'multiShot') {
            const currentLevel = Math.floor((this.player.multiShot - 1) / 1) + 1;
            return this.player.multiShot < 100 && currentLevel < 1001;
        }
        if (attribute === 'crit') {
            const currentLevel = Math.floor((this.player.crit - 5) / 1) + 1;
            return this.player.crit < 126.2 && currentLevel < 1001;
        }
        if (attribute === 'attackSpeed') {
            const currentLevel = Math.floor((this.player.attackSpeed - 1.0) / 0.1) + 1;
            return this.player.attackSpeed < 8.08 && currentLevel < 201;
        }
        if (attribute === 'tripleShot') {
            const currentLevel = Math.floor((this.player.tripleShot - 0) / 5) + 1;
            return this.player.tripleShot < 100 && currentLevel < 1001;
        }
        return true; // 其他属性默认可升级
    }

    /**
     * 批量升级属性
     */
    /**
     * 批量升级属性
     */
    bulkUpgradeAttribute(attribute, times) {
        const inc = this.attributeIncreases[attribute];
        const { totalCost, allowedTimes } = this.getBulkUpgradeCost(attribute, times);

        if (allowedTimes !== times || !this.resourceSystem.hasEnoughCoins(totalCost)) {
            return { success: false }; // 不满足条件，不执行
        }

        for (let i = 0; i < times; i++) {
            this.upgradeAttribute(attribute, inc, true); // 静默升级
        }
        
        return { success: true };
    }

    /**
     * 计算批量升级的总成本
     */
    getBulkUpgradeCost(attribute, times) {
        let allowedTimes = 0;
        let totalCost = 0;
        let tempValue = this.player[attribute];
        let tempCost = this.player.upgradeCosts[attribute];
        const inc = this.attributeIncreases[attribute];

        for (let i = 0; i < times; i++) {
            if (!this.canUpgrade(attribute)) break;

            // 模拟属性提升，考虑上限
            if (attribute === 'hp') {
                tempValue = tempValue + inc;
            } else if (attribute === 'multiShot') {
                if (tempValue + inc > 100) break;
                tempValue = Math.min(tempValue + inc, 100);
            } else if (attribute === 'crit') {
                if (tempValue + inc > 126.2) break;
                tempValue = Math.min(tempValue + inc, 126.2);
            } else if (attribute === 'attackSpeed') {
                if (tempValue + inc > 8.08) break;
                tempValue = Math.min(tempValue + inc, 8.08);
            } else if (attribute === 'tripleShot') {
                if (tempValue + inc > 100) break;
                tempValue = Math.min(tempValue + inc, 100);
            } else {
                tempValue = tempValue + inc;
            }

            totalCost += tempCost; // 累加当前成本
            tempCost = Math.floor(tempCost * 1.5); // 下一次成本提升
            allowedTimes++;
        }

        return { totalCost, allowedTimes };
    }

    /**
     * 计算当前金币能升级的最高次数
     */
    getMaxAffordableUpgrades(attribute) {
        let maxUpgrades = 0;
        let totalCost = 0;
        let tempValue = this.player[attribute];
        let tempCost = this.player.upgradeCosts[attribute];
        const inc = this.attributeIncreases[attribute];

        // 使用一个较大的数字作为上限，避免无限循环
        const maxIterations = 10000;

        for (let i = 0; i < maxIterations; i++) {
            // 检查是否还能升级（考虑属性上限）
            if (!this.canUpgrade(attribute)) break;

            // 检查金币是否足够
            if (!this.resourceSystem.hasEnoughCoins(totalCost + tempCost)) break;

            // 模拟属性提升，考虑上限
            if (attribute === 'hp') {
                tempValue = tempValue + inc;
            } else if (attribute === 'multiShot') {
                if (tempValue + inc > 100) break;
                tempValue = Math.min(tempValue + inc, 100);
            } else if (attribute === 'crit') {
                if (tempValue + inc > 126.2) break;
                tempValue = Math.min(tempValue + inc, 126.2);
            } else if (attribute === 'attackSpeed') {
                if (tempValue + inc > 8.08) break;
                tempValue = Math.min(tempValue + inc, 8.08);
            } else if (attribute === 'tripleShot') {
                if (tempValue + inc > 100) break;
                tempValue = Math.min(tempValue + inc, 100);
            } else {
                tempValue = tempValue + inc;
            }

            totalCost += tempCost; // 累加当前成本
            tempCost = Math.floor(tempCost * 1.5); // 下一次成本提升
            maxUpgrades++;
        }

        return maxUpgrades;
    }

    /**
     * 计算总战力
     */
    /**
     * 计算总战力
     */
    calculateTotalPower() {
        // 使用实际属性（包含被动加成）
        const actualAttack = this.getActualAttack();
        const actualCritDamage = this.getActualCritDamage();
        const actualAttackSpeed = this.getActualAttackSpeed();
        const actualCrit = this.getActualCrit();
        const actualMultiShot = this.player.multiShot; // 连射暂时没有被动加成
        const actualTripleShot = this.player.tripleShot; // 三连射暂时没有被动加成

        // 基础攻击力贡献
        const attackPower = actualAttack * 10;

        // 暴击伤害贡献 (数值 * 2)
        const critDamagePower = actualCritDamage * 2;

        // 攻击速度贡献 (数值 * 50)
        const attackSpeedPower = actualAttackSpeed * 50;

        // 暴击率贡献 (数值 * 3)
        const critPower = actualCrit * 3;

        // 连射贡献
        const multiShotPower = actualMultiShot * 20;

        // 三连射贡献 (数值 * 5)
        const tripleShotPower = actualTripleShot * 5;

        // 计算总战力
        const totalPower = Math.floor(attackPower + critDamagePower + attackSpeedPower + critPower + multiShotPower + tripleShotPower);

        return totalPower;
    }

    /**
     * 更新总战力显示
     */


    /**
     * 获取玩家数据
     */
    getPlayerData() {
        return { ...this.player };
    }

    /**
     * 设置玩家数据
     */
    setPlayerData(data) {
        Object.assign(this.player, data);
    }

    /**
     * 获取存档数据
     * @returns {Object} 玩家系统的存档数据
     */
    getSaveData() {
        return {
            level: this.player.level,  // 顶层level供存档系统读取
            player: {
                x: this.player.x,
                y: this.player.y,
                level: this.player.level,
                hp: this.player.hp,
                maxHp: this.player.maxHp,
                attack: this.player.attack,
                defense: this.player.defense,
                dodge: this.player.dodge,
                hpRegen: this.player.hpRegen,
                critDamage: this.player.critDamage,
                attackSpeed: this.player.attackSpeed,
                crit: this.player.crit,
                multiShot: this.player.multiShot,
                tripleShot: this.player.tripleShot,
                // 三维属性
                strength: this.player.strength,
                agility: this.player.agility,
                intelligence: this.player.intelligence,
                upgradeCosts: { ...this.player.upgradeCosts }
            }
        };
    }

    /**
     * 加载存档数据
     * @param {Object} data 存档数据
     */
    loadSaveData(data) {
        if (data && data.player) {
            const savedPlayer = data.player;

            // 恢复玩家属性
            this.player.level = savedPlayer.level !== undefined ? savedPlayer.level : this.player.level;
            this.player.hp = savedPlayer.hp !== undefined ? savedPlayer.hp : this.player.hp;
            this.player.maxHp = savedPlayer.maxHp !== undefined ? savedPlayer.maxHp : this.player.maxHp;
            this.player.attack = savedPlayer.attack !== undefined ? savedPlayer.attack : this.player.attack;
            this.player.defense = savedPlayer.defense !== undefined ? savedPlayer.defense : this.player.defense;
            this.player.dodge = savedPlayer.dodge !== undefined ? savedPlayer.dodge : this.player.dodge;
            this.player.hpRegen = savedPlayer.hpRegen !== undefined ? savedPlayer.hpRegen : this.player.hpRegen;
            this.player.critDamage = savedPlayer.critDamage !== undefined ? savedPlayer.critDamage : this.player.critDamage;
            this.player.attackSpeed = savedPlayer.attackSpeed !== undefined ? savedPlayer.attackSpeed : this.player.attackSpeed;
            this.player.crit = savedPlayer.crit !== undefined ? savedPlayer.crit : this.player.crit;
            this.player.multiShot = savedPlayer.multiShot !== undefined ? savedPlayer.multiShot : this.player.multiShot;
            this.player.tripleShot = savedPlayer.tripleShot !== undefined ? savedPlayer.tripleShot : this.player.tripleShot;

            // 恢复三维属性
            this.player.strength = savedPlayer.strength !== undefined ? savedPlayer.strength : this.player.strength;
            this.player.agility = savedPlayer.agility !== undefined ? savedPlayer.agility : this.player.agility;
            this.player.intelligence = savedPlayer.intelligence !== undefined ? savedPlayer.intelligence : this.player.intelligence;

            // 恢复升级成本
            if (savedPlayer.upgradeCosts) {
                this.player.upgradeCosts = { ...savedPlayer.upgradeCosts };
            }

            // 更新UI显示
            // 移除直接调用，由外部控制UI更新
            // this.updateUpgradeButtons();
            // this.updateUpgradeItems();
            // this.updateTotalPower();
            console.log('玩家系统存档数据已加载');
        }
    }
}

export default PlayerSystem;
