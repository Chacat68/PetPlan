import { getTerritorySystemInstance } from '../modules/territory-system.js';
import ResourceSystem from '../modules/resource-system.js';
import { showToast } from '../modules/ui-system.js';

class TerritoryScene {
    constructor() {
        // 使用单例模式确保资源系统和领地系统一致性
        this.resourceSystem = ResourceSystem.getInstance();
        this.territorySystem = getTerritorySystemInstance(this.resourceSystem);
        this.currentPlayerLevel = 1; // 模拟玩家等级，实际应该从玩家系统获取
        this.slots = [];
        this.currentSelectedSlot = null;
        this.buildingProgress = new Map(); // 存储建造进度（UI显示用）
        this.progressTimers = new Map(); // 存储进度更新定时器

        // Canvas动画场景相关
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.clouds = [];
        this.birds = [];
        this.trees = [];
        this.particles = [];
        this.butterflies = [];
        this.sunRays = 0;
        this.mountains = [];
        this.flowers = [];
    }

    async init() {
        // 加载资源数据
        this.resourceSystem.loadFromLocalStorage();

        // 加载领地数据（会自动检查并完成离线期间完成的建造）
        this.territorySystem.loadFromLocalStorage();

        // 显示当前资源状态
        console.log('当前资源状态:', {
            coins: this.resourceSystem.coins,
            rubies: this.resourceSystem.rubies,
            crystals: this.resourceSystem.crystals
        });

        // 如果金币不足，自动添加测试资源
        if (this.resourceSystem.coins < 10000) {
            console.log('检测到金币不足，自动添加测试资源...');
            this.resourceSystem.setCoins(50000);
            this.resourceSystem.setRubies(1000);
            this.resourceSystem.setCrystals(500);
            this.resourceSystem.saveToLocalStorage();
            console.log('测试资源已添加:', {
                coins: this.resourceSystem.coins,
                rubies: this.resourceSystem.rubies,
                crystals: this.resourceSystem.crystals
            });
        }

        await this.territorySystem.init();
        console.log('领地场景初始化完成');
        this.initCanvas(); // 初始化Canvas动画场景
        this.renderExpandedSlots(); // 渲染扩张的地块
        this.updateSlots();
        this.updateResourceDisplay();
        this.updateExpansionButton(); // 更新扩张按钮状态
        this.setupEventListeners();
        this.startBuildProgressMonitor(); // 启动建造进度监控
        this.hideLoadingScreen();
    }

    setupEventListeners() {
        // 底部导航栏事件
        this.setupBottomNavigation();

        // 地块点击事件 - 重新获取slots以确保获取最新的DOM状态
        this.slots = document.querySelectorAll('.territory-slot');
        this.slots.forEach((slot, index) => {
            slot.addEventListener('click', () => this.handleSlotClick(slot, index));
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

        // 领地扩张按钮事件
        const expandButton = document.getElementById('expand-territory-btn');
        if (expandButton) {
            expandButton.addEventListener('click', () => this.showExpansionModal());
        }

        // 扩张弹窗关闭按钮
        const closeExpansionModal = document.getElementById('close-expansion-modal');
        if (closeExpansionModal) {
            closeExpansionModal.addEventListener('click', () => this.closeExpansionModal());
        }

        // 确认扩张按钮
        const confirmExpansionBtn = document.getElementById('confirm-expansion-btn');
        if (confirmExpansionBtn) {
            confirmExpansionBtn.addEventListener('click', () => this.confirmExpansion());
        }

        // 点击弹窗外部关闭
        const buildingListModal = document.getElementById('building-list-modal');
        const buildingInfoModal = document.getElementById('building-info-modal');
        const expansionModal = document.getElementById('expansion-modal');

        if (buildingListModal) {
            buildingListModal.addEventListener('click', (e) => {
                if (e.target === buildingListModal) {
                    this.closeBuildingListModal();
                }
            });
        }

        if (buildingInfoModal) {
            buildingInfoModal.addEventListener('click', (e) => {
                if (e.target === buildingInfoModal) {
                    this.closeBuildingInfoModal();
                }
            });
        }

        if (expansionModal) {
            expansionModal.addEventListener('click', (e) => {
                if (e.target === expansionModal) {
                    this.closeExpansionModal();
                }
            });
        }
    }

    handleSlotClick(slot, index) {
        const slotContent = slot.querySelector('.slot-content');
        const slotState = slotContent.className;
        const isAlwaysUnlocked = slot.dataset.alwaysUnlocked === 'true';
        
        // 使用地块的实际索引（从dataset获取），而不是DOM顺序的index
        const slotIndex = parseInt(slot.dataset.slot) || index;

        // 检查是否已建造或正在建造
        if (slotState.includes('built')) {
            this.currentSelectedSlot = slotIndex;
            this.showBuildingInfoModal();
            return;
        } else if (slotState.includes('building')) {
            this.showBuildingProgress(slot);
            return;
        }

        // 第一块领地（始终解锁）且未建造，直接显示建筑列表
        if (isAlwaysUnlocked) {
            this.currentSelectedSlot = slotIndex;
            this.showBuildingListModal();
            return;
        }

        if (slotState.includes('locked')) {
            // 未解锁状态，显示解锁条件
            this.showUnlockInfo(slot);
        } else if (slotState.includes('unlocked')) {
            // 解锁状态，显示建筑列表
            this.currentSelectedSlot = slotIndex;
            this.showBuildingListModal();
        }
    }

    showUnlockInfo(slot) {
        const unlockLevel = slot.dataset.unlockLevel;
        showToast(`需要达到等级 ${unlockLevel} 才能解锁此地块`);
    }

    showBuildingListModal() {
        const modal = document.getElementById('building-list-modal');
        const optionsContainer = document.getElementById('building-options');

        // 先显示弹窗，但保持透明
        modal.style.visibility = 'visible';

        // 清空现有选项
        optionsContainer.innerHTML = '';

        // 获取可建造的建筑
        const availableBuildings = this.getAvailableBuildings();

        availableBuildings.forEach(buildingType => {
            const buildingData = this.territorySystem.buildingData[buildingType];
            const cost = buildingData.levels[0].cost;
            const canAfford = this.resourceSystem.hasEnoughResources(cost);
            const levelInfo = buildingData.levels[0];

            const option = document.createElement('div');
            option.className = `building-option ${canAfford ? '' : 'disabled'}`;
            option.innerHTML = `
                <div class="building-option-icon">${this.getBuildingSVG(buildingType)}</div>
                <div class="building-option-name">${buildingData.name}</div>
                <div class="building-option-cost">
                    💰 ${cost.gold} | 💎 ${cost.crystal}
                </div>
                <div class="building-option-description">
                    ${this.getBuildingDescription(buildingType, levelInfo)}
                </div>
            `;

            if (canAfford) {
                option.addEventListener('click', () => this.selectBuilding(buildingType));
            } else {
                option.addEventListener('click', () => {
                    showToast(`资源不足！需要 💰${cost.gold} 金币和 💎${cost.crystal} 宝石`);
                });
            }

            optionsContainer.appendChild(option);
        });

        // 使用requestAnimationFrame确保DOM更新后再添加动画类
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    selectBuilding(buildingType) {
        // 通过data-slot属性找到对应的地块
        const slot = document.querySelector(`.territory-slot[data-slot="${this.currentSelectedSlot}"]`);
        if (!slot) {
            showToast('地块不存在');
            return;
        }
        const slotContent = slot.querySelector('.slot-content');

        // 检查资源是否足够
        const buildingData = this.territorySystem.buildingData[buildingType];
        const cost = buildingData.levels[0].cost;

        if (!this.resourceSystem.hasEnoughResources(cost)) {
            showToast(`资源不足！需要 💰${cost.gold} 金币和 💎${cost.crystal} 水晶`);
            return;
        }

        // 开始建造（资源扣除将在领地系统中进行）
        this.startBuilding(buildingType);
        this.closeBuildingListModal();
    }

    startBuilding(buildingType) {
        // 通过data-slot属性找到对应的地块
        const slot = document.querySelector(`.territory-slot[data-slot="${this.currentSelectedSlot}"]`);
        if (!slot) {
            showToast('地块不存在');
            return;
        }
        const slotContent = slot.querySelector('.slot-content');

        // 计算建筑位置
        const x = this.currentSelectedSlot % 2;
        const y = Math.floor(this.currentSelectedSlot / 2);
        const position = { x, y };

        // 开始建造（加入建造队列）
        const buildTask = this.territorySystem.startBuildBuilding(buildingType, position, 5000);

        if (!buildTask) {
            showToast('建造失败，请检查资源是否充足');
            return;
        }

        // 更新地块状态为建造中
        slotContent.className = 'slot-content building';
        slotContent.innerHTML = `
            <div class="building-text">建造中...</div>
            <div class="building-progress">
                <div class="building-progress-bar" style="width: 0%"></div>
            </div>
        `;

        // 保存资源数据（已扣除）
        this.resourceSystem.saveToLocalStorage();

        // 更新资源显示
        this.updateResourceDisplay();

        console.log(`建筑 ${buildingType} 开始建造，预计 5 秒后完成`);
    }

    /**
     * 启动建造进度监控器（每秒检查一次）
     */
    startBuildProgressMonitor() {
        // 清除旧的定时器
        if (this.globalProgressTimer) {
            clearInterval(this.globalProgressTimer);
        }

        // 每秒更新一次所有建造中的进度
        this.globalProgressTimer = setInterval(() => {
            this.updateAllBuildingProgress();
        }, 100); // 100ms更新一次，让进度条更平滑
    }

    /**
     * 更新所有建造中的建筑进度
     */
    updateAllBuildingProgress() {
        // 检查并完成已完成的建造
        const completedBuildings = this.territorySystem.checkAndCompleteBuildings();

        if (completedBuildings.length > 0) {
            // 有建筑完成，刷新UI
            this.updateSlots();
            this.updateResourceDisplay();

            completedBuildings.forEach(building => {
                const buildingInfo = this.territorySystem.buildingData[building.type];
                console.log(`${buildingInfo.name} 建造完成！`);
            });
        }

        // 更新所有正在建造中的进度条
        this.slots.forEach((slot, index) => {
            const slotContent = slot.querySelector('.slot-content');
            if (slotContent && slotContent.classList.contains('building')) {
                // 使用地块的实际索引（从dataset获取），而不是DOM顺序的index
                const slotIndex = parseInt(slot.dataset.slot) || index;
                const x = slotIndex % 2;
                const y = Math.floor(slotIndex / 2);
                const buildTask = this.territorySystem.getBuildTaskAtPosition(x, y);

                if (buildTask) {
                    const progress = this.territorySystem.getBuildProgress(buildTask);
                    const progressBar = slot.querySelector('.building-progress-bar');
                    if (progressBar) {
                        progressBar.style.width = `${progress}%`;
                    }
                } else {
                    // 如果没有建造任务但显示为建造中，说明已完成，刷新UI
                    this.updateSlots();
                }
            }
        });
    }

    updateBuildingProgress(slotIndex) {
        // 这个方法已被 updateAllBuildingProgress 替代，保留以保持兼容性
        const x = slotIndex % 2;
        const y = Math.floor(slotIndex / 2);
        const buildTask = this.territorySystem.getBuildTaskAtPosition(x, y);

        if (!buildTask) return;

        // 通过data-slot属性找到对应的地块
        const slot = document.querySelector(`.territory-slot[data-slot="${slotIndex}"]`);
        if (!slot) return;
        const progressBar = slot.querySelector('.building-progress-bar');
        const progress = this.territorySystem.getBuildProgress(buildTask);

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }

    completeBuilding(slot, buildingType) {
        // 这个方法已不再需要，因为建造完成逻辑已在 territorySystem.checkAndCompleteBuildings 中处理
        // 保留此方法以保持向后兼容性
        const slotContent = slot.querySelector('.slot-content');
        const buildingData = this.territorySystem.buildingData[buildingType];

        // 更新地块状态为已建造
        slotContent.className = 'slot-content built';
        slotContent.innerHTML = `
            <div class="building-icon">${this.getBuildingIcon(buildingType)}</div>
            <div class="building-level">Lv.1</div>
        `;

        console.log(`${buildingData.name} 建造完成！`);
    }

    showBuildingInfoModal() {
        // 通过data-slot属性找到对应的地块
        const slot = document.querySelector(`.territory-slot[data-slot="${this.currentSelectedSlot}"]`);
        if (!slot) {
            console.error('地块不存在');
            return;
        }
        const slotContent = slot.querySelector('.slot-content');
        // const buildingIcon = slotContent.querySelector('.building-icon').textContent;
        const buildingLevelElement = slotContent.querySelector('.building-level-badge') || slotContent.querySelector('.building-level');
        const buildingLevel = buildingLevelElement ? buildingLevelElement.textContent : 'Lv.1';

        // 从领地系统获取建筑信息
        const x = this.currentSelectedSlot % 2;
        const y = Math.floor(this.currentSelectedSlot / 2);
        const building = this.territorySystem.getBuildingAtPosition(x, y);

        if (!building) {
            console.error('建筑不存在');
            return;
        }

        const buildingData = this.territorySystem.buildingData[building.type];
        const levelInfo = buildingData.levels[building.level - 1];

        const modal = document.getElementById('building-info-modal');
        const title = document.getElementById('building-info-title');
        const content = document.getElementById('building-info-content');

        title.textContent = `${buildingData.name} ${buildingLevel}`;

        // 计算属性加成
        const attackBonus = levelInfo.attackBonus || 0;
        const defenseBonus = levelInfo.defenseBonus || 0;
        const hp = levelInfo.hp || 0;
        const goldProduction = levelInfo.goldProduction || 0;
        const crystalProduction = levelInfo.crystalProduction || 0;
        const experienceBonus = levelInfo.experienceBonus || 0;
        const healingRate = levelInfo.healingRate || 0;

        // 构建属性统计HTML
        let statsHtml = '';
        
        if (goldProduction > 0) {
            statsHtml += `
                <div class="stat-item">
                    <div class="stat-label">💰 金币产出</div>
                    <div class="stat-value">+${goldProduction}/小时</div>
                </div>
            `;
        }
        if (crystalProduction > 0) {
            statsHtml += `
                <div class="stat-item">
                    <div class="stat-label">💎 水晶产出</div>
                    <div class="stat-value">+${crystalProduction}/分钟</div>
                </div>
            `;
        }
        if (attackBonus > 0) {
            statsHtml += `
                <div class="stat-item">
                    <div class="stat-label">⚔️ 攻击加成</div>
                    <div class="stat-value">+${attackBonus}</div>
                </div>
            `;
        }
        if (defenseBonus > 0) {
            statsHtml += `
                <div class="stat-item">
                    <div class="stat-label">🛡️ 防御加成</div>
                    <div class="stat-value">+${defenseBonus}</div>
                </div>
            `;
        }
        if (hp > 0) {
            statsHtml += `
                <div class="stat-item">
                    <div class="stat-label">❤️ 生命值</div>
                    <div class="stat-value">${hp}</div>
                </div>
            `;
        }
        if (experienceBonus > 0) {
            statsHtml += `
                <div class="stat-item">
                    <div class="stat-label">📚 经验加成</div>
                    <div class="stat-value">+${experienceBonus}%</div>
                </div>
            `;
        }
        if (healingRate > 0) {
            statsHtml += `
                <div class="stat-item">
                    <div class="stat-label">💊 治疗速度</div>
                    <div class="stat-value">+${healingRate}/秒</div>
                </div>
            `;
        }

        // 检查是否可以升级，显示升级所需资源
        const isMaxLevel = building.level >= buildingData.levels.length;
        let upgradeCostHtml = '';
        
        if (!isMaxLevel) {
            const nextLevelInfo = buildingData.levels[building.level]; // 下一级
            const nextCost = nextLevelInfo.cost;
            const currentGold = this.resourceSystem.getCoins();
            const currentCrystal = this.resourceSystem.getCrystals();
            
            const goldNeeded = nextCost.gold || 0;
            const crystalNeeded = nextCost.crystal || 0;
            const goldInsufficient = currentGold < goldNeeded;
            const crystalInsufficient = currentCrystal < crystalNeeded;
            
            upgradeCostHtml = `
                <div class="upgrade-cost-section">
                    <div class="upgrade-cost-title">升级至 Lv.${building.level + 1} 所需资源:</div>
                    <div class="upgrade-cost-items">
                        ${goldNeeded > 0 ? `
                        <div class="cost-item">
                            <span class="cost-label">💰 金币</span>
                            <span class="cost-value ${goldInsufficient ? 'insufficient' : ''}">${currentGold} / ${goldNeeded}</span>
                        </div>
                        ` : ''}
                        ${crystalNeeded > 0 ? `
                        <div class="cost-item">
                            <span class="cost-label">💎 水晶</span>
                            <span class="cost-value ${crystalInsufficient ? 'insufficient' : ''}">${currentCrystal} / ${crystalNeeded}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="building-info-header">
                <div class="building-info-icon">${this.getBuildingSVG(building.type)}</div>
                <div class="building-info-details">
                    <h4>${buildingData.name}</h4>
                    <p>等级: ${buildingLevel}</p>
                </div>
            </div>
            ${statsHtml ? `<div class="building-info-stats">${statsHtml}</div>` : ''}
            ${upgradeCostHtml}
            <div class="building-actions">
                <button class="action-btn upgrade-btn" id="upgrade-building" ${isMaxLevel ? 'disabled' : ''}>
                    ${isMaxLevel ? '已满级' : '升级'}
                </button>
                <button class="action-btn demolish-btn" id="demolish-building">拆迁</button>
            </div>
        `;

        // 绑定升级和拆迁按钮事件
        const upgradeBtn = document.getElementById('upgrade-building');
        const demolishBtn = document.getElementById('demolish-building');

        if (upgradeBtn && !upgradeBtn.disabled) {
            upgradeBtn.addEventListener('click', () => this.upgradeBuilding(building.id));
        }

        if (demolishBtn) {
            demolishBtn.addEventListener('click', () => this.demolishBuilding(building.id));
        }

        // 显示弹窗并添加动画
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    upgradeBuilding(buildingId) {
        // 实现升级逻辑
        const success = this.territorySystem.upgradeBuilding(buildingId);
        if (success) {
            // 保存资源数据和领地数据
            this.resourceSystem.saveToLocalStorage();
            this.territorySystem.saveToLocalStorage();

            // 更新UI显示
            this.updateResourceDisplay();
            this.updateSlots();
            this.closeBuildingInfoModal();
            showToast('建筑升级成功！');
        } else {
            showToast('升级失败，请检查资源是否充足');
        }
    }

    demolishBuilding(buildingId) {
        // 实现拆迁逻辑
        import('../modules/ui-system.js').then(({ showConfirm }) => {
            showConfirm('确定要拆迁此建筑吗？', () => {
                const success = this.territorySystem.demolishBuilding(buildingId);
                if (success) {
                    // 更新UI显示 - 通过data-slot属性找到对应的地块
                    const slot = document.querySelector(`.territory-slot[data-slot="${this.currentSelectedSlot}"]`);
                    if (slot) {
                        const slotContent = slot.querySelector('.slot-content');

                        // 重置为解锁状态
                        slotContent.className = 'slot-content unlocked';
                        slotContent.innerHTML = `
                            <div class="empty-slot-hint">
                                <span class="plus-icon">+</span>
                                <span class="hint-text">建造</span>
                            </div>
                        `;
                    }

                    // 保存领地数据
                    this.territorySystem.saveToLocalStorage();

                    this.closeBuildingInfoModal();
                    showToast('建筑已拆迁');
                } else {
                    showToast('拆迁失败');
                }
            });
        });
    }

    getAvailableBuildings() {
        const allBuildings = Object.keys(this.territorySystem.buildingData).filter(type => type !== 'main_base');

        // 将水晶矿放在第一位
        const buildings = [];
        if (allBuildings.includes('crystal_mine')) {
            buildings.push('crystal_mine');
        }

        // 添加其他建筑
        allBuildings.forEach(type => {
            if (type !== 'crystal_mine') {
                buildings.push(type);
            }
        });

        console.log('可用建筑列表:', buildings);
        console.log('建筑数据:', this.territorySystem.buildingData);
        return buildings;
    }

    getBuildingIcon(buildingType) {
        const icons = {
            'training_ground': '🏋️',
            'temple': '🏛️',
            'main_base': '🏰',
            'barracks': '🏕️',
            'workshop': '🔨',
            'crystal_mine': '💎',
            'library': '📚',
            'hospital': '🏥',
            'tower': '🗼',
            'market': '🏪'
        };
        return icons[buildingType] || '🏗️';
    }

    getBuildingName(buildingType) {
        const names = {
            'training_ground': '训练场',
            'temple': '神庙',
            'main_base': '主基地',
            'barracks': '兵营',
            'workshop': '工坊',
            'crystal_mine': '水晶矿',
            'library': '图书馆',
            'hospital': '医院',
            'tower': '防御塔',
            'market': '市场'
        };
        return names[buildingType] || '未知建筑';
    }

    getBuildingSVG(buildingType) {
        const svgs = {
            'main_base': `<svg viewBox="0 0 100 100" width="100%" height="100%"><defs><linearGradient id="wallGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#bdc3c7;stop-opacity:1" /><stop offset="100%" style="stop-color:#95a5a6;stop-opacity:1" /></linearGradient><linearGradient id="roofGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#e74c3c;stop-opacity:1" /><stop offset="100%" style="stop-color:#c0392b;stop-opacity:1" /></linearGradient></defs><rect x="30" y="40" width="40" height="50" fill="url(#wallGrad)" /><polygon points="30,40 50,10 70,40" fill="url(#roofGrad)" /><rect x="45" y="60" width="10" height="30" fill="#555" rx="5" /><rect x="10" y="50" width="20" height="40" fill="url(#wallGrad)" /><polygon points="10,50 20,30 30,50" fill="url(#roofGrad)" /><rect x="70" y="50" width="20" height="40" fill="url(#wallGrad)" /><polygon points="70,50 80,30 90,50" fill="url(#roofGrad)" /></svg>`,
            'crystal_mine': `<svg viewBox="0 0 100 100" width="100%" height="100%"><defs><linearGradient id="crystalGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#a2d9ff;stop-opacity:0.9" /><stop offset="100%" style="stop-color:#0077be;stop-opacity:0.9" /></linearGradient></defs><path d="M50 10 L70 40 L50 90 L30 40 Z" fill="url(#crystalGrad)" stroke="white" stroke-width="1"/><path d="M20 60 L35 50 L30 80 Z" fill="url(#crystalGrad)" stroke="white" stroke-width="1"/><path d="M80 60 L65 50 L70 80 Z" fill="url(#crystalGrad)" stroke="white" stroke-width="1"/></svg>`,
            'training_ground': `<svg viewBox="0 0 100 100" width="100%" height="100%"><ellipse cx="50" cy="80" rx="40" ry="10" fill="#e67e22" /><rect x="45" y="40" width="10" height="40" fill="#8e44ad" /><circle cx="50" cy="40" r="20" fill="#ecf0f1" stroke="#c0392b" stroke-width="5" /><circle cx="50" cy="40" r="10" fill="#c0392b" /><path d="M70 70 L90 50 L85 45 L65 65 Z" fill="#bdc3c7" /><rect x="62" y="62" width="8" height="8" fill="#f1c40f" transform="rotate(45 66 66)" /></svg>`,
            'temple': `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="10" y="80" width="80" height="10" fill="#ecf0f1" /><rect x="15" y="75" width="70" height="5" fill="#bdc3c7" /><rect x="20" y="35" width="10" height="40" fill="#ecf0f1" /><rect x="45" y="35" width="10" height="40" fill="#ecf0f1" /><rect x="70" y="35" width="10" height="40" fill="#ecf0f1" /><polygon points="10,35 50,10 90,35" fill="#f1c40f" /><rect x="10" y="35" width="80" height="5" fill="#bdc3c7" /></svg>`,
            'barracks': `<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M20 80 L50 20 L80 80 Z" fill="#27ae60" /><path d="M45 80 L50 20 L55 80 Z" fill="#2ecc71" /><path d="M40 80 L50 50 L60 80 Z" fill="#2c3e50" /><line x1="50" y1="20" x2="50" y2="5" stroke="#7f8c8d" stroke-width="2" /><polygon points="50,5 70,10 50,15" fill="#e74c3c" /></svg>`,
            'workshop': `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="20" y="40" width="60" height="40" fill="#d35400" /><polygon points="20,40 50,20 80,40" fill="#e67e22" /><rect x="65" y="25" width="10" height="20" fill="#7f8c8d" /><circle cx="50" cy="60" r="15" fill="#95a5a6" stroke="#7f8c8d" stroke-width="5" stroke-dasharray="5,5" /></svg>`,
            'library': `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="20" y="30" width="60" height="50" fill="#3498db" rx="5" /><rect x="25" y="35" width="50" height="40" fill="#ecf0f1" /><rect x="30" y="40" width="40" height="5" fill="#bdc3c7" /><rect x="30" y="50" width="40" height="5" fill="#bdc3c7" /><rect x="30" y="60" width="40" height="5" fill="#bdc3c7" /></svg>`,
            'hospital': `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="25" y="30" width="50" height="50" fill="#ecf0f1" stroke="#bdc3c7" stroke-width="2" /><polygon points="20,30 50,10 80,30" fill="#e74c3c" /><rect x="45" y="45" width="10" height="20" fill="#e74c3c" /><rect x="40" y="50" width="20" height="10" fill="#e74c3c" /></svg>`,
            'tower': `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="35" y="30" width="30" height="60" fill="#7f8c8d" /><rect x="30" y="20" width="40" height="10" fill="#95a5a6" /><rect x="32" y="15" width="6" height="5" fill="#95a5a6" /><rect x="47" y="15" width="6" height="5" fill="#95a5a6" /><rect x="62" y="15" width="6" height="5" fill="#95a5a6" /><rect x="45" y="40" width="10" height="15" fill="#2c3e50" rx="5" /></svg>`,
            'market': `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="20" y="50" width="60" height="30" fill="#f39c12" /><rect x="20" y="80" width="10" height="10" fill="#d35400" /><rect x="70" y="80" width="10" height="10" fill="#d35400" /><path d="M15 50 L85 50 L75 30 L25 30 Z" fill="#e74c3c" /><path d="M25 30 L35 50 L45 30 L55 50 L65 30 L75 50" fill="none" stroke="#ecf0f1" stroke-width="2" /></svg>`
        };
        return svgs[buildingType] || this.getBuildingIcon(buildingType);
    }

    getBuildingDescription(buildingType, levelInfo) {
        const descriptions = {
            'training_ground': `攻击力 +${levelInfo.attackBonus || 0}`,
            'temple': `防御力 +${levelInfo.defenseBonus || 0}`,
            'main_base': `生命值 ${levelInfo.hp || 0}，建筑上限 ${levelInfo.buildLimit || 0}`,
            'barracks': `生命值 ${levelInfo.hp || 0}，攻击+${levelInfo.attackBonus || 0}，防御+${levelInfo.defenseBonus || 0}`,
            'workshop': `金币产出 +${levelInfo.goldProduction || 0}/小时`,
            'crystal_mine': `宝石产出 +${levelInfo.crystalProduction || 0}/小时`,
            'library': `经验加成 +${levelInfo.experienceBonus || 0}%`,
            'hospital': `生命值 ${levelInfo.hp || 0}，治疗率 +${levelInfo.healingRate || 0}/小时`,
            'tower': `攻击+${levelInfo.attackBonus || 0}，防御+${levelInfo.defenseBonus || 0}`,
            'market': `金币+${levelInfo.goldProduction || 0}/小时，宝石+${levelInfo.crystalProduction || 0}/小时`
        };
        return descriptions[buildingType] || '提供属性加成';
    }

    getBuildingTypeFromIcon(icon) {
        const iconMap = {
            '🏋️': 'training_ground',
            '🏛️': 'temple',
            '🏰': 'main_base',
            '🏕️': 'barracks',
            '🔨': 'workshop',
            '💎': 'crystal_mine',
            '📚': 'library',
            '🏥': 'hospital',
            '🗼': 'tower',
            '🏪': 'market'
        };
        return iconMap[icon] || 'training_ground';
    }

    closeBuildingListModal() {
        const modal = document.getElementById('building-list-modal');
        modal.classList.remove('show');

        // 等待动画完成后再隐藏元素
        setTimeout(() => {
            modal.style.visibility = 'hidden';
        }, 300);
    }

    closeBuildingInfoModal() {
        const modal = document.getElementById('building-info-modal');
        modal.classList.remove('show');
        
        // 等待动画完成后再隐藏元素
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    // ==================== 领地扩张系统UI ====================

    /**
     * 渲染扩张的地块到DOM
     */
    renderExpandedSlots() {
        const expansion = this.territorySystem.territoryData.expansion;
        const grid = document.querySelector('.territory-grid');
        
        if (!grid || !expansion.expandedSlots) return;

        // 检查是否已经渲染过扩张地块
        const existingExpandedSlots = document.querySelectorAll('.territory-slot[data-expanded="true"]');
        const existingIndices = new Set([...existingExpandedSlots].map(s => parseInt(s.dataset.slot)));

        expansion.expandedSlots.forEach(slotInfo => {
            // 跳过已存在的地块
            if (existingIndices.has(slotInfo.index)) return;

            const newSlot = document.createElement('div');
            newSlot.className = 'territory-slot';
            newSlot.dataset.slot = slotInfo.index;
            newSlot.dataset.unlockLevel = slotInfo.unlockLevel;
            newSlot.dataset.expanded = 'true';
            
            if (slotInfo.unlockLevel === 0) {
                newSlot.dataset.alwaysUnlocked = 'true';
            }

            newSlot.innerHTML = `
                <div class="slot-content locked">
                    <div class="unlock-condition">
                        <div class="unlock-icon">🔒</div>
                        <div class="unlock-text">等级 ${slotInfo.unlockLevel} 解锁</div>
                    </div>
                </div>
            `;

            // 添加点击事件
            newSlot.addEventListener('click', () => this.handleSlotClick(newSlot, slotInfo.index));

            grid.appendChild(newSlot);
        });

        // 重新获取所有地块
        this.slots = document.querySelectorAll('.territory-slot');
    }

    /**
     * 更新扩张按钮状态
     */
    updateExpansionButton() {
        const expandButton = document.getElementById('expand-territory-btn');
        if (!expandButton) return;

        const status = this.territorySystem.getExpansionStatus();
        
        if (status.canExpand) {
            expandButton.classList.remove('disabled');
            expandButton.title = `点击扩张领地 (${status.expansionCount + 1}/${this.territorySystem.expansionConfig.costs.length})`;
        } else {
            expandButton.classList.add('disabled');
            expandButton.title = '已达到最大扩张次数';
        }

        // 更新扩张进度显示
        const progressText = document.getElementById('expansion-progress');
        if (progressText) {
            progressText.textContent = `${status.currentSlots}/${status.maxSlots}`;
        }
    }

    /**
     * 显示领地扩张弹窗
     */
    showExpansionModal() {
        const modal = document.getElementById('expansion-modal');
        if (!modal) return;

        const status = this.territorySystem.getExpansionStatus();
        const checkResult = this.territorySystem.checkCanExpand();
        
        // 更新弹窗内容
        const content = document.getElementById('expansion-content');
        if (content) {
            if (!status.canExpand) {
                content.innerHTML = `
                    <div class="expansion-info">
                        <div class="expansion-icon">🏰</div>
                        <div class="expansion-status">
                            <h4>领地已完全扩张</h4>
                            <p>当前地块: ${status.currentSlots}/${status.maxSlots}</p>
                            <p>已扩张次数: ${status.expansionCount}</p>
                        </div>
                    </div>
                    <div class="expansion-complete">
                        <span class="complete-icon">✨</span>
                        <span>您的领地已达到最大规模！</span>
                    </div>
                `;
                
                const confirmBtn = document.getElementById('confirm-expansion-btn');
                if (confirmBtn) {
                    confirmBtn.style.display = 'none';
                }
            } else {
                const cost = status.nextCost;
                const newLevels = status.newSlotLevels;
                const canAfford = checkResult.canExpand;

                content.innerHTML = `
                    <div class="expansion-info">
                        <div class="expansion-icon">🏗️</div>
                        <div class="expansion-status">
                            <h4>领地扩张</h4>
                            <p>当前地块: ${status.currentSlots}/${status.maxSlots}</p>
                            <p>扩张次数: ${status.expansionCount + 1}/${this.territorySystem.expansionConfig.costs.length}</p>
                        </div>
                    </div>
                    
                    <div class="expansion-preview">
                        <h5>📦 扩张将获得:</h5>
                        <div class="new-slots-preview">
                            ${newLevels.map((level, i) => `
                                <div class="new-slot-item">
                                    <span class="slot-icon">📍</span>
                                    <span>新地块 ${status.currentSlots + i + 1}</span>
                                    <span class="unlock-requirement">${level === 0 ? '立即可用' : `需等级 ${level}`}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="expansion-cost">
                        <h5>💰 扩张费用:</h5>
                        <div class="cost-items">
                            <div class="cost-item ${this.resourceSystem.coins >= cost.gold ? '' : 'insufficient'}">
                                <span class="cost-icon">💰</span>
                                <span class="cost-value">${cost.gold.toLocaleString()}</span>
                                <span class="cost-current">(当前: ${this.resourceSystem.coins.toLocaleString()})</span>
                            </div>
                            <div class="cost-item ${this.resourceSystem.crystals >= cost.crystal ? '' : 'insufficient'}">
                                <span class="cost-icon">💎</span>
                                <span class="cost-value">${cost.crystal.toLocaleString()}</span>
                                <span class="cost-current">(当前: ${this.resourceSystem.crystals.toLocaleString()})</span>
                            </div>
                        </div>
                    </div>

                    ${!canAfford ? `
                        <div class="expansion-warning">
                            <span class="warning-icon">⚠️</span>
                            <span>${checkResult.reason}</span>
                        </div>
                    ` : ''}
                `;

                const confirmBtn = document.getElementById('confirm-expansion-btn');
                if (confirmBtn) {
                    confirmBtn.style.display = 'block';
                    confirmBtn.disabled = !canAfford;
                    confirmBtn.textContent = canAfford ? '确认扩张' : '资源不足';
                }
            }
        }

        modal.style.display = 'flex';
        modal.classList.add('show');
    }

    /**
     * 关闭领地扩张弹窗
     */
    closeExpansionModal() {
        const modal = document.getElementById('expansion-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    /**
     * 确认领地扩张
     */
    confirmExpansion() {
        const result = this.territorySystem.expandTerritory();
        
        if (result.success) {
            // 保存资源数据
            this.resourceSystem.saveToLocalStorage();
            
            // 渲染新地块
            this.renderExpandedSlots();
            
            // 更新UI
            this.updateSlots();
            this.updateResourceDisplay();
            this.updateExpansionButton();
            
            // 关闭弹窗
            this.closeExpansionModal();
            
            // 显示成功提示
            showToast(`🎉 ${result.message}`);
            
            console.log('领地扩张成功:', result);
        } else {
            showToast(`❌ 扩张失败: ${result.message}`);
        }
    }

    updateSlots() {
        this.slots.forEach((slot, index) => {
            const unlockLevel = parseInt(slot.dataset.unlockLevel);
            const isAlwaysUnlocked = slot.dataset.alwaysUnlocked === 'true';
            const slotContent = slot.querySelector('.slot-content');

            // 使用地块的实际索引（从dataset获取），而不是DOM顺序的index
            const slotIndex = parseInt(slot.dataset.slot) || index;
            const x = slotIndex % 2;
            const y = Math.floor(slotIndex / 2);

            // 重置所有状态类
            slot.classList.remove('is-building', 'is-built', 'is-locked', 'is-unlocked');

            // 优先检查是否正在建造
            const buildTask = this.territorySystem.getBuildTaskAtPosition(x, y);
            if (buildTask) {
                slot.classList.add('is-building');
                // 显示建造中状态
                const progress = this.territorySystem.getBuildProgress(buildTask);
                const remainingTime = this.territorySystem.getBuildRemainingTime(buildTask);
                const buildingName = this.getBuildingName(buildTask.buildingType);

                slotContent.className = 'slot-content building';
                slotContent.innerHTML = `
                    <div class="building-status-badge">建造中</div>
                    <div class="building-name-preview">${buildingName}</div>
                    <div class="building-progress-container">
                        <div class="building-progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="building-timer">${remainingTime}s</div>
                `;
                return;
            }

            // 检查是否始终解锁（不做等级判断）
            if (isAlwaysUnlocked || this.currentPlayerLevel >= unlockLevel) {
                // 检查是否已有建筑
                const building = this.territorySystem.getBuildingAtPosition(x, y);
                if (building) {
                    slot.classList.add('is-built');
                    // 显示已建造的建筑
                    slotContent.className = 'slot-content built';
                    const buildingName = this.getBuildingName(building.type);
                    slotContent.innerHTML = `
                        <div class="building-icon-svg">${this.getBuildingSVG(building.type)}</div>
                        <div class="building-info-overlay">
                            <div class="building-name">${buildingName}</div>
                            <div class="building-level-badge">Lv.${building.level}</div>
                        </div>
                    `;
                } else {
                    slot.classList.add('is-unlocked');
                    // 显示解锁状态
                    slotContent.className = 'slot-content unlocked';
                    slotContent.innerHTML = `
                        <div class="empty-slot-hint">
                            <span class="plus-icon">+</span>
                            <span class="hint-text">建造</span>
                        </div>
                    `;
                }
            } else {
                slot.classList.add('is-locked');
                // 显示未解锁状态
                slotContent.className = 'slot-content locked';
                slotContent.innerHTML = `
                    <div class="lock-icon">🔒</div>
                    <div class="lock-text">Lv.${unlockLevel} 解锁</div>
                `;
            }
        });
    }

    hasBuildingInSlot(slotIndex) {
        // 检查指定位置是否有建筑
        const x = slotIndex % 2;
        const y = Math.floor(slotIndex / 2);
        const building = this.territorySystem.getBuildingAtPosition(x, y);
        return building ? building.type : null;
    }

    showBuildingProgress(slot) {
        const progressData = this.buildingProgress.get(this.currentSelectedSlot);
        if (progressData) {
            showToast(`建造进度: ${progressData.progress}%`);
        }
    }

    updateResourceDisplay() {
        // 更新主界面的资源显示
        this.resourceSystem.updateCurrencyDisplay();

        // 更新领地界面的资源显示
        const goldElement = document.getElementById('territory-gold');
        if (goldElement) {
            goldElement.textContent = this.resourceSystem.formatNumber(this.resourceSystem.coins);
        }

        const crystalElement = document.getElementById('territory-crystal');
        if (crystalElement) {
            crystalElement.textContent = this.resourceSystem.formatNumber(this.resourceSystem.crystals);
        }
    }

    hideLoadingScreen() {
        const gameLoadingScreen = document.getElementById('gameLoadingScreen');
        if (gameLoadingScreen) {
            setTimeout(() => {
                gameLoadingScreen.style.display = 'none';
            }, 1000);
        }
    }

    setupBottomNavigation() {
        console.log('[TerritoryScene] 设置底部导航栏事件');
        
        // 角色按钮 - 跳转到主界面
        const characterButton = document.getElementById('character-button');
        console.log('[TerritoryScene] 角色按钮元素:', characterButton);
        if (characterButton) {
            characterButton.addEventListener('click', (e) => {
                console.log('[TerritoryScene] 角色按钮被点击');
                e.preventDefault();
                e.stopPropagation();
                // 在离开页面前清理定时器（可选，因为建造会基于时间戳自动恢复）
                this.cleanup();
                window.location.href = 'index.html';
            });
            console.log('[TerritoryScene] 角色按钮点击事件已绑定');
        } else {
            console.error('[TerritoryScene] ❌ 未找到角色按钮元素 #character-button');
        }

        // 领地按钮 - 当前页面，无需操作
        const territoryButton = document.getElementById('territory-button');
        if (territoryButton) {
            // 领地按钮保持激活状态，无需添加事件
            console.log('[TerritoryScene] 领地按钮已找到，当前页面无需操作');
        }

        // 其他按钮 - 暂时显示提示
        const otherButtons = document.querySelectorAll('.bottom-navigation .nav-item:not(#character-button):not(#territory-button)');
        otherButtons.forEach(button => {
            button.addEventListener('click', () => {
                const label = button.querySelector('.nav-label').textContent;
                showToast(`${label} 功能暂未开放`);
            });
        });
        console.log('[TerritoryScene] 底部导航栏事件设置完成');
    }

    /**
     * 清理资源（定时器等）
     */
    cleanup() {
        if (this.globalProgressTimer) {
            clearInterval(this.globalProgressTimer);
            this.globalProgressTimer = null;
        }

        // 清理其他定时器
        this.progressTimers.forEach(timer => clearTimeout(timer));
        this.progressTimers.clear();

        // 停止Canvas动画
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * 初始化Canvas动画场景
     */
    initCanvas() {
        this.canvas = document.getElementById('territory-canvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        // 监听窗口大小变化
        window.addEventListener('resize', () => this.resizeCanvas());

        // 初始化场景元素
        this.initSceneElements();

        // 开始动画循环
        this.animate();
    }

    /**
     * 调整Canvas大小
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    /**
     * 初始化场景元素
     */
    initSceneElements() {
        // 创建云朵
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height * 0.3,
                speed: 0.2 + Math.random() * 0.3,
                size: 40 + Math.random() * 40,
                opacity: 0.6 + Math.random() * 0.3
            });
        }

        // 创建小鸟
        for (let i = 0; i < 3; i++) {
            this.birds.push({
                x: Math.random() * this.canvas.width,
                y: 50 + Math.random() * 100,
                speed: 1 + Math.random() * 1.5,
                wingAngle: 0,
                size: 15 + Math.random() * 10
            });
        }

        // 创建树木（静态装饰）
        const treePositions = [
            { x: 0.15, y: 0.65 },
            { x: 0.35, y: 0.75 },
            { x: 0.85, y: 0.65 },
            { x: 0.65, y: 0.8 }
        ];

        treePositions.forEach(pos => {
            this.trees.push({
                x: pos.x * this.canvas.width,
                y: pos.y * this.canvas.height,
                size: 30 + Math.random() * 20,
                sway: Math.random() * Math.PI * 2
            });
        });

        // 创建蝴蝶
        for (let i = 0; i < 2; i++) {
            this.butterflies.push({
                x: Math.random() * this.canvas.width,
                y: this.canvas.height * 0.4 + Math.random() * this.canvas.height * 0.3,
                angle: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 0.5,
                radius: 30 + Math.random() * 20,
                wingAngle: 0,
                centerX: 0,
                centerY: 0
            });
        }

        // 设置蝴蝶的中心点
        this.butterflies.forEach(butterfly => {
            butterfly.centerX = butterfly.x;
            butterfly.centerY = butterfly.y;
        });

        // 创建山脉
        for (let i = 0; i < 5; i++) {
            const width = 150 + Math.random() * 300;
            const height = 80 + Math.random() * 150;
            this.mountains.push({
                x: Math.random() * this.canvas.width,
                y: this.canvas.height * 0.6, // 地平线位置
                width: width,
                height: height,
                color: `hsl(${100 + Math.random() * 40}, ${20 + Math.random() * 20}%, ${30 + Math.random() * 20}%)`
            });
        }
        // 按 y 排序（虽然这里 y 是一样的，但如果有透视可以排）或者按 x 排
        // 这里简单点，不需要排序，因为都在地平线上

        // 创建花朵
        for (let i = 0; i < 30; i++) {
            this.flowers.push({
                x: Math.random() * this.canvas.width,
                y: this.canvas.height * 0.6 + Math.random() * (this.canvas.height * 0.4),
                size: 2 + Math.random() * 3,
                color: `hsl(${Math.random() * 360}, 80%, 70%)`,
                sway: Math.random() * Math.PI * 2
            });
        }
    }

    /**
     * 动画循环
     */
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制天空渐变
        this.drawSky();

        // 绘制太阳
        this.drawSun();

        // 绘制山脉
        this.drawMountains();

        // 绘制云朵
        this.updateAndDrawClouds();

        // 绘制小鸟
        this.updateAndDrawBirds();

        // 绘制地面
        this.drawGround();

        // 绘制花朵
        this.drawFlowers();

        // 绘制树木
        this.drawTrees();

        // 绘制蝴蝶
        this.updateAndDrawButterflies();

        // 绘制装饰粒子
        this.updateAndDrawParticles();

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * 绘制天空
     */
    drawSky() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.6);
        gradient.addColorStop(0, '#4facfe');
        gradient.addColorStop(1, '#00f2fe');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.6);
    }

    /**
     * 绘制太阳
     */
    drawSun() {
        this.sunRays += 0.02;
        const sunX = this.canvas.width * 0.85;
        const sunY = this.canvas.height * 0.15;
        const sunRadius = 40;

        // 绘制太阳光芒
        this.ctx.save();
        this.ctx.translate(sunX, sunY);
        this.ctx.rotate(this.sunRays);

        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            const x1 = Math.cos(angle) * sunRadius;
            const y1 = Math.sin(angle) * sunRadius;
            const x2 = Math.cos(angle) * (sunRadius + 15);
            const y2 = Math.sin(angle) * (sunRadius + 15);

            this.ctx.strokeStyle = 'rgba(255, 223, 0, 0.6)';
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }

        this.ctx.restore();

        // 绘制太阳本体
        const gradient = this.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(0.5, '#FFA500');
        gradient.addColorStop(1, '#FF8C00');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * 绘制地面
     */
    drawGround() {
        const groundY = this.canvas.height * 0.6;

        // 草地渐变
        const gradient = this.ctx.createLinearGradient(0, groundY, 0, this.canvas.height);
        gradient.addColorStop(0, '#a8e063');
        gradient.addColorStop(1, '#56ab2f');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, groundY, this.canvas.width, this.canvas.height);

        // 绘制草地纹理
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * this.canvas.width;
            const y = groundY + Math.random() * (this.canvas.height - groundY);
            const size = 1 + Math.random() * 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * 更新和绘制云朵
     */
    updateAndDrawClouds() {
        this.clouds.forEach(cloud => {
            cloud.x += cloud.speed;
            if (cloud.x > this.canvas.width + cloud.size) {
                cloud.x = -cloud.size;
            }

            this.ctx.save();
            this.ctx.globalAlpha = cloud.opacity;
            this.ctx.fillStyle = '#FFFFFF';

            // 绘制云朵（多个圆形组成）
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, cloud.size * 0.5, 0, Math.PI * 2);
            this.ctx.arc(cloud.x + cloud.size * 0.3, cloud.y, cloud.size * 0.4, 0, Math.PI * 2);
            this.ctx.arc(cloud.x - cloud.size * 0.3, cloud.y, cloud.size * 0.4, 0, Math.PI * 2);
            this.ctx.arc(cloud.x, cloud.y - cloud.size * 0.2, cloud.size * 0.35, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });
    }

    /**
     * 更新和绘制小鸟
     */
    updateAndDrawBirds() {
        this.birds.forEach(bird => {
            bird.x += bird.speed;
            bird.wingAngle += 0.2;

            if (bird.x > this.canvas.width + 50) {
                bird.x = -50;
                bird.y = 50 + Math.random() * 100;
            }

            this.ctx.save();
            this.ctx.translate(bird.x, bird.y);

            // 绘制简单的V形小鸟
            const wingOffset = Math.sin(bird.wingAngle) * 5;
            this.ctx.strokeStyle = '#2C3E50';
            this.ctx.lineWidth = 2;
            this.ctx.lineCap = 'round';

            this.ctx.beginPath();
            this.ctx.moveTo(-bird.size * 0.3, wingOffset);
            this.ctx.lineTo(0, 0);
            this.ctx.lineTo(bird.size * 0.3, wingOffset);
            this.ctx.stroke();

            this.ctx.restore();
        });
    }

    /**
     * 绘制树木
     */
    drawTrees() {
        this.trees.forEach(tree => {
            tree.sway += 0.02;
            const swayOffset = Math.sin(tree.sway) * 3;

            this.ctx.save();

            // 树干
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(
                tree.x - tree.size * 0.15,
                tree.y - tree.size * 0.5,
                tree.size * 0.3,
                tree.size * 0.5
            );

            // 树冠（三角形）
            this.ctx.fillStyle = '#228B22';
            this.ctx.beginPath();
            this.ctx.moveTo(tree.x + swayOffset, tree.y - tree.size);
            this.ctx.lineTo(tree.x - tree.size * 0.5, tree.y - tree.size * 0.3);
            this.ctx.lineTo(tree.x + tree.size * 0.5, tree.y - tree.size * 0.3);
            this.ctx.closePath();
            this.ctx.fill();

            // 第二层树冠
            this.ctx.fillStyle = '#32CD32';
            this.ctx.beginPath();
            this.ctx.moveTo(tree.x + swayOffset, tree.y - tree.size * 0.8);
            this.ctx.lineTo(tree.x - tree.size * 0.4, tree.y - tree.size * 0.15);
            this.ctx.lineTo(tree.x + tree.size * 0.4, tree.y - tree.size * 0.15);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.restore();
        });
    }

    /**
     * 更新和绘制蝴蝶
     */
    updateAndDrawButterflies() {
        this.butterflies.forEach(butterfly => {
            // 圆形路径运动
            butterfly.angle += 0.02;
            butterfly.x = butterfly.centerX + Math.cos(butterfly.angle) * butterfly.radius;
            butterfly.y = butterfly.centerY + Math.sin(butterfly.angle) * butterfly.radius * 0.5;

            // 翅膀扇动
            butterfly.wingAngle += 0.15;
            const wingSpread = Math.abs(Math.sin(butterfly.wingAngle)) * 8;

            this.ctx.save();
            this.ctx.translate(butterfly.x, butterfly.y);

            // 蝴蝶身体
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(-2, -6, 4, 12);

            // 左翅膀
            this.ctx.fillStyle = '#FF69B4';
            this.ctx.beginPath();
            this.ctx.ellipse(-wingSpread, -3, 8, 6, -0.3, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#FFB6C1';
            this.ctx.beginPath();
            this.ctx.ellipse(-wingSpread, 3, 6, 5, -0.5, 0, Math.PI * 2);
            this.ctx.fill();

            // 右翅膀
            this.ctx.fillStyle = '#FF69B4';
            this.ctx.beginPath();
            this.ctx.ellipse(wingSpread, -3, 8, 6, 0.3, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#FFB6C1';
            this.ctx.beginPath();
            this.ctx.ellipse(wingSpread, 3, 6, 5, 0.5, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });
    }

    /**
     * 更新和绘制装饰粒子
     */
    updateAndDrawParticles() {
        // 随机生成闪光粒子
        if (Math.random() < 0.02) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height * 0.5,
                size: 2 + Math.random() * 3,
                opacity: 1,
                speed: 0.5 + Math.random() * 0.5
            });
        }

        this.particles = this.particles.filter(particle => {
            particle.opacity -= 0.02;
            particle.y += particle.speed;

            if (particle.opacity > 0) {
                this.ctx.save();
                this.ctx.globalAlpha = particle.opacity;
                this.ctx.fillStyle = '#FFD700';
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                return true;
            }
            return false;
        });
    }

    /**
     * 绘制山脉
     */
    drawMountains() {
        this.mountains.forEach(mountain => {
            this.ctx.fillStyle = mountain.color;
            this.ctx.beginPath();
            this.ctx.moveTo(mountain.x, mountain.y);
            this.ctx.lineTo(mountain.x + mountain.width / 2, mountain.y - mountain.height);
            this.ctx.lineTo(mountain.x + mountain.width, mountain.y);
            this.ctx.closePath();
            this.ctx.fill();
        });
    }

    /**
     * 绘制花朵
     */
    drawFlowers() {
        this.flowers.forEach(flower => {
            flower.sway += 0.05;
            const swayOffset = Math.sin(flower.sway) * 2;

            this.ctx.save();
            this.ctx.translate(flower.x, flower.y);

            // 茎
            this.ctx.strokeStyle = '#228B22';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.quadraticCurveTo(swayOffset, -5, swayOffset, -10);
            this.ctx.stroke();

            // 花瓣
            this.ctx.fillStyle = flower.color;
            this.ctx.translate(swayOffset, -10);
            for (let i = 0; i < 5; i++) {
                this.ctx.rotate(Math.PI * 2 / 5);
                this.ctx.beginPath();
                this.ctx.ellipse(0, 3, 2, 4, 0, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // 花蕊
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const territoryScene = new TerritoryScene();
    window.territoryScene = territoryScene;
    await territoryScene.init();

    // 页面卸载时清理资源
    window.addEventListener('beforeunload', () => {
        territoryScene.cleanup();
    });
});