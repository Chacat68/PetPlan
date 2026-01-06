/**
 * TerritoryScene - 领地场景
 * 连接 UI 和 TerritorySystem，处理前端交互逻辑
 */

import { TerritorySystem, getTerritorySystemInstance } from '../modules/territory-system.js';
import { ResourceSystem, getResourceSystemInstance } from '../modules/resource-system.js';

class TerritoryScene {
    constructor() {
        // 系统引用
        this.resourceSystem = null;
        this.territorySystem = null;
        
        // 当前选中的地块
        this.selectedSlot = null;
        
        // Canvas 相关
        this.canvas = null;
        this.ctx = null;
        
        // 产出收集定时器
        this.productionTimer = null;
        
        console.log('[TerritoryScene] 初始化...');
        this.init();
    }
    
    /**
     * 初始化场景
     */
    async init() {
        try {
            // 显示加载动画
            this.showLoading(true);
            
            // 初始化系统
            await this.initSystems();
            
            // 初始化 Canvas
            this.initCanvas();
            
            // 绑定事件
            this.bindEvents();
            
            // 渲染初始状态
            this.renderSlots();
            this.updateResourceDisplay();
            this.updateExpansionProgress();
            
            // 检查离线收益
            this.checkOfflineGains();
            
            // 启动产出收集定时器
            this.startProductionTimer();
            
            // 隐藏加载动画
            this.showLoading(false);
            
            console.log('[TerritoryScene] ✅ 初始化完成');
        } catch (error) {
            console.error('[TerritoryScene] ❌ 初始化失败:', error);
            this.showLoading(false);
        }
    }
    
    /**
     * 初始化系统引用
     */
    async initSystems() {
        // 创建资源系统（简化版，供独立页面使用）
        this.resourceSystem = {
            coins: 1000,
            crystals: 100,
            
            hasEnoughCoins(amount) { return this.coins >= amount; },
            hasEnoughCrystals(amount) { return this.crystals >= amount; },
            
            addCoins(amount) { 
                this.coins += amount; 
                this.saveToLocalStorage();
            },
            addCrystals(amount) { 
                this.crystals += amount; 
                this.saveToLocalStorage();
            },
            
            spendCoins(amount) {
                if (this.coins >= amount) {
                    this.coins -= amount;
                    this.saveToLocalStorage();
                    return true;
                }
                return false;
            },
            spendCrystals(amount) {
                if (this.crystals >= amount) {
                    this.crystals -= amount;
                    this.saveToLocalStorage();
                    return true;
                }
                return false;
            },
            
            setCoins(amount) { this.coins = amount; },
            setCrystals(amount) { this.crystals = amount; },
            
            formatNumber(num) {
                if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
                if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
                return num.toString();
            },
            
            saveToLocalStorage() {
                localStorage.setItem('petplan_territory_resources', JSON.stringify({
                    coins: this.coins,
                    crystals: this.crystals
                }));
            },
            
            loadFromLocalStorage() {
                try {
                    const data = JSON.parse(localStorage.getItem('petplan_territory_resources'));
                    if (data) {
                        this.coins = data.coins || 1000;
                        this.crystals = data.crystals || 100;
                    }
                } catch (e) {}
            }
        };
        
        // 加载资源数据
        this.resourceSystem.loadFromLocalStorage();
        
        // 创建玩家系统引用（简化版）
        const playerSystem = {
            player: { level: 1 }
        };
        
        // 尝试从 localStorage 读取玩家等级
        try {
            const saveData = JSON.parse(localStorage.getItem('petplan_save_1'));
            if (saveData?.data?.player?.player?.level) {
                playerSystem.player.level = saveData.data.player.player.level;
            }
        } catch (e) {}
        
        // 创建领地系统
        this.territorySystem = new TerritorySystem(this.resourceSystem, playerSystem);
        this.territorySystem.loadFromLocalStorage();
    }
    
    /**
     * 初始化 Canvas（绘制背景动画）
     */
    initCanvas() {
        this.canvas = document.getElementById('territory-canvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        // 设置 Canvas 尺寸
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 开始动画循环
        this.animate();
    }
    
    /**
     * 调整 Canvas 尺寸
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    
    /**
     * 动画循环 - 绘制背景场景
     */
    animate() {
        if (!this.ctx) return;
        
        const { width, height } = this.canvas;
        
        // 清空画布
        this.ctx.clearRect(0, 0, width, height);
        
        // 绘制天空渐变
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, height * 0.6);
        skyGradient.addColorStop(0, '#87CEEB');
        skyGradient.addColorStop(1, '#98D8E8');
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, width, height * 0.6);
        
        // 绘制地面渐变
        const groundGradient = this.ctx.createLinearGradient(0, height * 0.5, 0, height);
        groundGradient.addColorStop(0, '#90EE90');
        groundGradient.addColorStop(1, '#228B22');
        this.ctx.fillStyle = groundGradient;
        this.ctx.fillRect(0, height * 0.5, width, height * 0.5);
        
        // 绘制简单的云朵
        this.drawClouds();
        
        // 继续动画循环
        requestAnimationFrame(() => this.animate());
    }
    
    /**
     * 绘制云朵
     */
    drawClouds() {
        const time = Date.now() * 0.0001;
        const { width } = this.canvas;
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        // 绘制几朵移动的云
        for (let i = 0; i < 3; i++) {
            const x = ((time * (50 + i * 20) + i * 200) % (width + 100)) - 50;
            const y = 30 + i * 40;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 25, 0, Math.PI * 2);
            this.ctx.arc(x + 25, y - 10, 20, 0, Math.PI * 2);
            this.ctx.arc(x + 50, y, 25, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 地块点击事件
        document.querySelectorAll('.territory-slot').forEach(slot => {
            slot.addEventListener('click', (e) => this.handleSlotClick(e));
        });
        
        // 建筑列表弹窗关闭
        const closeBuildingList = document.getElementById('close-building-list');
        if (closeBuildingList) {
            closeBuildingList.addEventListener('click', () => this.closeBuildingListModal());
        }
        
        // 建筑信息弹窗关闭
        const closeBuildingInfo = document.getElementById('close-building-info');
        if (closeBuildingInfo) {
            closeBuildingInfo.addEventListener('click', () => this.closeBuildingInfoModal());
        }
        
        // 扩张按钮
        const expandBtn = document.getElementById('expand-territory-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.openExpansionModal());
        }
        
        // 扩张弹窗关闭
        const closeExpansion = document.getElementById('close-expansion-modal');
        if (closeExpansion) {
            closeExpansion.addEventListener('click', () => this.closeExpansionModal());
        }
        
        // 确认扩张按钮
        const confirmExpansion = document.getElementById('confirm-expansion-btn');
        if (confirmExpansion) {
            confirmExpansion.addEventListener('click', () => this.handleExpand());
        }
        
        // 离线收益领取按钮
        const claimOffline = document.getElementById('claim-offline-btn');
        if (claimOffline) {
            claimOffline.addEventListener('click', () => this.claimOfflineGains());
        }
        
        // 导航按钮
        const characterBtn = document.getElementById('character-button');
        if (characterBtn) {
            characterBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        
        // 弹窗背景点击关闭
        document.getElementById('building-list-modal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('building-list-modal')) {
                this.closeBuildingListModal();
            }
        });
        
        document.getElementById('building-info-modal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('building-info-modal')) {
                this.closeBuildingInfoModal();
            }
        });
    }
    
    // ==================== 地块渲染 ====================
    
    /**
     * 渲染所有地块
     */
    renderSlots() {
        const slots = document.querySelectorAll('.territory-slot');
        
        slots.forEach((slotEl, index) => {
            const state = this.territorySystem.getSlotState(index);
            const building = this.territorySystem.getBuildingAt(index);
            
            // 清除旧的状态类
            slotEl.classList.remove('is-built', 'is-unlocked', 'is-locked');
            
            const content = slotEl.querySelector('.slot-content');
            if (!content) return;
            
            // 根据状态渲染内容
            if (state === 'locked') {
                slotEl.classList.add('is-locked');
                const unlockLevel = this.territorySystem.slots[index]?.unlockLevel || 0;
                content.className = 'slot-content locked';
                content.innerHTML = `
                    <div class="unlock-condition">
                        <div class="lock-icon">🔒</div>
                        <div class="lock-text">等级 ${unlockLevel} 解锁</div>
                    </div>
                `;
            } else if (state === 'empty') {
                slotEl.classList.add('is-unlocked');
                content.className = 'slot-content unlocked';
                content.innerHTML = `
                    <div class="empty-slot-hint">
                        <div class="plus-icon">+</div>
                        <div class="hint-text">建造</div>
                    </div>
                `;
            } else if (state === 'built' && building) {
                slotEl.classList.add('is-built');
                const data = this.territorySystem.buildingData[building.type];
                content.className = 'slot-content built';
                content.innerHTML = `
                    <div style="font-size: 36px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
                        ${data.icon}
                    </div>
                    <div class="building-info-overlay">
                        <span class="building-name">${data.name}</span>
                        <span class="building-level-badge">Lv.${building.level}</span>
                    </div>
                `;
            }
        });
    }
    
    // ==================== 地块交互 ====================
    
    /**
     * 处理地块点击
     */
    handleSlotClick(event) {
        const slot = event.currentTarget;
        const index = parseInt(slot.dataset.slot);
        const state = this.territorySystem.getSlotState(index);
        
        this.selectedSlot = index;
        
        if (state === 'locked') {
            // 显示解锁提示
            const unlockLevel = this.territorySystem.slots[index]?.unlockLevel || 0;
            this.showToast(`需要达到等级 ${unlockLevel} 才能解锁此地块`);
        } else if (state === 'empty') {
            // 打开建筑选择弹窗
            this.openBuildingListModal();
        } else if (state === 'built') {
            // 打开建筑信息弹窗
            this.openBuildingInfoModal(index);
        }
    }
    
    // ==================== 建筑列表弹窗 ====================
    
    /**
     * 打开建筑选择弹窗
     */
    openBuildingListModal() {
        const modal = document.getElementById('building-list-modal');
        const optionsContainer = document.getElementById('building-options');
        
        if (!modal || !optionsContainer) return;
        
        // 生成建筑选项
        optionsContainer.innerHTML = '';
        
        for (const [type, data] of Object.entries(this.territorySystem.buildingData)) {
            // 检查是否可以建造
            const canBuild = this.territorySystem.canBuild(type, this.selectedSlot);
            const cost = this.territorySystem.calculateBuildCost(type);
            
            // 主基地只能建造一个
            const isMainBaseBuilt = type === 'main_base' && 
                this.territorySystem.buildings.some(b => b.type === 'main_base');
            
            const option = document.createElement('button');
            option.className = 'building-option';
            option.disabled = !canBuild.success || isMainBaseBuilt;
            
            option.innerHTML = `
                <div class="building-option-icon" style="font-size: 48px;">${data.icon}</div>
                <div class="building-option-name">${data.name}</div>
                <div class="building-option-cost">
                    ${cost.coins > 0 ? `💰${this.resourceSystem.formatNumber(cost.coins)}` : ''}
                    ${cost.crystals > 0 ? ` 💎${this.resourceSystem.formatNumber(cost.crystals)}` : ''}
                    ${cost.coins === 0 && cost.crystals === 0 ? '免费' : ''}
                </div>
                <div class="building-option-description">${data.description}</div>
            `;
            
            option.addEventListener('click', () => this.handleBuild(type));
            optionsContainer.appendChild(option);
        }
        
        // 显示弹窗
        modal.classList.add('show');
    }
    
    /**
     * 关闭建筑选择弹窗
     */
    closeBuildingListModal() {
        const modal = document.getElementById('building-list-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * 处理建造
     */
    handleBuild(buildingType) {
        const result = this.territorySystem.buildBuilding(buildingType, this.selectedSlot);
        
        if (result.success) {
            this.showToast(`✅ 建造成功: ${this.territorySystem.buildingData[buildingType].name}`);
            this.renderSlots();
            this.updateResourceDisplay();
            this.closeBuildingListModal();
        } else {
            this.showToast(`❌ ${result.reason}`);
        }
    }
    
    // ==================== 建筑信息弹窗 ====================
    
    /**
     * 打开建筑信息弹窗
     */
    openBuildingInfoModal(slotIndex) {
        const modal = document.getElementById('building-info-modal');
        const titleEl = document.getElementById('building-info-title');
        const contentEl = document.getElementById('building-info-content');
        
        if (!modal || !contentEl) return;
        
        const building = this.territorySystem.getBuildingAt(slotIndex);
        if (!building) return;
        
        const data = this.territorySystem.buildingData[building.type];
        const canUpgrade = this.territorySystem.canUpgrade(slotIndex);
        const upgradeCost = this.territorySystem.calculateUpgradeCost(building.type, building.level);
        
        if (titleEl) {
            titleEl.textContent = `${data.icon} ${data.name}`;
        }
        
        // 生成效果描述
        let effectText = '';
        if (data.effects) {
            switch (data.effects.type) {
                case 'attackBonus':
                    effectText = `攻击力 +${data.effects.value * building.level}`;
                    break;
                case 'defenseBonus':
                    effectText = `防御力 +${data.effects.value * building.level}`;
                    break;
                case 'combatBonus':
                    effectText = `攻击 +${data.effects.attack * building.level}, 防御 +${data.effects.defense * building.level}`;
                    break;
                case 'production':
                    const amount = data.effects.value * building.level;
                    const resource = data.effects.resource === 'coins' ? '💰金币' : '💎水晶';
                    effectText = `每${data.productionInterval / 1000}秒产出 ${amount} ${resource}`;
                    break;
                case 'expBonus':
                    effectText = `经验获取 +${data.effects.value * building.level}%`;
                    break;
            }
        }
        
        contentEl.innerHTML = `
            <div class="building-info-header">
                <div class="building-info-icon" style="font-size: 60px;">${data.icon}</div>
                <div class="building-info-details">
                    <h4>${data.name}</h4>
                    <p>${data.description}</p>
                </div>
            </div>
            
            <div class="building-info-stats">
                <div class="stat-item">
                    <span class="stat-label">当前等级</span>
                    <span class="stat-value">Lv.${building.level} / ${data.maxLevel}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">当前效果</span>
                    <span class="stat-value">${effectText || '无'}</span>
                </div>
            </div>
            
            ${building.level < data.maxLevel ? `
                <div class="upgrade-cost-section">
                    <div class="upgrade-cost-title">升级至 Lv.${building.level + 1} 所需:</div>
                    <div class="upgrade-cost-items">
                        <div class="cost-item ${!this.resourceSystem.hasEnoughCoins(upgradeCost.coins) ? 'insufficient' : ''}">
                            <span class="cost-label">💰 金币</span>
                            <span class="cost-value">${this.resourceSystem.formatNumber(upgradeCost.coins)}</span>
                            <span class="cost-current">拥有: ${this.resourceSystem.formatNumber(this.resourceSystem.coins)}</span>
                        </div>
                        <div class="cost-item ${!this.resourceSystem.hasEnoughCrystals(upgradeCost.crystals) ? 'insufficient' : ''}">
                            <span class="cost-label">💎 水晶</span>
                            <span class="cost-value">${this.resourceSystem.formatNumber(upgradeCost.crystals)}</span>
                            <span class="cost-current">拥有: ${this.resourceSystem.formatNumber(this.resourceSystem.crystals)}</span>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div class="building-actions">
                <button class="action-btn upgrade-btn" 
                        ${!canUpgrade.success ? 'disabled' : ''}
                        data-slot="${slotIndex}">
                    ${building.level >= data.maxLevel ? '已满级' : '升级'}
                </button>
                ${building.type !== 'main_base' ? `
                    <button class="action-btn demolish-btn" data-slot="${slotIndex}">
                        拆除
                    </button>
                ` : ''}
            </div>
        `;
        
        // 绑定按钮事件
        const upgradeBtn = contentEl.querySelector('.upgrade-btn');
        if (upgradeBtn && !upgradeBtn.disabled) {
            upgradeBtn.addEventListener('click', () => this.handleUpgrade(slotIndex));
        }
        
        const demolishBtn = contentEl.querySelector('.demolish-btn');
        if (demolishBtn) {
            demolishBtn.addEventListener('click', () => this.handleDemolish(slotIndex));
        }
        
        // 显示弹窗
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
    
    /**
     * 关闭建筑信息弹窗
     */
    closeBuildingInfoModal() {
        const modal = document.getElementById('building-info-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }
    
    /**
     * 处理升级
     */
    handleUpgrade(slotIndex) {
        const result = this.territorySystem.upgradeBuilding(slotIndex);
        
        if (result.success) {
            const data = this.territorySystem.buildingData[result.building.type];
            this.showToast(`✅ ${data.name} 升级至 Lv.${result.building.level}`);
            this.renderSlots();
            this.updateResourceDisplay();
            this.closeBuildingInfoModal();
        } else {
            this.showToast(`❌ ${result.reason}`);
        }
    }
    
    /**
     * 处理拆除
     */
    handleDemolish(slotIndex) {
        if (!confirm('确定要拆除这个建筑吗？将返还50%的建造成本。')) {
            return;
        }
        
        const result = this.territorySystem.demolishBuilding(slotIndex);
        
        if (result.success) {
            this.showToast(`✅ 拆除成功，返还 💰${result.refund.coins} 💎${result.refund.crystals}`);
            this.renderSlots();
            this.updateResourceDisplay();
            this.closeBuildingInfoModal();
        } else {
            this.showToast(`❌ ${result.reason}`);
        }
    }
    
    // ==================== 扩张弹窗 ====================
    
    /**
     * 打开扩张弹窗
     */
    openExpansionModal() {
        const modal = document.getElementById('expansion-modal');
        const contentEl = document.getElementById('expansion-content');
        const confirmBtn = document.getElementById('confirm-expansion-btn');
        
        if (!modal || !contentEl) return;
        
        const canExpand = this.territorySystem.canExpand();
        const cost = this.territorySystem.getNextExpansionCost();
        
        if (!cost) {
            contentEl.innerHTML = `
                <div class="expansion-complete">
                    <span class="complete-icon">🎉</span>
                    <span>领地已完全扩张！</span>
                </div>
            `;
            if (confirmBtn) confirmBtn.disabled = true;
        } else {
            contentEl.innerHTML = `
                <div class="expansion-info">
                    <div class="expansion-icon">🏗️</div>
                    <div class="expansion-status">
                        <h4>扩张第 ${this.territorySystem.expansionCount + 1} 次</h4>
                        <p>当前地块: ${this.territorySystem.unlockedSlots} / ${this.territorySystem.slotConfig.maxSlots}</p>
                    </div>
                </div>
                
                <div class="expansion-preview">
                    <h5>扩张后获得:</h5>
                    <div class="new-slots-preview">
                        <div class="new-slot-item">
                            <span class="slot-icon">🏠</span>
                            <span>+2 个新地块</span>
                        </div>
                    </div>
                </div>
                
                <div class="expansion-cost">
                    <h5>扩张成本:</h5>
                    <div class="cost-items">
                        <div class="cost-item ${!this.resourceSystem.hasEnoughCoins(cost.coins) ? 'insufficient' : ''}">
                            <span class="cost-icon">💰</span>
                            <span class="cost-value">${this.resourceSystem.formatNumber(cost.coins)}</span>
                            <span class="cost-current">拥有: ${this.resourceSystem.formatNumber(this.resourceSystem.coins)}</span>
                        </div>
                        <div class="cost-item ${!this.resourceSystem.hasEnoughCrystals(cost.crystals) ? 'insufficient' : ''}">
                            <span class="cost-icon">💎</span>
                            <span class="cost-value">${this.resourceSystem.formatNumber(cost.crystals)}</span>
                            <span class="cost-current">拥有: ${this.resourceSystem.formatNumber(this.resourceSystem.crystals)}</span>
                        </div>
                    </div>
                </div>
                
                ${!canExpand.success ? `
                    <div class="expansion-warning">
                        <span class="warning-icon">⚠️</span>
                        <span>${canExpand.reason}</span>
                    </div>
                ` : ''}
            `;
            
            if (confirmBtn) {
                confirmBtn.disabled = !canExpand.success;
            }
        }
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
    
    /**
     * 关闭扩张弹窗
     */
    closeExpansionModal() {
        const modal = document.getElementById('expansion-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }
    
    /**
     * 处理扩张
     */
    handleExpand() {
        const result = this.territorySystem.expandTerritory();
        
        if (result.success) {
            this.showToast(`✅ 领地扩张成功！当前地块: ${result.unlockedSlots}`);
            this.renderSlots();
            this.updateResourceDisplay();
            this.updateExpansionProgress();
            this.closeExpansionModal();
        } else {
            this.showToast(`❌ ${result.reason}`);
        }
    }
    
    // ==================== 资源显示更新 ====================
    
    /**
     * 更新资源显示
     */
    updateResourceDisplay() {
        const goldEl = document.getElementById('territory-gold');
        const crystalEl = document.getElementById('territory-crystal');
        
        if (goldEl) {
            goldEl.textContent = this.resourceSystem.formatNumber(this.resourceSystem.coins);
        }
        if (crystalEl) {
            crystalEl.textContent = this.resourceSystem.formatNumber(this.resourceSystem.crystals);
        }
    }
    
    /**
     * 更新扩张进度显示
     */
    updateExpansionProgress() {
        const progressEl = document.getElementById('expansion-progress');
        if (progressEl) {
            progressEl.textContent = `${this.territorySystem.unlockedSlots}/${this.territorySystem.slotConfig.maxSlots}`;
        }
    }
    
    // ==================== 产出收集 ====================
    
    /**
     * 启动产出收集定时器
     */
    startProductionTimer() {
        // 每10秒收集一次资源
        this.productionTimer = setInterval(() => {
            const collected = this.territorySystem.collectResources();
            
            if (collected.coins > 0 || collected.crystals > 0) {
                this.updateResourceDisplay();
                this.showFloatingText(collected);
            }
        }, 10000);
    }
    
    /**
     * 显示浮动文字效果
     */
    showFloatingText(collected) {
        if (collected.coins > 0) {
            this.createFloatingText(`+${collected.coins} 💰`, 'coins');
        }
        if (collected.crystals > 0) {
            this.createFloatingText(`+${collected.crystals} 💎`, 'crystal');
        }
    }
    
    /**
     * 创建浮动文字元素
     */
    createFloatingText(text, type) {
        const el = document.createElement('div');
        el.className = `floating-text ${type}`;
        el.textContent = text;
        el.style.left = `${50 + Math.random() * 100}px`;
        el.style.top = `${100 + Math.random() * 50}px`;
        
        document.querySelector('.territory-scene-container')?.appendChild(el);
        
        // 1.5秒后移除
        setTimeout(() => el.remove(), 1500);
    }
    
    // ==================== 离线收益 ====================
    
    /**
     * 检查离线收益
     */
    checkOfflineGains() {
        const lastTimeStr = localStorage.getItem('petplan_territory_last_visit');
        const now = Date.now();
        
        if (lastTimeStr) {
            const lastTime = parseInt(lastTimeStr);
            const offlineDuration = now - lastTime;
            
            // 超过1分钟才显示离线收益
            if (offlineDuration > 60000) {
                const gains = this.territorySystem.calculateOfflineGains(offlineDuration);
                
                if (gains.coins > 0 || gains.crystals > 0) {
                    this.pendingOfflineGains = gains;
                    this.offlineDuration = offlineDuration;
                    this.showOfflineGainsModal();
                }
            }
        }
        
        // 更新最后访问时间
        localStorage.setItem('petplan_territory_last_visit', now.toString());
    }
    
    /**
     * 显示离线收益弹窗
     */
    showOfflineGainsModal() {
        const modal = document.getElementById('offline-gains-modal');
        const timeText = document.getElementById('offline-time-text');
        const goldValue = document.getElementById('offline-gold-value');
        const crystalValue = document.getElementById('offline-crystal-value');
        
        if (!modal) return;
        
        // 格式化离线时长
        const hours = Math.floor(this.offlineDuration / 3600000);
        const minutes = Math.floor((this.offlineDuration % 3600000) / 60000);
        
        if (timeText) {
            timeText.textContent = `离线时长: ${hours}小时${minutes}分钟`;
        }
        
        if (goldValue) {
            goldValue.textContent = this.resourceSystem.formatNumber(this.pendingOfflineGains.coins);
        }
        
        if (crystalValue) {
            crystalValue.textContent = this.resourceSystem.formatNumber(this.pendingOfflineGains.crystals);
        }
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
    
    /**
     * 领取离线收益
     */
    claimOfflineGains() {
        if (this.pendingOfflineGains) {
            this.resourceSystem.addCoins(this.pendingOfflineGains.coins);
            this.resourceSystem.addCrystals(this.pendingOfflineGains.crystals);
            this.updateResourceDisplay();
            
            this.showToast(`✅ 领取成功！💰${this.pendingOfflineGains.coins} 💎${this.pendingOfflineGains.crystals}`);
            
            this.pendingOfflineGains = null;
        }
        
        const modal = document.getElementById('offline-gains-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }
    
    // ==================== 工具方法 ====================
    
    /**
     * 显示加载动画
     */
    showLoading(show) {
        const loading = document.getElementById('gameLoadingScreen');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * 显示提示信息
     */
    showToast(message) {
        // 创建 toast 元素
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            z-index: 9999;
            animation: fadeInOut 2s ease-in-out forwards;
        `;
        toast.textContent = message;
        
        // 添加动画样式
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // 2秒后移除
        setTimeout(() => toast.remove(), 2000);
    }
}

// 页面加载时初始化场景
document.addEventListener('DOMContentLoaded', () => {
    window.territoryScene = new TerritoryScene();
});
