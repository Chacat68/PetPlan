/**
 * 玩家系统模块
 * 负责管理玩家角色数据、升级系统、动画效果等
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
        
        // 延迟绑定升级按钮事件，确保DOM完全加载
        setTimeout(() => {
            this.bindUpgradeEvents();
            console.log('玩家系统初始化完成');
        }, 200);
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
     * 获取实际攻击力（包含三维属性加成）
     */
    getActualAttack() {
        const derived = this.calculateDerivedStats();
        return Math.floor(this.player.attack + derived.attackBonus);
    }
    
    /**
     * 获取实际最大生命值（包含三维属性加成）
     */
    getActualMaxHp() {
        const derived = this.calculateDerivedStats();
        return Math.floor(this.player.maxHp + derived.maxHpBonus);
    }
    
    /**
     * 获取实际攻速（包含三维属性加成）
     */
    getActualAttackSpeed() {
        const derived = this.calculateDerivedStats();
        return Math.max(0.1, this.player.attackSpeed + derived.attackSpeedBonus);
    }
    
    /**
     * 获取实际暴击率（包含三维属性加成）
     */
    getActualCrit() {
        const derived = this.calculateDerivedStats();
        return Math.min(100, this.player.crit + derived.critBonus);
    }
    
    /**
     * 获取实际暴击伤害（包含三维属性加成）
     */
    getActualCritDamage() {
        const derived = this.calculateDerivedStats();
        return Math.floor(this.player.critDamage + derived.critDamageBonus);
    }
    
    /**
     * 获取实际生命回复（包含三维属性加成）
     */
    getActualRegen() {
        const derived = this.calculateDerivedStats();
        return this.player.hpRegen + derived.regenBonus;
    }
    
    /**
     * 获取实际闪避率（包含三维属性加成）
     */
    getActualDodge() {
        const derived = this.calculateDerivedStats();
        return Math.min(75, this.player.dodge + derived.dodgeBonus);
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
                ctx.fillText('Loading...', this.player.x + this.player.width/2, playerY + this.player.height/2 + 4 + bobOffset);
            } else {
                ctx.fillText('Error', this.player.x + this.player.width/2, playerY + this.player.height/2 + 4 + bobOffset);
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
    upgradeAttribute(attribute, increase, silent = false) {
        const cost = this.player.upgradeCosts[attribute];
        const button = document.getElementById(`upgrade${attribute.charAt(0).toUpperCase() + attribute.slice(1)}`);
        
        if (this.resourceSystem.hasEnoughCoins(cost)) {
            // 检查各种属性限制
            if (!this.canUpgrade(attribute)) {
                return;
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
            
            // 添加升级成功动画（批量升级时静默）
            if (!silent && button) {
                this.showUpgradeSuccess(button, attribute);
            }
            
            // 单次升级时立即刷新按钮状态
            if (!silent) {
                this.updateUpgradeButtons();
            }
        } else {
            // 金币不足时的反馈（批量升级时静默）
            if (!silent && button) {
                this.showInsufficientCoins(button);
            }
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
    bulkUpgradeAttribute(attribute, times) {
        const inc = this.attributeIncreases[attribute];
        const { totalCost, allowedTimes } = this.getBulkUpgradeCost(attribute, times);
        
        if (allowedTimes !== times || !this.resourceSystem.hasEnoughCoins(totalCost)) {
            return; // 不满足条件，不执行
        }
        
        for (let i = 0; i < times; i++) {
            this.upgradeAttribute(attribute, inc, true); // 静默升级
        }
        
        // 统一刷新
        this.updateUpgradeButtons();
        this.updateUpgradeItems();
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
    calculateTotalPower() {
        // 基础攻击力贡献
        const attackPower = this.player.attack * 10;
        
        // 暴击伤害贡献 (百分比转换为数值)
        const critDamagePower = this.player.critDamage * 2;
        
        // 攻击速度贡献
        const attackSpeedPower = this.player.attackSpeed * 50;
        
        // 暴击率贡献 (百分比转换为数值)
        const critPower = this.player.crit * 3;
        
        // 连射贡献
        const multiShotPower = this.player.multiShot * 20;
        
        // 三连射贡献 (百分比转换为数值)
        const tripleShotPower = this.player.tripleShot * 5;
        
        // 计算总战力
        const totalPower = Math.floor(attackPower + critDamagePower + attackSpeedPower + critPower + multiShotPower + tripleShotPower);
        
        return totalPower;
    }
    
    /**
     * 更新总战力显示
     */
    updateTotalPower() {
        const totalPower = this.calculateTotalPower();
        const totalPowerElement = document.getElementById('totalPower');
        if (totalPowerElement) {
            totalPowerElement.textContent = this.resourceSystem.formatNumber(totalPower);
        }
    }
    
    /**
     * 更新升级按钮状态
     */
    updateUpgradeButtons() {
        const buttons = {
            'upgradeAttack': { cost: this.player.upgradeCosts.attack, attribute: 'attack' },
            'upgradeHp': { cost: this.player.upgradeCosts.hp, attribute: 'hp' },
            'upgradeHpRegen': { cost: this.player.upgradeCosts.hpRegen, attribute: 'hpRegen' },
            'upgradeCritDamage': { cost: this.player.upgradeCosts.critDamage, attribute: 'critDamage' },
            'upgradeAttackSpeed': { cost: this.player.upgradeCosts.attackSpeed, attribute: 'attackSpeed' },
            'upgradeCrit': { cost: this.player.upgradeCosts.crit, attribute: 'crit' },
            'upgradeMultiShot': { cost: this.player.upgradeCosts.multiShot, attribute: 'multiShot' },
            'upgradeTripleShot': { cost: this.player.upgradeCosts.tripleShot, attribute: 'tripleShot' }
        };
        
        for (const [id, { cost, attribute }] of Object.entries(buttons)) {
            const button = document.getElementById(id);
            const btnCost = button?.querySelector('.btn-cost');
            const btnText = button?.querySelector('.btn-text');
            
            if (!button) continue;
            
            // 计算当前金币能升级的最高等级数量
            const maxAffordable = this.getMaxAffordableUpgrades(attribute);
            
            // 特殊处理各种按钮状态
            if (id === 'upgradeMultiShot') {
                const currentLevel = Math.floor((this.player.multiShot - 1) / 1) + 1;
                const isMaxValue = this.player.multiShot >= 100;
                const isMaxLevel = currentLevel >= 1001;
                
                if (isMaxValue || isMaxLevel) {
                    button.disabled = true;
                    if (btnCost) {
                        btnCost.textContent = isMaxValue ? '已满' : '已满级';
                    }
                    if (btnText) {
                        btnText.textContent = '强化';
                    }
                } else {
                    button.disabled = !this.resourceSystem.hasEnoughCoins(cost);
                    if (btnCost) {
                        btnCost.textContent = `💰 ${this.resourceSystem.formatNumber(cost)}`;
                    }
                    if (btnText) {
                        btnText.textContent = maxAffordable > 0 ? `强化 +${maxAffordable}` : '强化';
                    }
                }
            } else {
                if (btnCost) {
                    btnCost.textContent = `💰 ${this.resourceSystem.formatNumber(cost)}`;
                }
                if (btnText) {
                    btnText.textContent = maxAffordable > 0 ? `强化 +${maxAffordable}` : '强化';
                }
                button.disabled = !this.resourceSystem.hasEnoughCoins(cost);
            }
        }
    }
    
    /**
     * 更新升级项目显示
     */
    updateUpgradeItems() {
        // 更新攻击力
        const attackLevel = document.querySelector('#upgradeAttack')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const attackValue = document.querySelector('#upgradeAttack')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentAttackLevel = Math.floor((this.player.attack - 20) / 5) + 1;
        if (attackLevel) attackLevel.textContent = `Lv.${currentAttackLevel}`;
        if (attackValue) attackValue.textContent = this.resourceSystem.formatNumber(this.player.attack);
        
        // 更新生命
        const hpLevel = document.querySelector('#upgradeHp')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const hpValue = document.querySelector('#upgradeHp')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentHpLevel = Math.floor((this.player.maxHp - 100) / 10) + 1;
        if (hpLevel) hpLevel.textContent = `Lv.${currentHpLevel}`;
        if (hpValue) hpValue.textContent = this.resourceSystem.formatNumber(this.player.maxHp);
        
        // 更新其他属性...
        this.updateTotalPower();
    }
    
    /**
     * 绑定升级事件
     */
    bindUpgradeEvents() {
        // 升级按钮事件 - 支持长按
        this.bindUpgradeButton('upgradeAttack', 'attack', 5);
        this.bindUpgradeButton('upgradeHp', 'hp', 20);
        this.bindUpgradeButton('upgradeHpRegen', 'hpRegen', 1);
        this.bindUpgradeButton('upgradeCritDamage', 'critDamage', 10);
        this.bindUpgradeButton('upgradeAttackSpeed', 'attackSpeed', 0.1);
        this.bindUpgradeButton('upgradeCrit', 'crit', 1);
        this.bindUpgradeButton('upgradeMultiShot', 'multiShot', 1);
        this.bindUpgradeButton('upgradeTripleShot', 'tripleShot', 5);
        
        // 绑定长按升级菜单功能
        this.bindLongPressUpgradeMenu();
    }
    
    /**
     * 绑定升级按钮的长按功能
     */
    bindUpgradeButton(buttonId, attribute, increase) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        let longPressTimer = null;
        let isLongPressing = false;
        let repeatTimer = null;
        
        // 开始长按
        const startLongPress = () => {
            // 先执行一次升级
            this.upgradeAttribute(attribute, increase);
            
            // 设置长按定时器
            longPressTimer = setTimeout(() => {
                isLongPressing = true;
                // 开始重复升级
                repeatTimer = setInterval(() => {
                    this.upgradeAttribute(attribute, increase);
                }, 150); // 每150ms升级一次
            }, 500); // 长按500ms后开始重复
        };
        
        // 停止长按
        const stopLongPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            if (repeatTimer) {
                clearInterval(repeatTimer);
                repeatTimer = null;
            }
            isLongPressing = false;
        };
        
        // 鼠标事件
        button.addEventListener('mousedown', startLongPress);
        button.addEventListener('mouseup', stopLongPress);
        button.addEventListener('mouseleave', stopLongPress);
        
        // 触摸事件
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startLongPress();
        });
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopLongPress();
        });
        button.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            stopLongPress();
        });
        
        // 防止右键菜单
        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    /**
     * 绑定长按升级菜单功能
     */
    bindLongPressUpgradeMenu() {
        const upgradeButtons = [
            { id: 'upgradeAttack', attribute: 'attack' },
            { id: 'upgradeHp', attribute: 'hp' },
            { id: 'upgradeHpRegen', attribute: 'hpRegen' },
            { id: 'upgradeCritDamage', attribute: 'critDamage' },
            { id: 'upgradeAttackSpeed', attribute: 'attackSpeed' },
            { id: 'upgradeCrit', attribute: 'crit' },
            { id: 'upgradeMultiShot', attribute: 'multiShot' },
            { id: 'upgradeTripleShot', attribute: 'tripleShot' }
        ];

        upgradeButtons.forEach(({ id, attribute }) => {
            const button = document.getElementById(id);
            if (button) {
                let longPressTimer = null;
                let isLongPress = false;

                // 鼠标/触摸开始事件
                const startLongPress = (e) => {
                    e.preventDefault();
                    isLongPress = false;
                    longPressTimer = setTimeout(() => {
                        isLongPress = true;
                        this.showUpgradeMenu(button, attribute, e);
                    }, 500); // 长按500毫秒触发
                };

                // 鼠标/触摸结束事件
                const endLongPress = (e) => {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    
                    // 如果不是长按，执行升级操作
                    if (!isLongPress) {
                        const maxAffordable = this.getMaxAffordableUpgrades(attribute);
                        
                        if (maxAffordable > 1) {
                            this.bulkUpgradeAttribute(attribute, maxAffordable);
                        } else if (maxAffordable === 1) {
                            this.upgradeAttribute(attribute);
                        }
                    }
                    isLongPress = false;
                };

                // 绑定事件
                button.addEventListener('mousedown', startLongPress);
                button.addEventListener('mouseup', endLongPress);
                button.addEventListener('mouseleave', endLongPress);
                button.addEventListener('touchstart', startLongPress);
                button.addEventListener('touchend', endLongPress);
                button.addEventListener('touchcancel', endLongPress);
            }
        });

        // 绑定子菜单按钮事件
        this.bindUpgradeMenuButtons();
    }
    
    /**
     * 显示升级子菜单
     */
    showUpgradeMenu(button, attribute, event) {
        const menu = document.getElementById('upgradeMenu');
        if (!menu) return;

        // 计算菜单位置
        const rect = button.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 5}px`;

        // 更新菜单按钮状态
        this.updateUpgradeMenuButtons(attribute);

        // 显示菜单
        menu.style.display = 'block';
        menu.dataset.currentAttribute = attribute;

        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.hideUpgradeMenu.bind(this), { once: true });
        }, 100);
    }
    
    /**
     * 隐藏升级子菜单
     */
    hideUpgradeMenu() {
        const menu = document.getElementById('upgradeMenu');
        if (menu) {
            menu.style.display = 'none';
            delete menu.dataset.currentAttribute;
        }
    }
    
    /**
     * 绑定子菜单按钮事件
     */
    bindUpgradeMenuButtons() {
        const menuButtons = document.querySelectorAll('.upgrade-menu-btn');
        menuButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const times = parseInt(btn.dataset.times);
                const menu = document.getElementById('upgradeMenu');
                const attribute = menu.dataset.currentAttribute;
                
                if (attribute && times) {
                    if (times === 1) {
                        this.upgradeAttribute(attribute);
                    } else {
                        this.bulkUpgradeAttribute(attribute, times);
                    }
                }
                
                this.hideUpgradeMenu();
            });
        });
    }
    
    /**
     * 更新子菜单按钮状态
     */
    updateUpgradeMenuButtons(attribute) {
        const menuButtons = document.querySelectorAll('.upgrade-menu-btn');
        menuButtons.forEach(btn => {
            const times = parseInt(btn.dataset.times);
            const canUpgrade = this.canUpgrade(attribute, times);
            const { totalCost, allowedTimes } = this.getBulkUpgradeCost(attribute, times);
            
            btn.disabled = !canUpgrade || allowedTimes === 0;
            
            if (times === 1) {
                btn.textContent = '+1';
            } else {
                btn.textContent = `+${Math.min(times, allowedTimes)}`;
            }
        });
    }
    
    /**
     * 显示升级成功动画
     */
    showUpgradeSuccess(button, attribute) {
        // 添加成功动画
        button.style.animation = 'pulse 0.6s ease';
        
        // 创建成功提示
        const successText = document.createElement('div');
        successText.textContent = '升级成功!';
        successText.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: all 0.3s ease;
        `;
        
        const rect = button.getBoundingClientRect();
        successText.style.left = rect.left + 'px';
        successText.style.top = rect.top - 30 + 'px';
        
        document.body.appendChild(successText);
        
        // 显示动画
        setTimeout(() => {
            successText.style.opacity = '1';
            successText.style.transform = 'translateY(-10px)';
        }, 10);
        
        // 移除动画
        setTimeout(() => {
            successText.style.opacity = '0';
            successText.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (successText.parentNode) {
                    successText.parentNode.removeChild(successText);
                }
            }, 300);
        }, 1500);
        
        // 重置按钮动画
        setTimeout(() => {
            button.style.animation = '';
        }, 600);
    }
    
    /**
     * 显示金币不足动画
     */
    showInsufficientCoins(button) {
        // 添加震动动画
        button.style.animation = 'shake 0.5s ease';
        
        // 创建金币不足提示
        const errorText = document.createElement('div');
        errorText.textContent = '金币不足!';
        errorText.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: all 0.3s ease;
        `;
        
        const rect = button.getBoundingClientRect();
        errorText.style.left = rect.left + 'px';
        errorText.style.top = rect.top - 30 + 'px';
        
        document.body.appendChild(errorText);
        
        // 显示动画
        setTimeout(() => {
            errorText.style.opacity = '1';
            errorText.style.transform = 'translateY(-10px)';
        }, 10);
        
        // 移除动画
        setTimeout(() => {
            errorText.style.opacity = '0';
            errorText.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (errorText.parentNode) {
                    errorText.parentNode.removeChild(errorText);
                }
            }, 300);
        }, 1500);
        
        // 重置按钮动画
        setTimeout(() => {
            button.style.animation = '';
        }, 500);
    }
    
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
                hpRegen: this.player.hpRegen,
                critDamage: this.player.critDamage,
                attackSpeed: this.player.attackSpeed,
                crit: this.player.crit,
                multiShot: this.player.multiShot,
                tripleShot: this.player.tripleShot,
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
            this.player.hpRegen = savedPlayer.hpRegen !== undefined ? savedPlayer.hpRegen : this.player.hpRegen;
            this.player.critDamage = savedPlayer.critDamage !== undefined ? savedPlayer.critDamage : this.player.critDamage;
            this.player.attackSpeed = savedPlayer.attackSpeed !== undefined ? savedPlayer.attackSpeed : this.player.attackSpeed;
            this.player.crit = savedPlayer.crit !== undefined ? savedPlayer.crit : this.player.crit;
            this.player.multiShot = savedPlayer.multiShot !== undefined ? savedPlayer.multiShot : this.player.multiShot;
            this.player.tripleShot = savedPlayer.tripleShot !== undefined ? savedPlayer.tripleShot : this.player.tripleShot;
            
            // 恢复升级成本
            if (savedPlayer.upgradeCosts) {
                this.player.upgradeCosts = { ...savedPlayer.upgradeCosts };
            }
            
            // 更新UI显示
            this.updateUpgradeButtons();
            this.updateUpgradeItems();
            this.updateTotalPower();
            console.log('玩家系统存档数据已加载');
        }
    }
}

export default PlayerSystem;
